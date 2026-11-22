import { html } from '/ui/kit/escape.js';
import {
  adminApi,
  bindAsyncButton,
  confirmAction,
  renderDataTable,
  showToast,
} from '/ui/kit/index.js';
import {
  openLiveJobDialog,
  openReleaseDiffDialog,
  renderDeployInfoBanner,
  renderReadinessPanel,
} from './panels.js';

function makeButton(label, variantClass, disabled = false, title = '') {
  return Object.assign(document.createElement('button'), {
    type: 'button',
    className: `adm-btn ${variantClass}`,
    textContent: label,
    disabled,
    title,
  });
}

function createHeaderToolbar(canPublish) {
  const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  const titleWrap = document.createElement('div');
  const h2 = Object.assign(document.createElement('h2'), { textContent: '发布中心与版本回滚' });
  const pendingHint = Object.assign(document.createElement('div'), { className: 'adm-muted' });
  titleWrap.append(h2, pendingHint);

  const tip = canPublish ? '' : '当前账号缺少 release:publish 权限，仅可查看就绪状态与发布历史';
  const actions = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const btnPublish = makeButton('正式发布上线', 'adm-btn--primary', !canPublish, tip);
  const btnBuild = makeButton('仅演练构建与审计', 'adm-btn--outline', !canPublish, tip);
  const btnPushIndex = makeButton('推送收录', 'adm-btn--outline', !canPublish, tip);
  const btnPendingDiff = makeButton('查看未发布改动', 'adm-btn--outline');
  const btnRefresh = makeButton('刷新', 'adm-btn--ghost');

  actions.append(btnPublish, btnBuild, btnPushIndex, btnPendingDiff, btnRefresh);
  head.append(titleWrap, actions);
  return { head, pendingHint, btnPublish, btnBuild, btnPushIndex, btnPendingDiff, btnRefresh };
}

function renderRecordResultCell(row) {
  const wrap = document.createElement('div');
  if (row.result === 'succeeded') {
    const scopeHint = row.deployMode === 'path' && row.basePath ? `（${row.basePath}）` : '';
    wrap.innerHTML = html`
      <span class="adm-badge adm-badge--reviewed">${row.isRollback ? '成功 · 回滚' : '发布成功'}${scopeHint}</span>
      ${row.postReleaseNotice ? html`<div class="adm-muted" style="font-size: 12px; margin-top: 4px;">${row.postReleaseNotice}</div>` : ''}
    `;
    return wrap;
  }
  wrap.innerHTML = html`
    <span class="adm-badge adm-badge--missing">失败（${row.failedStepTitle || row.failedStep || '中止'}）</span>
    ${row.error ? html`<div class="adm-field__error">${row.error}</div>` : ''}
  `;
  return wrap;
}

function bindRollbackButton(rbBtn, { siteId, tagName, deployInfo, reloadAll }) {
  bindAsyncButton(
    rbBtn,
    async () => {
      const scopeDesc =
        deployInfo?.mode === 'path'
          ? `将从历史标签「${tagName}」按子路径「${deployInfo.basePath}」构建，并仅回滚同步本站子目录，绝不影响同域名其他站点或当前分支。确认立即回滚吗？`
          : `将从历史标签「${tagName}」在独立临时目录重新构建并部署上线，不会修改当前工作分支代码。确认立即回滚吗？`;
      const confirmed = await confirmAction({
        title: '确认回滚线上版本',
        message: scopeDesc,
        confirmLabel: '确认回滚并发布',
        danger: true,
      });
      if (!confirmed) return;
      const res = await adminApi.post('/release/rollback', { siteId, tag: tagName });
      openLiveJobDialog(res.job, reloadAll);
    },
    { loadingLabel: '提交中…', onError: (err) => showToast(err.message, 'error') },
  );
}

function createRecordActionsCell(row, { siteId, canPublish, deployInfo, reloadAll }) {
  const box = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const diffRef = row.tagName || row.commitHash;
  const diffBtn = makeButton('相比上次改了什么', 'adm-btn--outline adm-btn--sm');
  bindAsyncButton(
    diffBtn,
    () => openReleaseDiffDialog({ siteId, tag: diffRef, prevTag: row.previousTag || '', title: `版本变更详情 · ${diffRef}` }),
    { loadingLabel: '对比中…', onError: (err) => showToast(err.message, 'error') },
  );
  box.appendChild(diffBtn);

  if (row.result === 'succeeded' && row.tagName) {
    const rbBtn = makeButton('回滚到此版本', 'adm-btn--danger adm-btn--sm', !canPublish);
    bindRollbackButton(rbBtn, { siteId, tagName: row.tagName, deployInfo, reloadAll });
    box.appendChild(rbBtn);
  }
  return box;
}

