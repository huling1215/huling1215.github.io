import {
  adminApi,
  bindAsyncButton,
  openDialog,
  renderDataTable,
  html,
  showToast,
} from '/ui/kit/index.js';
import { formatPreviewAttrValue, renderLiveVerticalPreview } from '/modules/verticals/ui/preview.js';
import {
  buildBlankDestinationEntry,
  renderDestinationEditorView,
  waitAndPollJob,
} from './editor-view.js';
import { getAtDotPath } from './field-widgets.js';

function ensureDestinationStyles() {
  if (!document.getElementById('vcModuleStyles')) {
    document.head.appendChild(Object.assign(document.createElement('link'), {
      id: 'vcModuleStyles', rel: 'stylesheet', href: '/modules/verticals/ui/styles.css',
    }));
  }
  if (!document.getElementById('dmModuleStyles')) {
    document.head.appendChild(Object.assign(document.createElement('link'), {
      id: 'dmModuleStyles', rel: 'stylesheet', href: '/modules/destinations/ui/styles.css',
    }));
  }
}

function userCanPublishDestinations(user) {
  if (!user || !Array.isArray(user.roles)) return false;
  return user.roles.includes('admin') || user.roles.includes('reviewer');
}

function summarizeCardMetrics(profile, entryData) {
  const cardAttrs = [...(profile.attributes || [])]
    .filter((a) => a.showOnCard)
    .sort((a, b) => a.order - b.order)
    .slice(0, 3);
  return cardAttrs
    .map((a) => {
      const raw = getAtDotPath(entryData, a.path);
      if (raw === undefined || raw === null) return null;
      return `${a.label?.['zh-CN'] || a.key}: ${formatPreviewAttrValue(raw, a, 'zh-CN')}`;
    })
    .filter(Boolean)
    .join(' · ') || '—';
}

function openDestinationPreviewModal(profile, rowData) {
  let loc = 'zh-CN';
  openDialog({
    title: `目的地渲染预览：${rowData.name?.['zh-CN'] || rowData.slug}`,
    renderBody: (body) => {
      const draw = () => renderLiveVerticalPreview(body, {
        profile, examples: [rowData], locale: loc, onLocaleChange: (next) => { loc = next; draw(); },
      });
      draw();
    },
  });
}

function renderRowActionsBar(row, st) {
  const bar = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const editBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '编辑' });
  editBtn.addEventListener('click', () => st.openEditor(row.slug));
  const prevBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '预览' });
  prevBtn.addEventListener('click', () => openDestinationPreviewModal(st.profile, row.data));
  bar.append(editBtn, prevBtn);
  if (st.canPublish || row.status === 'published') {
    const nextSt = row.status === 'published' ? 'offline' : 'published';
    const stBtn = Object.assign(document.createElement('button'), {
      type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm',
      textContent: row.status === 'published' ? '下架' : '上线',
      disabled: nextSt === 'published' && !st.canPublish,
    });
    bindAsyncButton(stBtn, async () => {
      await adminApi.post(`/destinations/${encodeURIComponent(row.slug)}/status`, { siteId: st.siteId, status: nextSt });
      showToast(`已将「${row.nameZh}」设为${nextSt === 'published' ? '上线' : '下线'}`, 'success');
      await st.reloadList();
    }, { onError: (e) => showToast(e.message, 'error') });
    bar.appendChild(stBtn);
  }
  return bar;
}

function buildDestinationColumns(st) {
  return [
    {
      key: 'select', label: '选择', sortable: false,
      render: (row) => {
        const cb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: st.selectedSlugs.has(row.slug) });
        cb.addEventListener('change', () => {
          if (cb.checked) st.selectedSlugs.add(row.slug);
          else st.selectedSlugs.delete(row.slug);
        });
        return cb;
      },
    },
    {
      key: 'nameZh', label: '目的地名称 / Slug',
      render: (row) => {
        const wrap = document.createElement('div');
        wrap.innerHTML = html`<strong>${row.nameZh}</strong><div class="adm-muted"><code>${row.slug}</code>${row.nameEn ? ` · ${row.nameEn}` : ''}</div>`;
        return wrap;
      },
    },
    { key: 'country', label: '国家 / 区域', render: (row) => `${row.country} / ${row.region}` },
    { key: 'metrics', label: '核心品类参数', sortable: false, render: (row) => summarizeCardMetrics(st.profile, row.data) },
    {
      key: 'status', label: '状态',
      render: (row) => Object.assign(document.createElement('span'), {
        className: `dm-pill ${row.status === 'published' ? 'dm-pill--pub' : 'dm-pill--draft'}`,
        textContent: row.status === 'published' ? '已上线' : '草稿/下线',
      }),
    },
    { key: 'updatedAt', label: '更新日期' },
    { key: 'actions', label: '操作', sortable: false, render: (row) => renderRowActionsBar(row, st) },
  ];
}

