import { adminApi, bindAsyncButton, openDialog, renderDataTable } from '/ui/kit/index.js';

const STATUS_LABELS = {
  queued: '排队中',
  running: '运行中',
  succeeded: '成功',
  failed: '失败',
};

function openJobLogViewer(jobId) {
  openDialog({
    title: `任务实时日志 · #${jobId.slice(0, 8)}`,
    renderBody: (body) => {
      const pre = Object.assign(document.createElement('pre'), { className: 'adm-code', textContent: '正在连接实时日志流…\n' });
      body.appendChild(pre);
      const es = new EventSource(`/api/admin/jobs/${encodeURIComponent(jobId)}/stream`);
      es.addEventListener('init', (evt) => {
        const snap = JSON.parse(evt.data);
        pre.textContent = `${(snap.logs || []).join('\n')}\n`;
      });
      es.addEventListener('log', (evt) => {
        const { line } = JSON.parse(evt.data);
        pre.textContent += `${line}\n`;
        pre.scrollTop = pre.scrollHeight;
      });
      es.addEventListener('status', (evt) => {
        const snap = JSON.parse(evt.data);
        if (snap.status === 'succeeded' || snap.status === 'failed') es.close();
      });
      es.onerror = () => es.close();
    },
  });
}

export async function mount(container) {
  container.innerHTML = '';
  const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  const title = Object.assign(document.createElement('h2'), { textContent: '后台串行任务队列' });
  const refreshBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline', textContent: '刷新列表' });
  head.append(title, refreshBtn);

  const tableHost = document.createElement('div');
  container.append(head, tableHost);

  async function loadJobs() {
    const res = await adminApi.get('/jobs');
    renderDataTable(tableHost, {
      rows: res.items || [],
      columns: [
        { key: 'title', label: '任务名称' },
        { key: 'type', label: '类型' },
        { key: 'status', label: '状态', render: (r) => STATUS_LABELS[r.status] || r.status },
        { key: 'createdBy', label: '发起人', render: (r) => r.createdBy?.displayName || '-' },
        { key: 'createdAt', label: '创建时间', render: (r) => r.createdAt.slice(0, 19).replace('T', ' ') },
        {
          key: 'logs',
          label: '日志',
          sortable: false,
          render: (r) => {
            const btn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '查看脱敏日志' });
            btn.addEventListener('click', () => openJobLogViewer(r.id));
            return btn;
          },
        },
      ],
    });
  }

  bindAsyncButton(refreshBtn, loadJobs);
  await loadJobs();
}