function renderRecordsSection(tableHost, records, ctx) {
  renderDataTable(tableHost, {
    rows: records,
    emptyText: '当前站点暂无历史发布记录',
    filterPlaceholder: '按标签、提交号、发起人或状态筛选…',
    columns: [
      { key: 'tagName', label: '发布标签', render: (r) => r.tagName || '（未生成标签）' },
      { key: 'result', label: '执行结果', render: renderRecordResultCell },
      { key: 'commitHash', label: 'Git 提交', render: (r) => (r.commitHash || '').slice(0, 8) },
      { key: 'pageCount', label: '页数 / 耗时', render: (r) => `${r.pageCount ?? 0} 页 · ${((r.durationMs || 0) / 1000).toFixed(1)}s` },
      { key: 'initiator', label: '发起人', render: (r) => r.initiator?.displayName || '-' },
      { key: 'finishedAt', label: '完成时间', render: (r) => (r.finishedAt || '').slice(0, 19).replace('T', ' ') },
      { key: 'actions', label: '操作', sortable: false, render: (r) => createRecordActionsCell(r, ctx) },
    ],
  });
}

function bindToolbarActions(ui, { siteId, latestBaselineGetter, reloadAll }) {
  const errOpt = { onError: (err) => showToast(err.message, 'error') };
  bindAsyncButton(ui.btnPublish, async () => openLiveJobDialog((await adminApi.post('/release/publish', { siteId })).job, reloadAll), { loadingLabel: '排队发布中…', ...errOpt });
  bindAsyncButton(ui.btnBuild, async () => openLiveJobDialog((await adminApi.post('/release/build', { siteId })).job, reloadAll), { loadingLabel: '构建中…', ...errOpt });
  bindAsyncButton(ui.btnPushIndex, async () => openLiveJobDialog((await adminApi.post('/release/push-index', { siteId })).job, reloadAll), { loadingLabel: '推送中…', ...errOpt });
  bindAsyncButton(ui.btnPendingDiff, () => openReleaseDiffDialog({ siteId, tag: 'HEAD', prevTag: latestBaselineGetter(), title: '当前未发布的修改对比' }), { loadingLabel: '读取中…', ...errOpt });
  bindAsyncButton(ui.btnRefresh, reloadAll, { loadingLabel: '刷新中…', ...errOpt });
}

export async function mount(container, shellCtx) {
  container.replaceChildren();
  const siteId = shellCtx.siteId || 'powderclub';
  const perms = shellCtx.user?.permissions || [];
  const canPublish = Boolean(shellCtx.user?.roles?.includes('admin') || perms.includes('release:publish'));

  const ui = createHeaderToolbar(canPublish);
  const deployBannerHost = document.createElement('div');
  const readinessTitle = Object.assign(document.createElement('h3'), { textContent: '一、上线就绪与外部集成检查' });
  const readinessHost = document.createElement('div');
  const historyTitle = Object.assign(document.createElement('h3'), { textContent: '二、历次发布记录与版本回滚' });
  const tableHost = document.createElement('div');
  container.append(ui.head, deployBannerHost, readinessTitle, readinessHost, historyTitle, tableHost);

  let latestBaselineTag = '';
  async function reloadAll() {
    const data = await adminApi.get(`/release/overview?siteId=${encodeURIComponent(siteId)}`);
    const deployInfo = data.deploy || data.readiness?.deploy || { mode: 'domain', basePath: '/', label: '独立域名', publicUrl: '' };
    latestBaselineTag = data.pendingChanges?.baselineTag || '';
    const baseText = latestBaselineTag ? `上次发布标签：${latestBaselineTag}` : '尚未进行过首次正式发布';
    ui.pendingHint.innerHTML = html`站点 <code>${siteId}</code> · 当前有 ${data.pendingChanges?.count ?? 0} 处未发布提交（${baseText}）`;
    renderDeployInfoBanner(deployBannerHost, deployInfo, (data.records || [])[0] || null);
    renderReadinessPanel(readinessHost, data.readiness, shellCtx);
    renderRecordsSection(tableHost, data.records || [], { siteId, canPublish, deployInfo, reloadAll });
    const me = await adminApi.get(`/auth/me?siteId=${encodeURIComponent(siteId)}`);
    const pendingBadge = document.getElementById('admPendingCount');
    if (pendingBadge) pendingBadge.textContent = String(me.pendingChanges?.count ?? 0);
  }

  bindToolbarActions(ui, { siteId, latestBaselineGetter: () => latestBaselineTag, reloadAll });
  await reloadAll();
}
