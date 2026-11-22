import {
  ADMIN_LOCALES,
  adminApi,
  bindAsyncButton,
  html,
  showToast,
} from '/ui/kit/index.js';
import { hasInvalidRestrictedMarkdown, renderBlockListEditor } from './block-editor.js';
import { openPageHistoryDialog } from './history-dialog.js';

function cleanEmptyLocaleMaps(node) {
  if (Array.isArray(node)) return node.map(cleanEmptyLocaleMaps);
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    const cleaned = cleanEmptyLocaleMaps(v);
    if (cleaned && typeof cleaned === 'object' && !Array.isArray(cleaned) && Object.keys(cleaned).length === 0) {
      if (k !== 'title' && k !== 'text' && k !== 'body' && k !== 'q' && k !== 'a') continue;
    }
    out[k] = cleaned;
  }
  return out;
}

function validateBeforeSave(pageDetail, draftData, changeReason) {
  if (pageDetail.isLegal && !String(changeReason || '').trim()) {
    return '法务页面（隐私政策、服务条款）保存前必须填写“修改说明”';
  }
  if (!String(draftData.title?.['zh-CN'] || '').trim()) {
    return '简体中文（zh-CN）页面标题不能为空';
  }
  const rawJson = JSON.stringify(draftData.blocks || []);
  if (hasInvalidRestrictedMarkdown(rawJson)) {
    return '页面块包含被禁止的原始 HTML 标签或危险链接协议，请先修正标红字段';
  }
  return '';
}

async function pollTranslationJob(jobId) {
  for (let i = 0; i < 60; i += 1) {
    const { job } = await adminApi.get(`/jobs/${encodeURIComponent(jobId)}`);
    if (job.status === 'succeeded') return job;
    if (job.status === 'failed') throw new Error(job.error || 'AI 翻译任务执行失败');
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

function renderLocaleTabBar(tabHost, draftData, activeLocale, onSwitch) {
  tabHost.innerHTML = '';
  for (const loc of ADMIN_LOCALES) {
    const hasTitle = Boolean(String(draftData.title?.[loc.code] || '').trim());
    const state = !hasTitle ? 'missing' : draftData.translations?.[loc.code] || (loc.code === 'zh-CN' ? 'source' : 'machine');
    const stateText = { source: '源文', reviewed: '已审校', machine: '机翻', missing: '缺失' }[state] || state;
    const btn = Object.assign(document.createElement('button'), {
      type: 'button',
      className: `adm-i18n-tab ${loc.code === activeLocale ? 'is-active' : ''}`,
    });
    btn.dataset.localeTab = loc.code;
    btn.append(
      Object.assign(document.createElement('span'), { textContent: loc.label }),
      Object.assign(document.createElement('span'), { className: `adm-badge adm-badge--${state}`, textContent: stateText }),
    );
    btn.addEventListener('click', () => onSwitch(loc.code));
    tabHost.appendChild(btn);
  }
}

function renderMetaInputs(metaHost, pageDetail, draftData, locale, onDirty) {
  metaHost.innerHTML = '';
  draftData.title = draftData.title || {};
  draftData.description = draftData.description || {};

  const addTextRow = (label, mapObj, multiline = false) => {
    const wrap = Object.assign(document.createElement('div'), { className: 'adm-field' });
    wrap.appendChild(Object.assign(document.createElement('label'), { className: 'adm-label', textContent: label }));
    const el = Object.assign(document.createElement(multiline ? 'textarea' : 'input'), {
      className: multiline ? 'adm-textarea' : 'adm-input',
      value: String(mapObj[locale] || ''),
      placeholder: `请输入 ${locale} ${label}…`,
    });
    if (multiline) el.rows = 2;
    else el.type = 'text';
    el.addEventListener('input', () => {
      if (el.value.trim()) mapObj[locale] = el.value;
      else delete mapObj[locale];
      onDirty();
    });
    wrap.appendChild(el);
    metaHost.appendChild(wrap);
  };

  if (pageDetail.pageId === 'about' || draftData.eyebrow) {
    draftData.eyebrow = draftData.eyebrow || {};
    addTextRow('顶部眉标（Eyebrow，可选）', draftData.eyebrow, false);
  }
  addTextRow('页面主标题（Title）', draftData.title, false);
  addTextRow('页面导语 / 描述（Description）', draftData.description, true);
}

function buildActionToolbar({ st, shellCtx, previewLink, reloadCurrentPage }) {
  const bar = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const aiStatus = st.detail.aiStatus || shellCtx.aiStatus || { configured: false, reason: '未配置 AI 环境变量' };

  const aiBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--outline',
    textContent: '一键 AI 翻译 4 语种',
    disabled: !aiStatus.configured,
    title: aiStatus.reason || '',
  });
  aiBtn.dataset.action = 'ai-translate';
  if (aiStatus.configured) {
    bindAsyncButton(
      aiBtn,
      async () => {
        const res = await adminApi.post(`/pages/${encodeURIComponent(st.activePageId)}/translate`, { siteId: shellCtx.siteId });
        showToast('已提交 AI 翻译任务，正在同步译文…', 'info');
        const finished = await pollTranslationJob(res.job.id);
        if (finished) {
          showToast('5 语种页面文案翻译已完成并写入提交', 'success');
          await shellCtx.refreshShell();
          await reloadCurrentPage();
        }
      },
      { loadingLabel: 'AI 翻译中…', onError: (err) => showToast(err.message, 'error') },
    );
  }

  const histBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--outline',
    textContent: '修改记录 / 回滚',
  });
  bindAsyncButton(histBtn, () =>
    openPageHistoryDialog({
      siteId: shellCtx.siteId,
      pageId: st.activePageId,
      label: st.detail.label,
      isLegal: st.detail.isLegal,
      onReverted: async () => {
        await shellCtx.refreshShell();
        await reloadCurrentPage();
      },
    }),
  );

  bar.append(previewLink, aiBtn, histBtn);
  if (!aiStatus.configured) {
    bar.appendChild(Object.assign(document.createElement('span'), { className: 'adm-muted', textContent: `（AI 不可用：${aiStatus.reason}）` }));
  }
  return bar;
}

