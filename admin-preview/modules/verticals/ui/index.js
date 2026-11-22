import {
  adminApi,
  bindAsyncButton,
  confirmAction,
  createI18nEditor,
  showToast,
} from '/ui/kit/index.js';
import {
  renderAttributesSection,
  renderSectionsEditor,
  syncDerivedProfileSpecs,
} from './attr-editor.js';
import { renderLiveVerticalPreview } from './preview.js';

function ensureStylesheetLoaded() {
  if (document.getElementById('vcModuleStyles')) return;
  const link = Object.assign(document.createElement('link'), {
    id: 'vcModuleStyles',
    rel: 'stylesheet',
    href: '/modules/verticals/ui/styles.css',
  });
  document.head.appendChild(link);
}

function hasWritePermission(user) {
  if (!user || !Array.isArray(user.roles)) return false;
  return user.roles.includes('admin');
}

function buildBlankVerticalProfile() {
  return {
    id: 'trekking',
    name: { 'zh-CN': '徒步远征', en: 'Alpine Trekking', 'zh-Hant': '徒步遠征', ja: 'トレッキング', ko: '트레킹' },
    entityName: {
      singular: { 'zh-CN': '徒步路线', en: 'Trail', 'zh-Hant': '徒步路線', ja: 'トレイル', ko: '트레일' },
      plural: { 'zh-CN': '徒步路线', en: 'Trails', 'zh-Hant': '徒步路線', ja: 'トレイル一覧', ko: '트레일 목록' },
    },
    routeSegment: 'trails',
    storageDir: 'trails',
    schemaOrgType: 'TouristDestination',
    attributes: [
      {
        key: 'distanceKm', path: 'stats.distanceKm', type: 'number', format: 'decimal',
        unit: { 'zh-CN': 'km', en: 'km', 'zh-Hant': 'km', ja: 'km', ko: 'km' },
        label: { 'zh-CN': '全程里程', en: 'Total Distance', 'zh-Hant': '全程里程', ja: '総距離', ko: '총 거리' },
        required: true, translatable: false, filterable: true, comparable: true, showOnCard: true, order: 1,
      },
    ],
    sections: [
      { id: 'overview', enabled: true, order: 1, label: { 'zh-CN': '路线概览', en: 'Overview' } },
      { id: 'specs', enabled: true, order: 2, label: { 'zh-CN': '路线参数', en: 'Trail Specs' } },
      { id: 'faq', enabled: true, order: 3, label: { 'zh-CN': '常见问题', en: 'FAQ' } },
    ],
    filters: [{ key: 'country', attributeKey: 'country', widget: 'select', order: 1 }],
    compare: [{ attributeKey: 'distanceKm', order: 1 }],
    card: { statAttributeKeys: ['distanceKm'], badgeAttributeKeys: ['distanceKm'], showCoords: true, highlightLimit: 3 },
    features: { passes: false, compare: true },
  };
}

function appendMetaI18nRows(container, p, st) {
  const addI18nRow = (title, initial, onChange) => {
    const wrap = Object.assign(document.createElement('div'), { className: 'adm-field' });
    wrap.appendChild(Object.assign(document.createElement('label'), { className: 'adm-label', textContent: title }));
    const ed = createI18nEditor({ value: initial, onChange });
    wrap.appendChild(ed.el);
    container.appendChild(wrap);
  };
  addI18nRow('品类名称（5语言）*', p.name, (val) => { p.name = val; st.onSoftUpdate(); });
  addI18nRow('目的地实体单数名称（如：雪场 / 潜点度假区）*', p.entityName?.singular, (val) => { p.entityName.singular = val; st.onSoftUpdate(); });
  addI18nRow('目的地实体复数名称（如：雪场 / Dive Destinations）*', p.entityName?.plural, (val) => { p.entityName.plural = val; st.onSoftUpdate(); });
}

