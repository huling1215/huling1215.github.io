import {
  adminApi,
  bindAsyncButton,
  openDialog,
  renderDataTable,
  renderForm,
  showToast,
} from '/ui/kit/index.js';

function openCreateUserDialog(rolesMeta, reload) {
  openDialog({
    title: '新增运营账号',
    renderBody: (body) => {
      renderForm(body, {
        submitLabel: '创建账号',
        fields: [
          { name: 'username', label: '用户名', required: true, placeholder: '例如：lin_editor' },
          { name: 'displayName', label: '显示名', required: true, placeholder: '例如：林编辑' },
          { name: 'password', label: '初始密码（至少 8 位）', type: 'password', required: true },
          {
            name: 'rolesText',
            label: '分配角色（多个用英文逗号分隔）',
            required: true,
            placeholder: rolesMeta.map((r) => r.id).join(','),
          },
        ],
        initialValues: { rolesText: 'editor' },
        onSubmit: async (vals) => {
          const roles = vals.rolesText.split(',').map((s) => s.trim()).filter(Boolean);
          await adminApi.post('/users', {
            username: vals.username,
            displayName: vals.displayName,
            password: vals.password,
            roles,
          });
          showToast('账号创建成功', 'success');
          body.closest('.adm-dialog-backdrop')?.remove();
          await reload();
        },
      });
    },
  });
}

function renderUserActions(row, reload) {
  const wrap = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const toggleBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--outline adm-btn--sm',
    textContent: row.enabled ? '停用' : '启用',
  });
  const resetBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--ghost adm-btn--sm',
    textContent: '重置密码',
  });
  bindAsyncButton(toggleBtn, async () => {
    await adminApi.post(`/users/${encodeURIComponent(row.username)}/toggle`, { enabled: !row.enabled });
    showToast(`账号状态已更新`, 'success');
    await reload();
  }, { onError: (err) => showToast(err.message, 'error') });

  resetBtn.addEventListener('click', () => {
    let inp;
    openDialog({
      title: `重置密码 · ${row.displayName}`,
      confirmLabel: '确认重置',
      renderBody: (b) => {
        inp = Object.assign(document.createElement('input'), { type: 'password', className: 'adm-input', placeholder: '输入至少 8 位新密码' });
        b.appendChild(inp);
      },
      onConfirm: async () => {
        await adminApi.post(`/users/${encodeURIComponent(row.username)}/reset-password`, { newPassword: inp.value });
        showToast('密码已重置', 'success');
      },
    });
  });
  wrap.append(toggleBtn, resetBtn);
  return wrap;
}

export async function mount(container) {
  container.innerHTML = '';
  const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  const title = Object.assign(document.createElement('h2'), { textContent: '账号与角色权限管理' });
  const addBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--primary', textContent: '新增运营账号' });
  head.append(title, addBtn);

  const tableHost = document.createElement('div');
  container.append(head, tableHost);

  async function reload() {
    const data = await adminApi.get('/users');
    addBtn.onclick = () => openCreateUserDialog(data.roles || [], reload);
    renderDataTable(tableHost, {
      rows: data.users || [],
      columns: [
        { key: 'username', label: '用户名' },
        { key: 'displayName', label: '显示名' },
        { key: 'roles', label: '角色', render: (r) => r.roles.join(', ') },
        { key: 'enabled', label: '状态', render: (r) => (r.enabled ? '启用' : '已停用') },
        { key: 'lastLoginAt', label: '最后登录', render: (r) => (r.lastLoginAt ? r.lastLoginAt.slice(0, 19).replace('T', ' ') : '从未') },
        { key: 'ops', label: '操作', sortable: false, render: (r) => renderUserActions(r, reload) },
      ],
    });
  }
  await reload();
}