function renderEditorWorkspace(workHost, st, shellCtx, reloadCurrentPage) {
  workHost.innerHTML = '';
  const detail = st.detail;
  const canPublish = Boolean(shellCtx.user?.permissions?.includes('pages:publish'));

  const topRow = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  const titleInfo = Object.assign(document.createElement('div'), {
    innerHTML: html`<strong>${detail.label}</strong> <span class="adm-muted">(${detail.relPath} · 最近更新：${st.draft.updatedAt || '未保存'})</span>`,
  });

  const previewHref = `${detail.previewBaseUrl}${detail.previewPaths?.[st.activeLocale] || '/'}`;
  const previewLink = Object.assign(document.createElement('a'), {
    href: previewHref,
    target: '_blank',
    rel: 'noopener noreferrer',
    className: 'adm-btn adm-btn--outline',
    textContent: `新窗口预览 (${st.activeLocale}) ↗`,
  });
  topRow.append(titleInfo, buildActionToolbar({ st, shellCtx, previewLink, reloadCurrentPage }));

  const tabBar = Object.assign(document.createElement('div'), { className: 'adm-i18n-tabs' });
  const metaHost = Object.assign(document.createElement('div'), { className: 'adm-form' });
  const blocksHost = document.createElement('div');
  const markDirty = () => { st.dirty = true; };

  const syncLocaleViews = (nextLoc) => {
    st.activeLocale = nextLoc;
    previewLink.href = `${detail.previewBaseUrl}${detail.previewPaths?.[st.activeLocale] || '/'}`;
    previewLink.textContent = `新窗口预览 (${st.activeLocale}) ↗`;
    renderLocaleTabBar(tabBar, st.draft, st.activeLocale, syncLocaleViews);
    renderMetaInputs(metaHost, detail, st.draft, st.activeLocale, markDirty);
    renderBlockListEditor(blocksHost, st.draft, st.activeLocale, markDirty);
  };
  syncLocaleViews(st.activeLocale);

  const footPanel = Object.assign(document.createElement('div'), { className: 'adm-i18n-editor' });
  const reasonInput = Object.assign(document.createElement('input'), {
    type: 'text',
    className: 'adm-input',
    placeholder: detail.isLegal ? '必填：例如“补充小程序隐私收集说明”' : '选填：本次修改摘要（写入 Git 提交记录）',
  });
  reasonInput.dataset.field = 'changeReason';
  const errBox = Object.assign(document.createElement('p'), { className: 'adm-field__error', hidden: true });

  const executeSave = async (intent) => {
    errBox.hidden = true;
    const msg = validateBeforeSave(detail, st.draft, reasonInput.value);
    if (msg) {
      errBox.textContent = msg;
      errBox.hidden = false;
      throw new Error(msg);
    }
    const res = await adminApi.put(`/pages/${encodeURIComponent(st.activePageId)}`, {
      siteId: shellCtx.siteId,
      intent,
      changeReason: reasonInput.value.trim(),
      data: cleanEmptyLocaleMaps(structuredClone(st.draft)),
    });
    st.dirty = false;
    showToast(`保存成功（提交 ${res.commitHash.slice(0, 8)}，更新日期 ${res.updatedAt}）`, 'success');
    await shellCtx.refreshShell();
    await reloadCurrentPage();
  };

  const draftBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline', textContent: '保存为草稿' });
  const pubBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--primary',
    textContent: '保存并上线',
    disabled: !canPublish,
    title: canPublish ? '' : '编辑角色仅可保存草稿，需审核或管理员角色发布上线',
  });
  bindAsyncButton(draftBtn, () => executeSave('draft'), { loadingLabel: '正在保存草稿…' });
  if (canPublish) bindAsyncButton(pubBtn, () => executeSave('publish'), { loadingLabel: '正在提交上线…' });

  const btnRow = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  btnRow.style.marginTop = '10px';
  btnRow.append(draftBtn, pubBtn);

  footPanel.append(
    Object.assign(document.createElement('label'), {
      className: 'adm-label',
      textContent: detail.isLegal ? '法务修改说明（必填，自动更新页面“最后更新日期”）' : '修改备注（选填）',
    }),
    reasonInput,
    errBox,
    btnRow,
  );

  workHost.append(topRow, tabBar, metaHost, Object.assign(document.createElement('h3'), { textContent: '内容块编排' }), blocksHost, footPanel);
}