function renderListActionToolbar(toolbarEl, st) {
  toolbarEl.innerHTML = '';
  const left = Object.assign(document.createElement('div'), { className: 'dm-toolbar__group' });
  const stSel = Object.assign(document.createElement('select'), { className: 'adm-input' });
  for (const [v, t] of [['all', '全部状态'], ['published', '仅已上线'], ['offline', '仅草稿/下线']]) {
    stSel.appendChild(Object.assign(document.createElement('option'), { value: v, textContent: t, selected: st.statusFilter === v }));
  }
  stSel.addEventListener('change', () => { st.statusFilter = stSel.value; st.reloadList(); });
  left.appendChild(stSel);

  if (st.canPublish) {
    const batchPub = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '批量上线选中' });
    bindAsyncButton(batchPub, () => st.runBatchStatus('published'), { onError: (e) => showToast(e.message, 'error') });
    left.appendChild(batchPub);
  }
  const batchOff = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '批量下架选中' });
  bindAsyncButton(batchOff, () => st.runBatchStatus('offline'), { onError: (e) => showToast(e.message, 'error') });
  left.appendChild(batchOff);

  const right = Object.assign(document.createElement('div'), { className: 'dm-toolbar__group' });
  const trAllBtn = Object.assign(document.createElement('button'), {
    type: 'button', className: 'adm-btn adm-btn--outline',
    textContent: '一键 AI 翻译缺失/过期语言', disabled: !st.aiStatus?.configured,
  });
  trAllBtn.title = st.aiStatus?.reason || '';
  bindAsyncButton(trAllBtn, () => st.runBatchTranslate(), { onError: (e) => showToast(e.message, 'error') });
  const createBtn = Object.assign(document.createElement('button'), {
    type: 'button', className: 'adm-btn adm-btn--primary',
    textContent: `+ 新建${st.profile.entityName?.singular?.['zh-CN'] || '目的地'}`,
  });
  createBtn.addEventListener('click', () => st.openNewEditor());
  right.append(trAllBtn, createBtn);
  toolbarEl.append(left, right);
}

function drawDestinationListView(dom, siteId, st) {
  const entityZh = st.profile.entityName?.singular?.['zh-CN'] || '目的地';
  dom.titleEl.textContent = `目的地管理 · ${entityZh}`;
  dom.metaWrap.innerHTML = '';
  dom.metaWrap.append(
    Object.assign(document.createElement('span'), { className: 'dm-pill', textContent: `站点：${siteId}` }),
    Object.assign(document.createElement('span'), { className: 'dm-pill', textContent: `品类：${st.profile.name?.['zh-CN'] || st.profile.id} (${st.profile.id})` }),
    Object.assign(document.createElement('span'), { className: 'dm-pill', textContent: `目录：catalog/${siteId}/${st.profile.storageDir}/` }),
  );
  dom.bodyHost.innerHTML = '';
  const toolbar = Object.assign(document.createElement('div'), { className: 'dm-toolbar' });
  const tableBox = document.createElement('div');
  dom.bodyHost.append(toolbar, tableBox);
  renderListActionToolbar(toolbar, st);
  renderDataTable(tableBox, {
    columns: buildDestinationColumns(st),
    rows: st.items,
    filterPlaceholder: `搜索${entityZh}名称、Slug、国家或参数…`,
    emptyText: `当前站点暂无${entityZh}条目，点击右上角按钮新建`,
  });
}

function attachDestinationControllerActions(st, siteId, canPublish, bodyHost, user) {
  st.runBatchStatus = async (nextStatus) => {
    const slugs = Array.from(st.selectedSlugs);
    if (slugs.length === 0) throw new Error('请先勾选至少 1 个目的地');
    await adminApi.post('/destinations/batch-status', { siteId, slugs, status: nextStatus });
    showToast(`已批量更新 ${slugs.length} 个目的地状态`, 'success');
    await st.reloadList();
  };
  st.runBatchTranslate = async () => {
    const { job } = await adminApi.post('/destinations/translate', { siteId, slugs: Array.from(st.selectedSlugs) });
    showToast('已加入后台翻译任务队列…', 'info');
    const done = await waitAndPollJob(job.id);
    showToast(`AI 翻译完成：更新 ${done.result?.translatedEntries ?? 0} 条目的地`, 'success');
    await st.reloadList();
  };
  st.openEditor = async (slug) => {
    const detail = await adminApi.get(`/destinations/${encodeURIComponent(slug)}?siteId=${encodeURIComponent(siteId)}`);
    renderDestinationEditorView(bodyHost, {
      siteId, profile: detail.profile, entry: structuredClone(detail.data),
      isNew: false, canPublish, aiStatus: st.aiStatus, onBack: () => st.reloadList(),
    });
  };
  st.openNewEditor = () => {
    renderDestinationEditorView(bodyHost, {
      siteId, profile: st.profile, entry: buildBlankDestinationEntry(st.profile, user),
      isNew: true, canPublish, aiStatus: st.aiStatus, onBack: () => st.reloadList(),
    });
  };
}

export async function mount(viewport, shellCtx = {}) {
  ensureDestinationStyles();
  viewport.innerHTML = '';
  const siteId = shellCtx.siteId || 'powderclub';
  const canPublish = userCanPublishDestinations(shellCtx.user);

  const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  const titleEl = Object.assign(document.createElement('h2'), { textContent: '目的地管理' });
  const metaWrap = Object.assign(document.createElement('div'), { className: 'dm-head-meta' });
  head.append(titleEl, metaWrap);
  const bodyHost = document.createElement('div');
  viewport.append(head, bodyHost);
  const dom = { titleEl, metaWrap, bodyHost };

  const st = {
    siteId, canPublish, statusFilter: 'all', selectedSlugs: new Set(),
    profile: null, items: [], aiStatus: shellCtx.aiStatus || { configured: false, reason: '' },
    reloadList: async () => {
      const res = await adminApi.get(`/destinations?siteId=${encodeURIComponent(siteId)}&status=${encodeURIComponent(st.statusFilter)}`);
      Object.assign(st, { profile: res.profile, items: res.items, aiStatus: res.aiStatus || st.aiStatus });
      st.selectedSlugs.clear();
      drawDestinationListView(dom, siteId, st);
    },
  };
  attachDestinationControllerActions(st, siteId, canPublish, bodyHost, shellCtx.user);
  await st.reloadList();
}
