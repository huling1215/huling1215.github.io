import {
  adminApi,
  bindAsyncButton,
  openDialog,
  renderDataTable,
  showToast,
} from '/ui/kit/index.js';
import { renderBriefStudioPanel } from './brief-panel.js';
import { renderDraftReviewPanel } from './draft-review.js';

const AI_STUDIO_CSS = `
.adm-ai-card { background: var(--adm-surface); border: 1px solid var(--adm-border); border-radius: var(--adm-radius); padding: 18px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 12px; }
.adm-ai-card h3, .adm-ai-card h4 { margin: 0; }
.adm-ai-grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.adm-ai-grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
.adm-ai-box { border: 1px solid var(--adm-border); border-radius: var(--adm-radius); background: #fafbfe; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.adm-ai-kv-list { display: flex; flex-direction: column; gap: 8px; }
.adm-ai-kv-row { display: grid; grid-template-columns: 1fr 1.4fr auto; gap: 8px; align-items: center; }
.adm-ai-chip-grid { display: flex; flex-wrap: wrap; gap: 8px; max-height: 150px; overflow-y: auto; padding-top: 4px; }
.adm-ai-chip { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; background: #fff; border: 1px solid var(--adm-border); border-radius: 999px; font-size: 12px; cursor: pointer; }
.adm-ai-review-split { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(280px, 1fr); gap: 18px; align-items: start; }
.adm-ai-editor-col, .adm-ai-sublist { display: flex; flex-direction: column; gap: 12px; }
.adm-ai-facts-aside { position: sticky; top: 16px; border: 1px solid var(--adm-border); border-radius: var(--adm-radius); background: #f9fafd; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.adm-ai-facts-aside ol, .adm-ai-facts-aside ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
.adm-ai-topic-pill { background: #eef2ff; color: var(--adm-primary); padding: 8px 10px; border-radius: var(--adm-radius); font-weight: 600; font-size: 13px; }
.adm-ai-fact-table { display: flex; flex-direction: column; gap: 6px; }
.adm-ai-fact-item { display: flex; justify-content: space-between; gap: 10px; padding: 6px 8px; background: #fff; border: 1px solid var(--adm-border); border-radius: 4px; font-size: 12px; }
.adm-ai-status-ok { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
@media (max-width: 960px) { .adm-ai-review-split { grid-template-columns: 1fr; } .adm-ai-facts-aside { position: static; } }
`;

const JOB_STATUS_LABELS = { queued: '排队中', running: '运行中', succeeded: '成功', failed: '失败' };

function ensureModuleStyles() {
  if (document.getElementById('adm-ai-studio-styles')) return;
  const styleEl = Object.assign(document.createElement('style'), {
    id: 'adm-ai-studio-styles',
    textContent: AI_STUDIO_CSS,
  });
  document.head.appendChild(styleEl);
}

function renderAiStatusBanner(bannerHost, aiStatus) {
  bannerHost.innerHTML = '';
  const configured = Boolean(aiStatus?.configured);
  const alert = Object.assign(document.createElement('div'), {
    className: `adm-alert ${configured ? 'adm-ai-status-ok' : 'adm-alert--warn'}`,
  });
  alert.textContent = configured
    ? `AI 引擎已就绪（${aiStatus.provider}）：${aiStatus.reason}`
    : `AI 生成已停用（${aiStatus?.reason || '未配置 AI_PROVIDER'}）—— 选题 Brief 保存与 AI 草稿审核队列仍可正常使用。`;
  bannerHost.appendChild(alert);
}

function openJobLogModal(jobId) {
  openDialog({
    title: `生成任务日志 · #${jobId.slice(0, 8)}`,
    renderBody: async (body) => {
      const pre = Object.assign(document.createElement('pre'), { className: 'adm-code', textContent: '正在读取日志…' });
      body.appendChild(pre);
      const res = await adminApi.get(`/jobs/${encodeURIComponent(jobId)}`);
      pre.textContent = (res.job?.logs || []).join('\n') || '暂无日志输出。';
    },
  });
}

