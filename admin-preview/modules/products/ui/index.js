import {
  adminApi,
  bindAsyncButton,
  openDialog,
  renderDataTable,
  showToast,
} from '/ui/kit/index.js';
import { h, injectProductsStyles } from './dom-helpers.js';
import { renderProductEditorView } from './editor-modal.js';

function createInitialDraft(collection, meta, username) {
  const today = new Date().toISOString().slice(0, 10);
  const firstDest = meta.destinations?.[0]?.slug || '';
  const base = {
    slug: '',
    status: 'offline',
    sourceType: 'editorial',
    sample: true,
    updatedAt: today,
    verification: { verifiedBy: username || 'admin', verifiedAt: today, source: { 'zh-CN': '运营后台核验录入' } },
    resort: firstDest,
    name: { 'zh-CN': '' },
    summary: { 'zh-CN': '' },
    highlights: [],
    faq: [],
    booking: { provider: meta.booking?.defaultProvider || 'inquiry' },
  };
  if (collection === 'stays') {
    return {
      ...base,
      skiInOut: false,
      liftDistanceM: 200,
      price: { amount: 1800, currency: 'CNY', unit: 'night' },
      rooms: [{ name: { 'zh-CN': '标准双床房' }, areaSqm: 32, maxGuests: 2, priceCny: 1800 }],
      amenities: ['wifi'],
      kidsClub: false,
    };
  }
  return {
    ...base,
    days: 5,
    level: 'beginner',
    includes: [{ 'zh-CN': '住宿与行程内核心项目' }],
    excludes: [{ 'zh-CN': '往返大交通费用' }],
    price: { amount: 4980, currency: 'CNY', unit: 'person' },
    departures: [],
  };
}

function renderFilterBar(filters, meta, onChange) {
  const destLabel = meta.vertical?.entitySingularZh || '目的地';
  const colSel = h('select', { className: 'adm-input' }, [
    h('option', { value: 'all', textContent: '全部类型（酒店+套餐）', selected: filters.collection === 'all' }),
    h('option', { value: 'stays', textContent: '仅酒店（stays）', selected: filters.collection === 'stays' }),
    h('option', { value: 'packages', textContent: '仅套餐（packages）', selected: filters.collection === 'packages' }),
  ]);
  const destSel = h('select', { className: 'adm-input' }, [h('option', { value: 'all', textContent: `全部${destLabel}` })]);
  for (const d of meta.destinations || []) {
    destSel.appendChild(h('option', { value: d.slug, textContent: `${d.nameZh} (${d.slug})`, selected: filters.destination === d.slug }));
  }
  const stateSel = h('select', { className: 'adm-input' }, [
    h('option', { value: 'all', textContent: '全部状态', selected: filters.state === 'all' }),
    h('option', { value: 'draft', textContent: '草稿（sample: true）', selected: filters.state === 'draft' }),
    h('option', { value: 'online', textContent: '已上线（正式）', selected: filters.state === 'online' }),
    h('option', { value: 'offline', textContent: '已下线（offline）', selected: filters.state === 'offline' }),
  ]);
  const promoSel = h('select', { className: 'adm-input' }, [
    h('option', { value: 'all', textContent: '转正条件：全部', selected: filters.promotable === 'all' }),
    h('option', { value: 'yes', textContent: '满足条件可转正', selected: filters.promotable === 'yes' }),
    h('option', { value: 'no', textContent: '缺条件待完善', selected: filters.promotable === 'no' }),
  ]);
  const qInp = h('input', { type: 'search', className: 'adm-input', value: filters.q, placeholder: '搜名称 / Slug…' });

  colSel.addEventListener('change', () => { filters.collection = colSel.value; onChange(); });
  destSel.addEventListener('change', () => { filters.destination = destSel.value; onChange(); });
  stateSel.addEventListener('change', () => { filters.state = stateSel.value; onChange(); });
  promoSel.addEventListener('change', () => { filters.promotable = promoSel.value; onChange(); });
  qInp.addEventListener('input', () => { filters.q = qInp.value.trim(); onChange(); });
  return h('div', { className: 'adm-filter-grid' }, [colSel, destSel, stateSel, promoSel, qInp]);
}