function renderBasicMetaPanel(container, st) {
  container.innerHTML = '';
  const p = st.profile;
  container.appendChild(Object.assign(document.createElement('h3'), { className: 'vc-panel__title', textContent: '品类基础标识与路由配置' }));

  const row1 = Object.assign(document.createElement('div'), { className: 'vc-grid-2' });
  const mkInput = (labelText, val, disabled, onInput) => {
    const f = Object.assign(document.createElement('div'), { className: 'adm-field' });
    const inp = Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', value: val || '', disabled });
    inp.addEventListener('input', () => onInput(inp.value.trim()));
    f.append(Object.assign(document.createElement('label'), { className: 'adm-label', textContent: labelText }), inp);
    return f;
  };
  row1.append(
    mkInput('品类 ID（小写英文/连字符）*', p.id, st.readOnly || (!st.isNew && p.id === 'ski'), (v) => { p.id = v; st.onSoftUpdate(); }),
    mkInput('Schema.org 类型 *', p.schemaOrgType, st.readOnly, (v) => { p.schemaOrgType = v; st.onSoftUpdate(); }),
    mkInput('前台路由段 routeSegment *', p.routeSegment, st.readOnly, (v) => { p.routeSegment = v; st.onSoftUpdate(); }),
    mkInput('Catalog 存储目录 storageDir *', p.storageDir, st.readOnly, (v) => { p.storageDir = v; st.onSoftUpdate(); }),
  );
  container.appendChild(row1);

  const featBar = Object.assign(document.createElement('div'), { className: 'vc-switches' });
  for (const [k, text] of [['passes', '启用通票/许可证页 (features.passes)'], ['compare', '启用多目的地对比页 (features.compare)']]) {
    const lbl = Object.assign(document.createElement('label'), { className: 'vc-switch-item' });
    const cb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: Boolean(p.features?.[k]), disabled: st.readOnly });
    cb.addEventListener('change', () => { p.features = { ...(p.features || {}), [k]: cb.checked }; st.onSoftUpdate(); });
    lbl.append(cb, Object.assign(document.createElement('span'), { textContent: text }));
    featBar.appendChild(lbl);
  }
  container.appendChild(featBar);
  appendMetaI18nRows(container, p, st);
}

async function persistCurrentVertical(st, shellCtx) {
  const synced = syncDerivedProfileSpecs(st.profile);
  let confirmModifySki = false;
  if (synced.id === 'ski') {
    const ok = await confirmAction({
      title: '确认修改滑雪品类（ski）？',
      message: '修改滑雪品类会影响雪迹 PowderClub 全站页面（路由、属性卡片、对比维度与详情区块）。确认继续保存并写入 Git 提交吗？',
      confirmLabel: '我已知晓影响，确认保存',
      danger: true,
    });
    if (!ok) return;
    confirmModifySki = true;
  }
  const payload = {
    id: synced.id,
    sourceId: st.copiedFromId || undefined,
    profile: synced,
    confirmModifySki,
    message: `${st.isNew ? '新建' : '更新'}品类 ${synced.id}（${synced.name?.['zh-CN'] || synced.id}）`,
  };
  const saved = st.isNew
    ? await adminApi.post('/verticals', payload)
    : await adminApi.put(`/verticals/${encodeURIComponent(synced.id)}`, payload);
  showToast(`已保存品类「${saved.id}」并生成提交 ${saved.commitHash.slice(0, 7)}`, 'success');
  st.isNew = false;
  st.copiedFromId = '';
  const me = await adminApi.get(`/auth/me?siteId=${encodeURIComponent(shellCtx.siteId || 'powderclub')}`);
  const pendingEl = document.getElementById('admPendingCount');
  if (pendingEl && me?.pendingChanges) pendingEl.textContent = String(me.pendingChanges.count ?? 0);
  await st.reloadCatalog(saved.id);
}