function renderRecentJobsPanel(host, overview) {
  host.innerHTML = '';
  const card = Object.assign(document.createElement('section'), { className: 'adm-ai-card' });
  card.appendChild(Object.assign(document.createElement('h3'), { textContent: `近期 AI 生成任务（${overview.recentJobs.length}）` }));
  const tableHost = document.createElement('div');
  card.appendChild(tableHost);
  renderDataTable(tableHost, {
    rows: overview.recentJobs || [],
    columns: [
      { key: 'title', label: '任务' },
      { key: 'status', label: '状态', render: (r) => JOB_STATUS_LABELS[r.status] || r.status },
      { key: 'createdBy', label: '发起人', render: (r) => r.createdBy?.displayName || '-' },
      { key: 'createdAt', label: '提交时间', render: (r) => String(r.createdAt || '').slice(0, 19).replace('T', ' ') },
      {
        key: 'logs',
        label: '详情',
        sortable: false,
        render: (r) => {
          const btn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '查看日志' });
          btn.addEventListener('click', () => openJobLogModal(r.id));
          return btn;
        },
      },
    ],
  });
  host.appendChild(card);
}

function createStudioHeader(siteId) {
  const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  const title = Object.assign(document.createElement('h2'), { textContent: `AI 内容生产工作台 · ${siteId}` });
  const rightBar = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const tabDraftsBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline is-active' });
  const tabBriefsBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline' });
  const tabJobsBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline' });
  const refreshBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--ghost', textContent: '刷新' });
  rightBar.append(tabDraftsBtn, tabBriefsBtn, tabJobsBtn, refreshBtn);
  head.append(title, rightBar);
  return { head, tabDraftsBtn, tabBriefsBtn, tabJobsBtn, refreshBtn };
}

export async function mount(container, shellCtx) {
  ensureModuleStyles();
  container.innerHTML = '';
  let activeTab = 'drafts';
  let latestOverview = null;
  const { head, tabDraftsBtn, tabBriefsBtn, tabJobsBtn, refreshBtn } = createStudioHeader(shellCtx.siteId);
  const bannerHost = document.createElement('div');
  const bodyHost = document.createElement('div');
  container.append(head, bannerHost, bodyHost);

  const renderActiveTab = () => {
    if (!latestOverview) return;
    tabDraftsBtn.textContent = `草稿审核队列 (${latestOverview.drafts.length})`;
    tabBriefsBtn.textContent = `选题 Brief 与生成 (${latestOverview.briefs.length})`;
    tabJobsBtn.textContent = `生成任务 (${latestOverview.recentJobs.length})`;
    for (const [b, id] of [[tabDraftsBtn, 'drafts'], [tabBriefsBtn, 'briefs'], [tabJobsBtn, 'jobs']]) {
      b.className = `adm-btn ${activeTab === id ? 'adm-btn--primary' : 'adm-btn--outline'}`;
    }
    if (activeTab === 'briefs') renderBriefStudioPanel(bodyHost, { overview: latestOverview, shellCtx, onReload: reloadAll });
    else if (activeTab === 'jobs') renderRecentJobsPanel(bodyHost, latestOverview);
    else renderDraftReviewPanel(bodyHost, { overview: latestOverview, shellCtx, onReload: reloadAll });
  };

  async function reloadAll() {
    latestOverview = await adminApi.get(`/ai-studio/overview?siteId=${encodeURIComponent(shellCtx.siteId)}`);
    renderAiStatusBanner(bannerHost, latestOverview.aiStatus);
    renderActiveTab();
  }

  tabDraftsBtn.addEventListener('click', () => { activeTab = 'drafts'; renderActiveTab(); });
  tabBriefsBtn.addEventListener('click', () => { activeTab = 'briefs'; renderActiveTab(); });
  tabJobsBtn.addEventListener('click', () => { activeTab = 'jobs'; renderActiveTab(); });
  bindAsyncButton(refreshBtn, reloadAll, { onError: (e) => showToast(e.message, 'error') });
  await reloadAll();
}