export async function mount(container, shellCtx) {
  container.innerHTML = '';
  const st = { activePageId: 'about', activeLocale: 'zh-CN', listItems: [], detail: null, draft: null, dirty: false };

  const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  head.appendChild(Object.assign(document.createElement('h2'), { textContent: `页面文案与块编辑器 · ${shellCtx.siteId}` }));
  const pageNav = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const workHost = document.createElement('div');
  container.append(head, pageNav, workHost);

  const reloadCurrentPage = async () => {
    const listRes = await adminApi.get(`/pages?siteId=${encodeURIComponent(shellCtx.siteId)}`);
    st.listItems = listRes.items || [];
    pageNav.innerHTML = '';
    for (const item of st.listItems) {
      const btn = Object.assign(document.createElement('button'), {
        type: 'button',
        className: `adm-btn ${item.pageId === st.activePageId ? 'adm-btn--primary' : 'adm-btn--outline'}`,
        textContent: `${item.label}${item.isLegal ? ' [法务]' : ''} · ${item.status === 'published' ? '已上线' : item.status === 'offline' ? '草稿' : '待创建'}`,
      });
      btn.dataset.pageSwitch = item.pageId;
      btn.addEventListener('click', async () => {
        st.activePageId = item.pageId;
        await reloadCurrentPage();
      });
      pageNav.appendChild(btn);
    }
    st.detail = await adminApi.get(`/pages/${encodeURIComponent(st.activePageId)}?siteId=${encodeURIComponent(shellCtx.siteId)}`);
    st.draft = structuredClone(st.detail.data || {});
    renderEditorWorkspace(workHost, st, shellCtx, reloadCurrentPage);
  };

  await reloadCurrentPage();
}
