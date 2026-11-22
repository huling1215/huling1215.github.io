import { adminApi, bindAsyncButton, renderDataTable } from '/ui/kit/index.js';

export async function mount(container) {
  container.innerHTML = '';
  const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  head.appendChild(Object.assign(document.createElement('h2'), { textContent: '操作审计日志（只追加 · 不可删除）' }));

  const filterBar = Object.assign(document.createElement('div'), { className: 'adm-filter-grid' });
  const userInp = Object.assign(document.createElement('input'), { className: 'adm-input', placeholder: '按用户筛选…' });
  const targetInp = Object.assign(document.createElement('input'), { className: 'adm-input', placeholder: '按对象/条目筛选…' });
  const fromInp = Object.assign(document.createElement('input'), { type: 'date', className: 'adm-input' });
  const toInp = Object.assign(document.createElement('input'), { type: 'date', className: 'adm-input' });
  const queryBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--primary', textContent: '筛选日志' });
  filterBar.append(userInp, targetInp, fromInp, toInp, queryBtn);

  const tableHost = document.createElement('div');
  container.append(head, filterBar, tableHost);

  async function loadLogs() {
    const qs = new URLSearchParams({
      user: userInp.value.trim(),
      target: targetInp.value.trim(),
      from: fromInp.value,
      to: toInp.value,
      limit: '200',
    });
    const data = await adminApi.get(`/audit?${qs.toString()}`);
    renderDataTable(tableHost, {
      rows: data.items || [],
      searchable: false,
      columns: [
        { key: 'timestamp', label: '时间', render: (r) => r.timestamp.slice(0, 19).replace('T', ' ') },
        { key: 'displayName', label: '操作人', render: (r) => `${r.displayName} (${r.user})` },
        { key: 'action', label: '动作' },
        { key: 'target', label: '对象' },
        { key: 'summary', label: '摘要' },
        { key: 'commitHash', label: 'Git 提交', render: (r) => (r.commitHash ? r.commitHash.slice(0, 8) : '-') },
      ],
    });
  }

  bindAsyncButton(queryBtn, loadLogs);
  await loadLogs();
}