function renderBatchBar(selectedMap, currentItems, meta, shellCtx, reloadList) {
  const canPublish = Boolean(meta.permissions?.canPublish);
  const countEl = h('strong', { textContent: `已勾选 ${selectedMap.size} 项` });
  const selectAllBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '全选当前筛选结果' });
  const clearBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '清空勾选' });
  const onlineBtn = h('button', {
    type: 'button',
    className: 'adm-btn adm-btn--primary adm-btn--sm',
    textContent: '批量转正上架',
    disabled: !canPublish,
    title: canPublish ? '将勾选项转正为正式上线产品' : '缺少 products:publish 权限，无法批量上架',
  });
  const offlineBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '批量下架' });

  selectAllBtn.addEventListener('click', () => {
    for (const it of currentItems) selectedMap.set(`${it.collection}:${it.slug}`, { collection: it.collection, slug: it.slug });
    reloadList(false);
  });
  clearBtn.addEventListener('click', () => { selectedMap.clear(); reloadList(false); });

  const runBatch = async (action) => {
    if (selectedMap.size === 0) throw new Error('请先勾选至少一条产品');
    const res = await adminApi.post('/products/batch-status', {
      siteId: shellCtx.siteId,
      action,
      items: Array.from(selectedMap.values()),
    });
    selectedMap.clear();
    showToast(`批量${action === 'online' ? '上架' : '下架'}成功，已生成 ${res.updatedCount} 个提交`, 'success');
    await shellCtx.refreshShell();
    await reloadList(true);
  };
  bindAsyncButton(onlineBtn, () => runBatch('online'), { onError: (e) => showToast(e.message, 'error') });
  bindAsyncButton(offlineBtn, () => runBatch('offline'), { onError: (e) => showToast(e.message, 'error') });

  return h('div', { className: 'prd-batch-bar' }, [
    h('div', { className: 'adm-inline-actions' }, [countEl, selectAllBtn, clearBtn]),
    h('div', { className: 'adm-inline-actions' }, [onlineBtn, offlineBtn]),
  ]);
}

async function openProductHistoryDialog(siteId, collection, slug) {
  const res = await adminApi.get(`/products/history/${collection}/${encodeURIComponent(slug)}?siteId=${encodeURIComponent(siteId)}`);
  openDialog({
    title: `版本提交历史 · ${collection}/${slug}`,
    renderBody: (body) => {
      if (!res.commits?.length) { body.textContent = '暂无 Git 历史提交记录。'; return; }
      for (const c of res.commits) {
        body.appendChild(
          h('div', { className: 'adm-history-row' }, [
            h('div', {}, [
              h('strong', { textContent: `${c.commit.slice(0, 8)} · ${c.authorName} ` }),
              h('span', { className: 'adm-muted', textContent: c.date.slice(0, 19).replace('T', ' ') }),
              h('div', { textContent: c.subject }),
            ]),
          ]),
        );
      }
    },
  });
}

function renderPromoBadgeCell(row) {
  const ok = row.promotion?.eligible;
  const badge = h('span', {
    className: `adm-badge ${ok ? 'adm-badge--reviewed' : 'adm-badge--missing'}`,
    textContent: ok ? '✓ 可转正' : `✕ 缺 ${row.promotion?.missingRequirements?.length || 1} 项`,
  });
  if (!ok) badge.title = (row.promotion?.missingRequirements || []).join('；');
  return badge;
}

function renderRowOpsCell(row, siteId, onEditRow) {
  const editBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '编辑' });
  const histBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '历史' });
  bindAsyncButton(editBtn, () => onEditRow(row));
  bindAsyncButton(histBtn, () => openProductHistoryDialog(siteId, row.collection, row.slug));
  return h('div', { className: 'adm-inline-actions' }, [editBtn, histBtn]);
}

