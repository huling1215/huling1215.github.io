import {
  adminApi,
  bindAsyncButton,
  createI18nEditor,
  openDialog,
  html,
  showToast,
} from '/ui/kit/index.js';
import { renderModuleList } from './module-card.js';

function ensureCurationStyles() {
  if (document.getElementById('admCurationStyles')) return;
  const link = Object.assign(document.createElement('link'), {
    id: 'admCurationStyles',
    rel: 'stylesheet',
    href: '/modules/curation/ui/curation.css',
  });
  document.head.appendChild(link);
}

async function openCurationHistoryDialog(siteId) {
  const res = await adminApi.get(`/curation/history?siteId=${encodeURIComponent(siteId)}`);
  openDialog({
    title: `版本历史 · ${res.relPath}`,
    renderBody: (body) => {
      if (!res.commits?.length) {
        body.textContent = '当前站点尚未创建或修改过 curation.yaml（前台按默认模板 100% 渲染）。';
        return;
      }
      for (const c of res.commits) {
        const row = Object.assign(document.createElement('div'), { className: 'adm-history-row' });
        row.innerHTML = html`<div><strong>${c.commit.slice(0, 8)}</strong> · ${c.authorName} · <span class="adm-muted">${c.date.slice(0, 19).replace('T', ' ')}</span><div>${c.subject}</div></div>`;
        body.appendChild(row);
      }
    },
  });
}

function renderHeroPanel(state) {
  const panel = Object.assign(document.createElement('section'), { className: 'cur-panel' });
  panel.append(
    Object.assign(document.createElement('h3'), { className: 'cur-panel__title', textContent: '首屏主副标语覆写（5 语种）' }),
    Object.assign(document.createElement('p'), { className: 'adm-muted', textContent: '留空的语种将自动回退使用站点 i18n 词典默认文案。' }),
  );
  const fields = [
    { key: 'headline', label: '首屏主标语（H1 / hero.headline）', multiline: false },
    { key: 'subtitle', label: '首屏副标语（hero.subtitle）', multiline: true },
    { key: 'eyebrow', label: '首屏微标（hero.eyebrow，选填）', multiline: false },
  ];
  for (const field of fields) {
    const wrap = Object.assign(document.createElement('div'), { className: 'adm-field' });
    wrap.appendChild(Object.assign(document.createElement('label'), { className: 'adm-label', textContent: field.label }));
    const editor = createI18nEditor({
      multiline: field.multiline,
      rows: 2,
      value: state.hero[field.key] || {},
      onChange: (nextVal) => { state.hero[field.key] = nextVal; },
    });
    wrap.appendChild(editor.el);
    panel.appendChild(wrap);
  }
  return panel;
}

function buildCurationTopbar(data, state, shellCtx, canWrite) {
  const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  const titleWrap = document.createElement('div');
  titleWrap.append(
    Object.assign(document.createElement('h2'), { textContent: `首页编排 · ${shellCtx.siteId}` }),
    Object.assign(document.createElement('span'), {
      className: 'adm-muted',
      textContent: data.exists ? `当前生效文件：${data.relPath}` : `尚未创建 ${data.relPath}（当前前台使用默认编排）`,
    }),
  );

  const actions = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const noteInput = Object.assign(document.createElement('input'), {
    type: 'text', className: 'adm-input', placeholder: '提交备注（选填，如：置顶二世古攻略）', disabled: !canWrite,
  });
  const histBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline', textContent: '提交历史' });
  const saveBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--primary', textContent: '保存编排并提交 Git', disabled: !canWrite });

  bindAsyncButton(histBtn, () => openCurationHistoryDialog(shellCtx.siteId));
  bindAsyncButton(saveBtn, async () => {
    const modules = Object.fromEntries(state.moduleOrder.map((id, idx) => [id, { ...(state.modules[id] || {}), order: idx }]));
    const saved = await adminApi.put('/curation', {
      siteId: shellCtx.siteId,
      curation: { hero: state.hero, moduleOrder: state.moduleOrder, modules },
      message: noteInput.value.trim(),
    });
    showToast(`首页编排已保存（提交 ${saved.commitHash.slice(0, 8)}）`, 'success');
    await shellCtx.refreshShell();
  }, { onError: (err) => showToast(err.message || '保存失败', 'error') });

  actions.append(noteInput, histBtn, saveBtn);
  head.append(titleWrap, actions);
  return head;
}

export async function mount(container, shellCtx) {
  ensureCurationStyles();
  container.innerHTML = '<p class="adm-muted">正在加载首页编排配置…</p>';

  const canWrite = Boolean(shellCtx.user?.permissions?.includes('curation:write') || shellCtx.user?.roles?.includes('admin'));
  const data = await adminApi.get(`/curation?siteId=${encodeURIComponent(shellCtx.siteId)}`);
  const state = structuredClone(data.curation);

  container.innerHTML = '';
  const grid = Object.assign(document.createElement('div'), { className: 'cur-grid' });
  const modPanel = Object.assign(document.createElement('section'), { className: 'cur-panel' });
  modPanel.append(
    Object.assign(document.createElement('h3'), { className: 'cur-panel__title', textContent: '首页模块顺序、显隐与置顶条目（支持拖拽）' }),
    Object.assign(document.createElement('p'), { className: 'adm-muted', textContent: '按住模块标题可上下拖拽调整顺序，或使用 ↑ / ↓ 按钮；置顶条目将优先展示在模块最前。' }),
  );
  const modListEl = Object.assign(document.createElement('div'), { className: 'cur-mod-list' });
  renderModuleList(modListEl, state, data.candidates || {}, canWrite);
  modPanel.appendChild(modListEl);

  grid.append(renderHeroPanel(state), modPanel);
  container.append(buildCurationTopbar(data, state, shellCtx, canWrite), grid);
}
