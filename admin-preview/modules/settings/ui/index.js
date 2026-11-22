import { adminApi, bindAsyncButton, confirmAction, showToast } from '/ui/kit/index.js';
import { renderEnvSecretStatusPanel, renderSettingsHistoryPanel } from './env-panel.js';
import { cloneConfigDraft, renderAllSettingsSections } from './sections.js';
import { detectDraftHighRiskChanges, validateSettingsDraft } from './validators.js';

function createTabSwitcher(tabs, activeId, onSelect) {
  const bar = Object.assign(document.createElement('div'), { className: 'adm-i18n-tabs', style: 'margin-bottom:16px;' });
  for (const t of tabs) {
    const btn = Object.assign(document.createElement('button'), {
      type: 'button',
      className: `adm-i18n-tab ${t.id === activeId ? 'is-active' : ''}`,
      textContent: t.label,
    });
    btn.addEventListener('click', () => onSelect(t.id));
    bar.appendChild(btn);
  }
  return bar;
}

async function performSaveSettings(state, ui, ctx) {
  ui.errBanner.hidden = true;
  const check = validateSettingsDraft(state.draft);
  if (!check.valid) {
    ui.errBanner.textContent = `无法保存，请修正以下问题：${check.errors.join('；')}`;
    ui.errBanner.hidden = false;
    throw new Error(check.errors[0] || '表单校验未通过');
  }

  const highRiskList = detectDraftHighRiskChanges(state.initialConfig, state.draft);
  let confirmHighRisk = false;
  if (highRiskList.length > 0) {
    const ok = await confirmAction({
      title: '高风险全局配置变更确认',
      message: `您修改了 ${highRiskList.join('、')}，这会影响全站所有页面的 canonical、hreflang 与路由结构。修改部署方式或路径后，全站线上地址将发生变化，旧地址需要配置 301 跳转，共用域名还需重新运行 build:root 更新根目录索引。确认继续保存吗？`,
      confirmLabel: '确认修改并提交',
      danger: true,
    });
    if (!ok) return;
    confirmHighRisk = true;
  }

  const res = await adminApi.put(`/settings/${encodeURIComponent(state.siteId)}`, {
    config: state.draft,
    confirmHighRisk,
    message: ui.noteInput.value.trim(),
  });
  ui.noteInput.value = '';
  showToast(`站点设置已保存（提交 ${String(res.commitHash || '').slice(0, 8)}）`, 'success');
  await state.reload();
  if (typeof ctx?.refreshShell === 'function') await ctx.refreshShell();
}

function createSaveFooterBar(canWrite, onSave) {
  const bar = Object.assign(document.createElement('div'), {
    style: 'position:sticky;bottom:0;background:var(--adm-surface);border:1px solid var(--adm-border);border-radius:var(--adm-radius);padding:12px 16px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;box-shadow:0 -4px 16px rgba(0,0,0,0.05);',
  });
  const noteInput = Object.assign(document.createElement('input'), {
    type: 'text',
    className: 'adm-input',
    placeholder: '可选填写本次配置变更说明（写入 Git 提交信息）…',
    disabled: !canWrite,
    style: 'flex:1;min-width:240px;',
  });
  const saveBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--primary',
    textContent: '保存设置并生成 Git 提交',
    disabled: !canWrite,
  });
  if (canWrite) {
    bindAsyncButton(saveBtn, onSave, {
      loadingLabel: '正在校验并提交…',
      retryLabel: '保存失败，点击重试',
      onError: (err) => showToast(err.message || '保存失败', 'error'),
    });
  }
  bar.append(noteInput, saveBtn);
  return { bar, noteInput, saveBtn };
}

function switchActivePane(activeTab, tabHost, panes, onTabChange) {
  const tabs = [
    { id: 'form', label: '站点配置表单（9 组）' },
    { id: 'secrets', label: '环境变量与密钥状态（只读）' },
    { id: 'history', label: 'Git 变更历史' },
  ];
  tabHost.innerHTML = '';
  tabHost.appendChild(createTabSwitcher(tabs, activeTab, onTabChange));
  panes.formWrap.hidden = activeTab !== 'form';
  panes.envHost.hidden = activeTab !== 'secrets';
  panes.historyHost.hidden = activeTab !== 'history';
}

function buildSettingsLayoutDom(container, siteId) {
  const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  const titleEl = Object.assign(document.createElement('h2'), { textContent: `站点设置 · ${siteId}` });
  const refreshBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline', textContent: '重新加载' });
  head.append(titleEl, refreshBtn);

  const readonlyAlert = Object.assign(document.createElement('div'), { className: 'adm-alert adm-alert--warn', hidden: true, textContent: '当前账号仅具备只读权限（settings:read），修改 site.yaml 需要管理员（admin）角色。' });
  const errBanner = Object.assign(document.createElement('div'), { className: 'adm-alert', hidden: true, style: 'background:#fee2e2;border:1px solid #fca5a5;color:#991b1b;' });
  const tabHost = document.createElement('div');
  const formWrap = document.createElement('div');
  const sectionsHost = document.createElement('div');
  const footerHost = document.createElement('div');
  formWrap.append(sectionsHost, footerHost);
  const envHost = document.createElement('div');
  const historyHost = document.createElement('div');

  container.append(head, readonlyAlert, errBanner, tabHost, formWrap, envHost, historyHost);
  return { refreshBtn, readonlyAlert, errBanner, tabHost, formWrap, sectionsHost, footerHost, envHost, historyHost };
}

async function reloadSettingsView(state, dom, ctx, setTab) {
  const data = await adminApi.get(`/settings/${encodeURIComponent(state.siteId)}`);
  state.initialConfig = cloneConfigDraft(data.config);
  state.draft = cloneConfigDraft(data.config);
  dom.readonlyAlert.hidden = Boolean(data.canWrite);
  dom.errBanner.hidden = true;

  renderAllSettingsSections(dom.sectionsHost, state.draft, data.options || {}, Boolean(data.canWrite));
  dom.footerHost.innerHTML = '';
  const ui = { errBanner: dom.errBanner, noteInput: null };
  const footer = createSaveFooterBar(Boolean(data.canWrite), () => performSaveSettings(state, ui, ctx));
  ui.noteInput = footer.noteInput;
  dom.footerHost.appendChild(footer.bar);

  renderEnvSecretStatusPanel(dom.envHost, data.integrations, data.envVars);
  renderSettingsHistoryPanel(dom.historyHost, data.history, data.relPath);
  setTab(state.activeTab);
}

export async function mount(container, ctx = {}) {
  container.innerHTML = '';
  const siteId = ctx.siteId || 'powderclub';
  const state = { siteId, initialConfig: null, draft: null, activeTab: 'form', reload: async () => {} };
  const dom = buildSettingsLayoutDom(container, siteId);
  const setTab = (nextTab) => {
    state.activeTab = nextTab;
    switchActivePane(nextTab, dom.tabHost, dom, setTab);
  };
  state.reload = () => reloadSettingsView(state, dom, ctx, setTab);
  bindAsyncButton(dom.refreshBtn, state.reload, { loadingLabel: '加载中…', onError: (e) => showToast(e.message, 'error') });
  await state.reload();
}
