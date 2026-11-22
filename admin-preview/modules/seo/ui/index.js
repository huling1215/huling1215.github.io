import { adminApi, bindAsyncButton, renderDataTable, showToast } from '/ui/kit/index.js';
import { renderRedirectsPane } from './redirects-pane.js';
import { openSeoOverrideDialog } from './serp-dialog.js';

const SEO_COLLECTION_OPTIONS = [
  { value: 'all', label: '全部可配置集合' },
  { value: 'resorts', label: '目的地（resorts）' },
  { value: 'stays', label: '酒店（stays）' },
  { value: 'packages', label: '套餐（packages）' },
  { value: 'guides', label: '攻略（guides）' },
  { value: 'collections', label: '合集（collections）' },
  { value: 'regions', label: '区域（regions）' },
  { value: 'pages', label: '独立页面（pages）' },
];

function ensureSeoStyles() {
  if (document.getElementById('admSeoStyles')) return;
  const link = Object.assign(document.createElement('link'), {
    id: 'admSeoStyles',
    rel: 'stylesheet',
    href: '/modules/seo/ui/seo.css',
  });
  document.head.appendChild(link);
}

async function triggerSharedIndexPush(shellCtx) {
  try {
    const res = await adminApi.post('/release/push-index', { siteId: shellCtx.siteId });
    const jobHint = res?.job?.id ? `（任务 #${res.job.id.slice(0, 8)}）` : '';
    showToast(`已通过发布中心共用接口提交收录推送${jobHint}`, 'success');
  } catch (err) {
    if (err?.code === 'ROUTE_NOT_FOUND' || err?.statusCode === 404) {
      shellCtx.navigate('release');
      showToast('已跳转至发布中心执行共用推送收录流程', 'info');
      return;
    }
    throw err;
  }
}

function buildSeoEntryColumns(shellCtx, canWrite, reload) {
  return [
    { key: 'collection', label: '集合' },
    { key: 'slug', label: 'Slug' },
    { key: 'titleZh', label: '中文标题' },
    { key: 'urlPath', label: '默认路径' },
    { key: 'hasSeoOverride', label: 'SEO 覆写', render: (r) => (r.hasSeoOverride ? '已覆写' : '默认') },
    { key: 'noindex', label: '索引控制', render: (r) => (r.noindex === true ? 'noindex' : '允许收录') },
    {
      key: 'actions',
      label: '操作',
      sortable: false,
      render: (r) => {
        const btn = Object.assign(document.createElement('button'), {
          type: 'button',
          className: 'adm-btn adm-btn--outline adm-btn--sm',
          textContent: 'SEO 覆写 & 预览',
        });
        bindAsyncButton(btn, () =>
          openSeoOverrideDialog(shellCtx.siteId, r.collection, r.slug, canWrite, async () => {
            await shellCtx.refreshShell();
            await reload();
          }),
        );
        return btn;
      },
    },
  ];
}

async function renderSeoEntriesPane(hostEl, shellCtx, canWrite) {
  hostEl.innerHTML = '';
  const filterBar = Object.assign(document.createElement('div'), { className: 'adm-filter-grid' });
  const colSel = Object.assign(document.createElement('select'), { className: 'adm-input' });
  for (const opt of SEO_COLLECTION_OPTIONS) {
    colSel.appendChild(Object.assign(document.createElement('option'), { value: opt.value, textContent: opt.label }));
  }
  const onlyOverridden = Object.assign(document.createElement('input'), { type: 'checkbox' });
  const checkWrap = Object.assign(document.createElement('label'), { className: 'adm-inline-actions adm-muted' });
  checkWrap.append(onlyOverridden, document.createTextNode('仅显示已设置 SEO 覆写条目'));
  filterBar.append(colSel, checkWrap);

  const tableHost = document.createElement('div');
  hostEl.append(filterBar, tableHost);

  const reload = async () => {
    const res = await adminApi.get(
      `/seo/entries?siteId=${encodeURIComponent(shellCtx.siteId)}&collection=${encodeURIComponent(colSel.value)}`,
    );
    const rows = (res.items || []).filter((r) => (!onlyOverridden.checked ? true : r.hasSeoOverride));
    renderDataTable(tableHost, {
      rows,
      filterPlaceholder: '按 slug、中文标题或 URL 路径检索…',
      columns: buildSeoEntryColumns(shellCtx, canWrite, reload),
    });
  };
  colSel.addEventListener('change', reload);
  onlyOverridden.addEventListener('change', reload);
  await reload();
}

export async function mount(container, shellCtx) {
  ensureSeoStyles();
  container.innerHTML = '';
  const canWrite = Boolean(shellCtx.user?.permissions?.includes('seo:write') || shellCtx.user?.roles?.includes('admin'));
  const canPushIndex = Boolean(shellCtx.user?.permissions?.includes('release:publish') || shellCtx.user?.roles?.includes('admin'));

  const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  head.appendChild(Object.assign(document.createElement('h2'), { textContent: `SEO 与 301 跳转 · ${shellCtx.siteId}` }));

  const rightBar = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const pushBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--primary',
    textContent: '推送搜索引擎收录',
    disabled: !canPushIndex,
    title: canPushIndex ? '调用发布中心共用收录推送接口（百度 + IndexNow）' : '需要发布权限（release:publish）才能推送收录',
  });
  bindAsyncButton(pushBtn, () => triggerSharedIndexPush(shellCtx), {
    onError: (err) => showToast(err.message || '推送收录失败', 'error'),
  });
  rightBar.appendChild(pushBtn);
  head.appendChild(rightBar);

  const tabBar = Object.assign(document.createElement('div'), { className: 'seo-tabs' });
  const seoTabBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'seo-tab is-active', textContent: '单页 SEO 覆写与 SERP 预览' });
  const redirTabBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'seo-tab', textContent: '301 / 302 跳转规则' });
  tabBar.append(seoTabBtn, redirTabBtn);

  const paneHost = document.createElement('div');
  seoTabBtn.addEventListener('click', () => {
    seoTabBtn.classList.add('is-active');
    redirTabBtn.classList.remove('is-active');
    renderSeoEntriesPane(paneHost, shellCtx, canWrite);
  });
  redirTabBtn.addEventListener('click', () => {
    redirTabBtn.classList.add('is-active');
    seoTabBtn.classList.remove('is-active');
    renderRedirectsPane(paneHost, shellCtx, canWrite);
  });

  container.append(head, tabBar, paneHost);
  await renderSeoEntriesPane(paneHost, shellCtx, canWrite);
}
