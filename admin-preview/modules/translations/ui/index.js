import { adminApi, bindAsyncButton, showToast } from '/ui/kit/index.js';
import { openCsvExportDialog, openCsvImportDialog } from './csv-dialogs.js';
import { renderDetailScreen } from './detail.js';
import { renderOverviewScreen } from './overview.js';
import { ensureTranslationStyles } from './styles.js';

function hasPerm(user, perm) {
  if (!user) return false;
  if (Array.isArray(user.roles) && user.roles.includes('admin')) return true;
  return Array.isArray(user.permissions) && user.permissions.includes(perm);
}

function buildModuleHeader({ state, canTranslate, canReview, onTranslate, onLint, onExportCsv, onImportCsv, onReconcile }) {
  const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  const left = document.createElement('div');
  left.appendChild(Object.assign(document.createElement('h2'), { textContent: `翻译审校工作台 · ${state.siteId}` }));
  if (!state.aiStatus?.configured) {
    left.appendChild(Object.assign(document.createElement('div'), {
      className: 'adm-muted',
      textContent: `AI 翻译置灰原因：${state.aiStatus?.reason || '服务器未配置 AI 环境变量'}`,
    }));
  }

  const bar = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const aiOk = canTranslate && Boolean(state.aiStatus?.configured);
  const trBtn = Object.assign(document.createElement('button'), {
    type: 'button', className: 'adm-btn adm-btn--primary', textContent: '一键 AI 翻译（缺失/过期）',
    disabled: !aiOk,
    title: !canTranslate ? '当前账号缺少 translations:translate 权限' : (state.aiStatus?.reason || '加入后台任务队列执行增量翻译'),
  });
  const lintBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline', textContent: '一键 Lint 质检' });
  const expBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline', textContent: '导出审校 CSV' });
  const impBtn = Object.assign(document.createElement('button'), {
    type: 'button', className: 'adm-btn adm-btn--outline', textContent: '导入审校 CSV',
    disabled: !canReview, title: canReview ? '预览并写回外包审校 CSV' : '需要 translations:review 权限',
  });
  const recBtn = Object.assign(document.createElement('button'), {
    type: 'button', className: 'adm-btn adm-btn--ghost', textContent: '同步过期回退',
    disabled: !canReview, title: canReview ? '扫描源文变更并将过期条目自动退回 machine 提交 Git' : '需要 translations:review 权限',
  });

  bindAsyncButton(trBtn, onTranslate, { onError: (e) => showToast(e.message, 'error') });
  bindAsyncButton(lintBtn, onLint, { onError: (e) => showToast(e.message, 'error') });
  expBtn.addEventListener('click', onExportCsv);
  impBtn.addEventListener('click', onImportCsv);
  bindAsyncButton(recBtn, onReconcile, { onError: (e) => showToast(e.message, 'error') });
  bar.append(trBtn, lintBtn, expBtn, impBtn, recBtn);
  head.append(left, bar);
  return head;
}

async function pollTranslateJobUntilDone(jobId, onDone) {
  for (let i = 0; i < 40; i += 1) {
    await new Promise((r) => window.setTimeout(r, 800));
    try {
      const res = await adminApi.get(`/jobs/${encodeURIComponent(jobId)}`);
      if (res.job?.status === 'succeeded') {
        showToast('AI 增量翻译任务已完成', 'success');
        await onDone();
        return;
      }
      if (res.job?.status === 'failed') {
        showToast(`AI 翻译任务失败：${res.job.error || '请前往后台任务查看日志'}`, 'error');
        return;
      }
    } catch {
      return;
    }
  }
}

function buildHeaderCallbacks({ state, canReview, shellCtx, loadOverview, enqueueScopeTranslate, draw }) {
  return {
    onTranslate: () => enqueueScopeTranslate({
      ...(state.filters.collection ? { collections: [state.filters.collection] } : {}),
      ...(state.filters.locale ? { targetLocales: [state.filters.locale] } : {}),
    }),
    onLint: async () => {
      const qs = new URLSearchParams({
        siteId: state.siteId,
        ...(state.filters.collection ? { collection: state.filters.collection } : {}),
        ...(state.filters.locale ? { locale: state.filters.locale } : {}),
      });
      state.lintReport = await adminApi.get(`/translations/lint?${qs.toString()}`);
      const cnt = state.lintReport.totalIssues ?? 0;
      showToast(cnt > 0 ? `检出 ${cnt} 项违规` : 'Lint 检查全部通过', cnt > 0 ? 'info' : 'success');
      draw();
    },
    onExportCsv: () => openCsvExportDialog(state.siteId, state.filters),
    onImportCsv: () => openCsvImportDialog(state.siteId, canReview, async () => { await shellCtx.refreshShell(); await loadOverview(); }),
    onReconcile: async () => {
      const r = await adminApi.post('/translations/reconcile', { siteId: state.siteId });
      showToast(r.commitHash ? `已回退 ${r.reconciledCount} 条过期审校并提交 Git` : '当前无需要回退的过期条目', 'success');
      await shellCtx.refreshShell();
      await loadOverview();
    },
  };
}