function renderTopSelectorBar(toolbarEl, st, shellCtx) {
  toolbarEl.innerHTML = '';
  const left = Object.assign(document.createElement('div'), { className: 'vc-toolbar__group' });
  left.appendChild(Object.assign(document.createElement('strong'), { textContent: '当前编辑品类：' }));
  const sel = Object.assign(document.createElement('select'), { className: 'adm-input' });
  for (const item of st.catalog.items) {
    sel.appendChild(Object.assign(document.createElement('option'), {
      value: `active:${item.id}`,
      textContent: `${item.profile.name?.['zh-CN'] || item.id} (${item.id})${item.source === 'builtin' ? ' [内置]' : ''}`,
      selected: !st.isNew && st.selectedKey === `active:${item.id}`,
    }));
  }
  for (const tpl of st.catalog.templates) {
    sel.appendChild(Object.assign(document.createElement('option'), {
      value: `tpl:${tpl.id}`,
      textContent: `[模板] ${tpl.profile.name?.['zh-CN'] || tpl.id} (${tpl.id})`,
      selected: !st.isNew && st.selectedKey === `tpl:${tpl.id}`,
    }));
  }
  if (st.isNew) sel.appendChild(Object.assign(document.createElement('option'), { value: 'new', textContent: `[新建草稿] ${st.profile.id}`, selected: true }));
  sel.addEventListener('change', () => st.selectByKey(sel.value));
  left.appendChild(sel);

  const right = Object.assign(document.createElement('div'), { className: 'vc-toolbar__group' });
  if (!st.readOnly) {
    const copyBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline', textContent: '从当前项复制新建' });
    copyBtn.addEventListener('click', () => st.duplicateCurrent());
    const blankBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline', textContent: '新建空白品类' });
    blankBtn.addEventListener('click', () => st.startBlank());
    const saveBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--primary', textContent: '校验并保存（Git 提交）' });
    bindAsyncButton(saveBtn, () => persistCurrentVertical(st, shellCtx), { onError: (err) => showToast(err.message || '保存品类失败', 'error') });
    right.append(copyBtn, blankBtn, saveBtn);
  }
  toolbarEl.append(left, right);
}

function buildConfiguratorDom(viewport) {
  viewport.innerHTML = '';
  const header = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  header.innerHTML = '<h2>品类配置器（Vertical Configurator）</h2><span class="adm-muted">自助定义新品类属性、筛选、对比维度与详情区块，保存即写入 verticals/&lt;id&gt;/profile.yaml</span>';
  const bannerBox = document.createElement('div');
  const toolbarEl = Object.assign(document.createElement('div'), { className: 'vc-toolbar' });
  const layout = Object.assign(document.createElement('div'), { className: 'vc-layout' });
  const leftCol = document.createElement('div');
  const metaPanel = Object.assign(document.createElement('div'), { className: 'vc-panel' });
  const attrPanel = Object.assign(document.createElement('div'), { className: 'vc-panel' });
  const secPanel = Object.assign(document.createElement('div'), { className: 'vc-panel' });
  leftCol.append(metaPanel, attrPanel, secPanel);
  const rightCol = Object.assign(document.createElement('div'), { className: 'vc-panel vc-preview-sticky' });
  layout.append(leftCol, rightCol);
  viewport.append(header, bannerBox, toolbarEl, layout);
  return { bannerBox, toolbarEl, metaPanel, attrPanel, secPanel, rightCol };
}

function drawConfiguratorBannerAndPreview(dom, st) {
  dom.bannerBox.innerHTML = '';
  if (st.readOnly) {
    dom.bannerBox.appendChild(Object.assign(document.createElement('div'), {
      className: 'adm-alert adm-alert--warn',
      textContent: '只读预览模式：当前账号缺少 verticals:write 权限，仅管理员可新建或保存品类配置。',
    }));
  } else if (st.profile.id === 'ski') {
    dom.bannerBox.appendChild(Object.assign(document.createElement('div'), {
      className: 'adm-alert adm-alert--warn',
      textContent: '高风险保护提示：修改滑雪品类会影响雪迹 PowderClub 全站页面，保存时需经过管理员二次确认。',
    }));
  }
  renderLiveVerticalPreview(dom.rightCol, {
    profile: st.profile,
    examples: st.examples,
    locale: st.previewLocale,
    onLocaleChange: (loc) => { st.previewLocale = loc; drawConfiguratorBannerAndPreview(dom, st); },
  });
}

