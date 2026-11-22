import {
  adminApi,
  bindAsyncButton,
  createI18nEditor,
  openDialog,
  renderDataTable,
  renderDiffView,
  html,
  showToast,
} from '/ui/kit/index.js';

const COLLECTION_OPTIONS = [
  { value: 'all', label: '全部集合' },
  { value: 'resorts', label: '目的地（resorts）' },
  { value: 'stays', label: '酒店（stays）' },
  { value: 'packages', label: '套餐（packages）' },
  { value: 'guides', label: '攻略（guides）' },
  { value: 'collections', label: '合集（collections）' },
  { value: 'regions', label: '区域（regions）' },
  { value: 'authors', label: '作者（authors）' },
  { value: 'pages', label: '静态页面（pages）' },
];

async function showHistoryDialog(siteId, collection, slug, reloadList) {
  const res = await adminApi.get(`/content/history/${collection}/${slug}?siteId=${encodeURIComponent(siteId)}`);
  openDialog({
    title: `版本历史 · ${collection}/${slug}`,
    renderBody: (body) => {
      if (!res.commits?.length) {
        body.textContent = '暂无 Git 提交历史。';
        return;
      }
      for (const c of res.commits) {
        const row = Object.assign(document.createElement('div'), { className: 'adm-history-row' });
        const meta = Object.assign(document.createElement('div'), {
          innerHTML: html`<strong>${c.commit.slice(0, 8)}</strong> · ${c.authorName} · <span class="adm-muted">${c.date.slice(0, 19).replace('T', ' ')}</span><div>${c.subject}</div>`,
        });
        const actions = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
        const diffBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '查看差异' });
        const revBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '恢复此版本' });
        bindAsyncButton(diffBtn, async () => {
          const d = await adminApi.get(`/content/diff?from=${c.commit}&to=HEAD&path=${encodeURIComponent(res.relPath)}`);
          openDialog({ title: `差异对比 ${c.commit.slice(0, 8)}..HEAD`, renderBody: (b) => renderDiffView(b, d.diff) });
        });
        bindAsyncButton(revBtn, async () => {
          await adminApi.post('/content/revert', { relPath: res.relPath, commit: c.commit });
          showToast('已恢复到所选历史版本并生成新提交', 'success');
          await reloadList();
        });
        actions.append(diffBtn, revBtn);
        row.append(meta, actions);
        body.appendChild(row);
      }
    },
  });
}

function renderEntryEditorBody(body, dataCopy, canPublish) {
  const titleFieldKey = dataCopy.title ? 'title' : 'name';
  const modeSwitch = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const basicBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm is-active', textContent: '结构化模式' });
  const advBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '高级模式（JSON）' });
  modeSwitch.append(basicBtn, advBtn);

  const basicPane = document.createElement('div');
  const slugInput = Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', value: dataCopy.slug || '', name: 'slug' });
  const statusSel = Object.assign(document.createElement('select'), { className: 'adm-input', disabled: !canPublish });
  for (const st of [{ v: 'published', l: '已上线 (published)' }, { v: 'offline', l: '草稿/下线 (offline)' }]) {
    statusSel.appendChild(Object.assign(document.createElement('option'), { value: st.v, textContent: st.l, selected: dataCopy.status === st.v }));
  }
  const advPane = Object.assign(document.createElement('div'), { hidden: true });
  const jsonArea = Object.assign(document.createElement('textarea'), { className: 'adm-textarea adm-code', rows: 14, value: JSON.stringify(dataCopy, null, 2) });
  advPane.appendChild(jsonArea);

  slugInput.addEventListener('input', () => { dataCopy.slug = slugInput.value.trim(); jsonArea.value = JSON.stringify(dataCopy, null, 2); });
  statusSel.addEventListener('change', () => { dataCopy.status = statusSel.value; jsonArea.value = JSON.stringify(dataCopy, null, 2); });
  const titleEditor = createI18nEditor({
    value: dataCopy[titleFieldKey] || {},
    translations: dataCopy.translations || {},
    onChange: (val) => { dataCopy[titleFieldKey] = val; jsonArea.value = JSON.stringify(dataCopy, null, 2); },
  });
  basicPane.append(
    Object.assign(document.createElement('label'), { className: 'adm-label', textContent: '条目 Slug（修改保存后将自动生成 301 跳转规则）' }),
    slugInput,
    Object.assign(document.createElement('label'), { className: 'adm-label', textContent: canPublish ? '发布状态' : '发布状态（编辑角色自动保存为草稿）' }),
    statusSel,
    Object.assign(document.createElement('label'), { className: 'adm-label', textContent: '多语言标题 / 名称' }),
    titleEditor.el,
  );

  basicBtn.addEventListener('click', () => { basicPane.hidden = false; advPane.hidden = true; });
  advBtn.addEventListener('click', () => { basicPane.hidden = true; advPane.hidden = false; jsonArea.value = JSON.stringify(dataCopy, null, 2); });
  body.append(modeSwitch, basicPane, advPane);
  body._getPayload = () => (advPane.hidden ? dataCopy : JSON.parse(jsonArea.value));
}