function renderControllerView(ctx) {
  const { state, headerHost, bodyHost, canTranslate, canReview, shellCtx, loadOverview, openDetail } = ctx;
  headerHost.innerHTML = '';
  headerHost.appendChild(buildModuleHeader({
    state, canTranslate, canReview, ...buildHeaderCallbacks(ctx),
  }));
  if (state.detail) {
    renderDetailScreen(bodyHost, {
      detail: state.detail, activeLocale: state.activeLocale, focusFieldPath: state.focusFieldPath,
      canReview, canTranslate, aiStatus: state.aiStatus, refreshShell: shellCtx.refreshShell,
      onBack: () => loadOverview(),
      onSwitchLocale: (loc, fp = '') => { state.activeLocale = loc; state.focusFieldPath = fp; ctx.draw(); },
      onReloadDetail: (loc, fp) => openDetail(state.detail.collection, state.detail.slug, loc, fp),
      onTranslateScope: ctx.enqueueScopeTranslate,
    });
    return;
  }
  renderOverviewScreen(bodyHost, {
    overview: state.overview || { siteId: state.siteId, totals: {}, bySite: [], byCollection: [], byLocale: [], entries: [] },
    filters: state.filters, lintReport: state.lintReport,
    onFilterChange: (patch) => { state.filters = { ...state.filters, ...patch }; ctx.draw(); },
    onSwitchSite: async (nextSiteId) => { state.siteId = nextSiteId; state.lintReport = null; await loadOverview(); },
    onOpenEntry: (col, slug, loc, fp = '') => openDetail(col, slug, loc || state.filters.locale || 'ja', fp),
    onDismissLint: () => { state.lintReport = null; ctx.draw(); },
  });
}

function createWorkbenchController(container, shellCtx) {
  const canTranslate = hasPerm(shellCtx.user, 'translations:translate');
  const canReview = hasPerm(shellCtx.user, 'translations:review');
  const state = {
    siteId: shellCtx.siteId || 'powderclub', aiStatus: shellCtx.aiStatus || { configured: false, reason: '' },
    filters: { collection: '', locale: '', state: '' }, overview: null, lintReport: null, detail: null, activeLocale: 'ja', focusFieldPath: '',
  };
  const headerHost = document.createElement('div');
  const bodyHost = document.createElement('div');
  container.innerHTML = '';
  container.append(headerHost, bodyHost);

  const openDetail = async (collection, slug, locale = 'ja', focusFieldPath = '') => {
    const detail = await adminApi.get(`/translations/entries/${encodeURIComponent(collection)}/${encodeURIComponent(slug)}?siteId=${encodeURIComponent(state.siteId)}`);
    const validLocs = detail.evaluation?.targetLocales || [];
    Object.assign(state, { detail, aiStatus: detail.aiStatus || state.aiStatus, activeLocale: validLocs.includes(locale) ? locale : (validLocs[0] || 'ja'), focusFieldPath });
    draw();
  };
  const loadOverview = async () => {
    const ov = await adminApi.get(`/translations/overview?siteId=${encodeURIComponent(state.siteId)}`);
    Object.assign(state, { overview: ov, aiStatus: ov.aiStatus || state.aiStatus, detail: null });
    draw();
  };
  const enqueueScopeTranslate = async (scopePayload = {}) => {
    const res = await adminApi.post('/translations/translate', { siteId: state.siteId, ...scopePayload });
    showToast(`已加入任务队列 (#${res.job.id.slice(0, 8)})，后台正在串行执行…`, 'info');
    pollTranslateJobUntilDone(res.job.id, async () => {
      await shellCtx.refreshShell();
      await (state.detail ? openDetail(state.detail.collection, state.detail.slug, state.activeLocale, '') : loadOverview());
    });
  };
  const draw = () => renderControllerView({ state, headerHost, bodyHost, canTranslate, canReview, shellCtx, loadOverview, openDetail, enqueueScopeTranslate, draw });
  return { loadOverview };
}

export async function mount(container, shellCtx) {
  ensureTranslationStyles();
  const ctrl = createWorkbenchController(container, shellCtx);
  await ctrl.loadOverview();
}

export default mount;