function attachStateActions(st, redrawAll) {
  st.selectByKey = (key) => {
    const [kind, id] = key.split(':');
    const src = kind === 'tpl' ? st.catalog.templates.find((t) => t.id === id) : st.catalog.items.find((i) => i.id === id);
    if (!src) return;
    Object.assign(st, {
      selectedKey: key, isNew: kind === 'tpl', copiedFromId: kind === 'tpl' ? src.id : '',
      profile: structuredClone(src.profile), examples: structuredClone(src.examples || []),
      expandedKeys: new Set([src.profile.attributes?.[0]?.key].filter(Boolean)),
    });
    redrawAll();
  };
  st.duplicateCurrent = () => {
    const copy = structuredClone(st.profile);
    copy.id = st.profile.id === 'ski' ? 'diving' : `${st.profile.id}-copy`;
    if (copy.routeSegment === 'resorts') copy.routeSegment = `${copy.id}-spots`;
    if (copy.storageDir === 'resorts') copy.storageDir = `${copy.id}-spots`;
    Object.assign(st, { isNew: true, copiedFromId: st.profile.id, profile: copy });
    redrawAll();
  };
  st.startBlank = () => {
    Object.assign(st, { isNew: true, copiedFromId: '', profile: buildBlankVerticalProfile(), examples: [], expandedKeys: new Set(['distanceKm']) });
    redrawAll();
  };
}

function pickInitialRecord(catalog, preferredId) {
  if (preferredId) {
    const act = catalog.items.find((i) => i.id === preferredId);
    if (act) return act;
    const tpl = catalog.templates.find((t) => t.id === preferredId);
    if (tpl) return tpl;
  }
  return catalog.items[0] || catalog.templates[0];
}

function createConfiguratorState(catalog, readOnly, preferredId, redrawAll, refreshPreview) {
  const firstRec = pickInitialRecord(catalog, preferredId);
  const st = {
    catalog,
    readOnly,
    selectedKey: firstRec?.isTemplate ? `tpl:${firstRec.id}` : `active:${firstRec?.id || 'ski'}`,
    isNew: Boolean(firstRec?.isTemplate),
    copiedFromId: firstRec?.isTemplate ? firstRec.id : '',
    profile: structuredClone(firstRec?.profile || buildBlankVerticalProfile()),
    examples: structuredClone(firstRec?.examples || []),
    previewLocale: 'zh-CN',
    expandedKeys: new Set([firstRec?.profile?.attributes?.[0]?.key].filter(Boolean)),
    onSoftUpdate: () => { st.profile = syncDerivedProfileSpecs(st.profile); refreshPreview(); },
    onRefreshAll: () => { st.profile = syncDerivedProfileSpecs(st.profile); redrawAll(); },
    selectByKey: (_key) => {},
    reloadCatalog: async (focusId) => {
      st.catalog = await adminApi.get('/verticals');
      const hit = st.catalog.items.find((i) => i.id === focusId) || st.catalog.items[0];
      if (hit) st.selectByKey(`active:${hit.id}`);
    },
  };
  attachStateActions(st, redrawAll);
  return st;
}

export async function mount(viewport, shellCtx = {}) {
  ensureStylesheetLoaded();
  const readOnly = !hasWritePermission(shellCtx.user);
  const [catalog, siteProf] = await Promise.all([
    adminApi.get('/verticals'),
    adminApi.get(`/destinations/profile?siteId=${encodeURIComponent(shellCtx.siteId || 'powderclub')}`).catch(() => null),
  ]);
  const dom = buildConfiguratorDom(viewport);
  let st = null;
  const redrawAll = () => {
    renderTopSelectorBar(dom.toolbarEl, st, shellCtx);
    renderBasicMetaPanel(dom.metaPanel, st);
    renderAttributesSection(dom.attrPanel, st);
    renderSectionsEditor(dom.secPanel, st);
    drawConfiguratorBannerAndPreview(dom, st);
  };
  st = createConfiguratorState(catalog, readOnly, siteProf?.profile?.id, redrawAll, () => drawConfiguratorBannerAndPreview(dom, st));
  redrawAll();
}