function buildProductColumns({ destLabel, selectedMap, onToggleSelect, onEditRow, siteId }) {
  return [
    {
      key: 'pick',
      label: '选择',
      sortable: false,
      render: (r) => {
        const key = `${r.collection}:${r.slug}`;
        const chk = h('input', { type: 'checkbox', checked: selectedMap.has(key) });
        chk.addEventListener('change', () => onToggleSelect(key, r, chk.checked));
        return chk;
      },
    },
    { key: 'collection', label: '类型', render: (r) => (r.collection === 'stays' ? '酒店' : `套餐(${r.departuresCount}期)`) },
    { key: 'nameZh', label: '产品名称 / Slug', render: (r) => h('div', {}, [h('strong', { textContent: r.nameZh }), h('div', { className: 'adm-muted', textContent: r.slug })]) },
    { key: 'destinationNameZh', label: `所属${destLabel}` },
    {
      key: 'stateLabel',
      label: '状态',
      render: (r) => h('span', { className: `prd-pill ${r.isOnline ? 'prd-pill--online' : r.isDraft ? 'prd-pill--draft' : 'prd-pill--offline'}`, textContent: r.stateLabel }),
    },
    { key: 'priceAmount', label: '价格(CNY)', render: (r) => (r.priceAmount ? `¥${r.priceAmount}/${r.priceUnit || ''}` : '询价') },
    { key: 'bookingProvider', label: '预订渠道', render: (r) => r.bookingProvider || '未配' },
    { key: 'promotable', label: '能否转正', render: renderPromoBadgeCell },
    { key: 'ops', label: '操作', sortable: false, render: (r) => renderRowOpsCell(r, siteId, onEditRow) },
  ];
}

function renderListHeader(shellCtx, canWrite, onNewStay, onNewPkg) {
  const newStayBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--outline', textContent: '+ 新建酒店', disabled: !canWrite, onClick: onNewStay });
  const newPkgBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--primary', textContent: '+ 新建套餐', disabled: !canWrite, onClick: onNewPkg });
  return h('div', { className: 'adm-section-head' }, [
    h('h2', { textContent: `产品运营（酒店与套餐）· ${shellCtx.siteId}` }),
    h('div', { className: 'adm-inline-actions' }, [newStayBtn, newPkgBtn]),
  ]);
}

async function drawProductListScreen(container, state, shellCtx, openEditor, refetch = true) {
  if (refetch) {
    const qs = new URLSearchParams({ siteId: shellCtx.siteId, ...state.filters });
    const res = await adminApi.get(`/products/entries?${qs.toString()}`);
    state.cachedItems = res.items || [];
  }
  container.innerHTML = '';
  const redraw = (flag = true) => drawProductListScreen(container, state, shellCtx, openEditor, flag);
  const head = renderListHeader(
    shellCtx,
    Boolean(state.meta.permissions?.canWrite),
    () => openEditor('stays', createInitialDraft('stays', state.meta, shellCtx.user?.username), null, true),
    () => openEditor('packages', createInitialDraft('packages', state.meta, shellCtx.user?.username), null, true),
  );
  const tableHost = h('div');
  renderDataTable(tableHost, {
    rows: state.cachedItems,
    searchable: false,
    pageSize: 15,
    columns: buildProductColumns({
      destLabel: state.meta.vertical?.entitySingularZh || '目的地',
      selectedMap: state.selectedMap,
      siteId: shellCtx.siteId,
      onToggleSelect: (key, row, checked) => {
        if (checked) state.selectedMap.set(key, { collection: row.collection, slug: row.slug });
        else state.selectedMap.delete(key);
        redraw(false);
      },
      onEditRow: async (row) => {
        const detail = await adminApi.get(`/products/entries/${row.collection}/${encodeURIComponent(row.slug)}?siteId=${encodeURIComponent(shellCtx.siteId)}`);
        await openEditor(row.collection, detail.data, detail.promotion, false);
      },
    }),
  });
  container.append(head, renderFilterBar(state.filters, state.meta, () => redraw(true)), renderBatchBar(state.selectedMap, state.cachedItems, state.meta, shellCtx, redraw), tableHost);
}

export async function mount(container, shellCtx) {
  injectProductsStyles();
  const state = {
    meta: await adminApi.get(`/products/meta?siteId=${encodeURIComponent(shellCtx.siteId)}`),
    filters: { collection: 'all', destination: 'all', state: 'all', promotable: 'all', q: '' },
    selectedMap: new Map(),
    cachedItems: [],
  };
  const openEditor = async (collection, detailData, promo, isCreate) => {
    await renderProductEditorView(container, {
      collection,
      initialData: detailData,
      initialPromo: promo,
      isCreate,
      meta: state.meta,
      shellCtx,
      onBack: async () => {
        state.meta = await adminApi.get(`/products/meta?siteId=${encodeURIComponent(shellCtx.siteId)}`);
        await drawProductListScreen(container, state, shellCtx, openEditor, true);
      },
    });
  };
  await drawProductListScreen(container, state, shellCtx, openEditor, true);
}