function openEntryEditorDialog(detail, shellCtx, reloadList) {
  const canPublish = shellCtx.user?.permissions?.includes('content:publish');
  const dataCopy = structuredClone(detail.data || {});
  openDialog({
    title: `编辑条目 · ${detail.collection}/${detail.slug}`,
    confirmLabel: canPublish ? '保存并提交 Git' : '保存草稿并提交 Git',
    renderBody: (body) => renderEntryEditorBody(body, dataCopy, canPublish),
    onConfirm: async ({ body }) => {
      const res = await adminApi.put(`/content/entries/${detail.collection}/${detail.slug}`, {
        siteId: shellCtx.siteId,
        data: body._getPayload(),
      });
      showToast(`已保存并生成提交 ${res.commitHash.slice(0, 8)}`, 'success');
      await shellCtx.refreshShell();
      await reloadList();
    },
  });
}

async function loadAndRenderEntries(tableHost, shellCtx, collectionVal) {
  const res = await adminApi.get(
    `/content/entries?siteId=${encodeURIComponent(shellCtx.siteId)}&collection=${encodeURIComponent(collectionVal)}`,
  );
  renderDataTable(tableHost, {
    rows: res.items || [],
    filterPlaceholder: '按 slug、中文名、英文名或国家筛选…',
    columns: [
      { key: 'collection', label: '集合' },
      { key: 'slug', label: 'Slug' },
      { key: 'titleZh', label: '中文标题' },
      { key: 'status', label: '状态', render: (r) => (r.status === 'published' ? '已上线' : '草稿/下线') },
      { key: 'sample', label: '草稿标识', render: (r) => (r.sample ? '草稿' : '正式') },
      { key: 'updatedAt', label: '更新日期' },
      {
        key: 'actions',
        label: '操作',
        sortable: false,
        render: (r) => {
          const wrap = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
          const editBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '编辑' });
          const histBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '历史' });
          bindAsyncButton(editBtn, async () => {
            const detail = await adminApi.get(`/content/entries/${r.collection}/${r.slug}?siteId=${encodeURIComponent(shellCtx.siteId)}`);
            openEntryEditorDialog(detail, shellCtx, () => loadAndRenderEntries(tableHost, shellCtx, collectionVal));
          });
          bindAsyncButton(histBtn, () =>
            showHistoryDialog(shellCtx.siteId, r.collection, r.slug, () => loadAndRenderEntries(tableHost, shellCtx, collectionVal)),
          );
          wrap.append(editBtn, histBtn);
          return wrap;
        },
      },
    ],
  });
}

export async function mount(container, shellCtx) {
  container.innerHTML = '';
  const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  const title = Object.assign(document.createElement('h2'), { textContent: `内容管理 · ${shellCtx.siteId}` });
  const rightBar = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });

  const colSelect = Object.assign(document.createElement('select'), { className: 'adm-input' });
  for (const opt of COLLECTION_OPTIONS) {
    colSelect.appendChild(Object.assign(document.createElement('option'), { value: opt.value, textContent: opt.label }));
  }

  const buildBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--primary',
    textContent: '触发站点构建',
    disabled: !shellCtx.user?.permissions?.includes('release:publish'),
  });
  bindAsyncButton(buildBtn, async () => {
    const res = await adminApi.post('/content/build', { siteId: shellCtx.siteId });
    showToast(`已提交构建任务 #${res.job.id.slice(0, 8)}`, 'success');
    shellCtx.navigate('jobs');
  });

  rightBar.append(colSelect, buildBtn);
  head.append(title, rightBar);
  const tableHost = document.createElement('div');
  container.append(head, tableHost);
  colSelect.addEventListener('change', () => loadAndRenderEntries(tableHost, shellCtx, colSelect.value));
  await loadAndRenderEntries(tableHost, shellCtx, 'all');
}
