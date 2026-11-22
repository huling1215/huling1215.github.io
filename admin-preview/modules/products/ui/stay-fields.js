import { createI18nEditor } from '/ui/kit/index.js';
import {
  createBookingEditor,
  createCnyPriceControl,
  createCoverPickerField,
  fieldBox,
  h,
  renderCurrencyPreviewBar,
} from './dom-helpers.js';
import {
  createFaqListEditor,
  createI18nListEditor,
  createVerificationEditor,
} from './list-editors.js';

function renderStayBaseCard(draft, meta, isCreate, notify) {
  const destLabel = meta.vertical?.entitySingularZh || '目的地';
  const slugInp = h('input', { type: 'text', className: 'adm-input', value: draft.slug || '', readOnly: !isCreate, placeholder: '例如：club-med-beidahu' });
  slugInp.addEventListener('input', () => { draft.slug = slugInp.value.trim(); notify(); });

  const destSel = h('select', { className: 'adm-input' }, [h('option', { value: '', textContent: `-- 请选择所属${destLabel} --` })]);
  for (const d of meta.destinations || []) destSel.appendChild(h('option', { value: d.slug, textContent: `${d.nameZh} (${d.slug})`, selected: d.slug === draft.resort }));
  destSel.addEventListener('change', () => { draft.resort = destSel.value; notify(true); });

  const srcSel = h('select', { className: 'adm-input' });
  for (const opt of meta.enums?.sourceTypes || []) srcSel.appendChild(h('option', { value: opt.value, textContent: opt.label, selected: opt.value === (draft.sourceType || 'editorial') }));
  srcSel.addEventListener('change', () => { draft.sourceType = srcSel.value; notify(); });

  const coverField = createCoverPickerField({
    value: draft.cover,
    onChange: (val) => { if (val) draft.cover = val; else delete draft.cover; notify(); },
  });

  return h('div', { className: 'prd-card' }, [
    h('h4', { className: 'prd-card__title', textContent: '基础归属与封面图' }),
    h('div', { className: 'prd-grid-3' }, [
      fieldBox('产品标识 Slug', slugInp, isCreate ? '仅限小写字母、数字和连字符' : '已有条目不可直接改名'),
      fieldBox(`所属${destLabel}`, destSel),
      fieldBox('数据来源（sourceType）', srcSel),
    ]),
    fieldBox('酒店封面图（cover）', coverField),
  ]);
}

function renderStayCopyCard(draft, notify) {
  const tr = draft.translations || {};
  const nameEd = createI18nEditor({ value: draft.name || {}, translations: tr, onChange: (v) => { draft.name = v; notify(); } });
  const sumEd = createI18nEditor({ value: draft.summary || {}, translations: tr, multiline: true, rows: 3, onChange: (v) => { draft.summary = v; notify(); } });
  const addrEd = createI18nEditor({ value: draft.address || {}, translations: tr, onChange: (v) => { draft.address = v; notify(); } });
  const cancelEd = createI18nEditor({ value: draft.cancellation || {}, translations: tr, onChange: (v) => { draft.cancellation = v; notify(); } });

  return h('div', { className: 'prd-card' }, [
    h('h4', { className: 'prd-card__title', textContent: '多语言名称、概述与地址' }),
    fieldBox('酒店名称（name）', nameEd.el),
    fieldBox('核心概述（summary）', sumEd.el),
    fieldBox('详细地址（address，可选）', addrEd.el),
    fieldBox('退改政策说明（cancellation，可选）', cancelEd.el),
  ]);
}

function buildCoordAndRatingControls(draft, meta, notify) {
  const syncCoords = (latVal, lngVal) => {
    if (latVal === '' && lngVal === '') { delete draft.coords; notify(true); return; }
    const lat = Number(latVal);
    const lng = Number(lngVal);
    if (Number.isFinite(lat) && Number.isFinite(lng)) draft.coords = { lat, lng };
    notify(true);
  };
  const latInp = h('input', { type: 'number', step: 'any', className: 'adm-input', value: draft.coords?.lat ?? '', placeholder: '例如 43.82' });
  const lngInp = h('input', { type: 'number', step: 'any', className: 'adm-input', value: draft.coords?.lng ?? '', placeholder: '例如 126.61' });
  latInp.addEventListener('input', () => syncCoords(latInp.value.trim(), lngInp.value.trim()));
  lngInp.addEventListener('input', () => syncCoords(latInp.value.trim(), lngInp.value.trim()));

  const starSel = h('select', { className: 'adm-input' }, [h('option', { value: '', textContent: '未评级 / 精品住宿' })]);
  for (const s of [3, 4, 4.5, 5]) starSel.appendChild(h('option', { value: String(s), textContent: `${s} 星级`, selected: Number(draft.starRating) === s }));
  starSel.addEventListener('change', () => {
    if (starSel.value) draft.starRating = Number(starSel.value);
    else delete draft.starRating;
    notify();
  });

  const mealSel = h('select', { className: 'adm-input' });
  for (const m of meta.enums?.mealPlans || []) mealSel.appendChild(h('option', { value: m.value, textContent: m.label, selected: m.value === (draft.mealPlan || '') }));
  mealSel.addEventListener('change', () => {
    if (mealSel.value) draft.mealPlan = mealSel.value;
    else delete draft.mealPlan;
    notify();
  });
  return [
    fieldBox('纬度（coords.lat，转正必填）', latInp),
    fieldBox('经度（coords.lng，转正必填）', lngInp),
    fieldBox('星级评定（starRating）', starSel),
    fieldBox('餐食方案（mealPlan）', mealSel),
  ];
}

function renderStaySpecsCard(draft, meta, notify) {
  const inInp = h('input', { type: 'text', className: 'adm-input', value: draft.checkIn || '', placeholder: '15:00' });
  const outInp = h('input', { type: 'text', className: 'adm-input', value: draft.checkOut || '', placeholder: '11:00' });
  inInp.addEventListener('input', () => { draft.checkIn = inInp.value.trim() || undefined; notify(); });
  outInp.addEventListener('input', () => { draft.checkOut = outInp.value.trim() || undefined; notify(); });

  const liftInp = h('input', { type: 'number', min: '0', step: '1', className: 'adm-input', value: draft.liftDistanceM ?? 0 });
  const vilInp = h('input', { type: 'number', min: '0', step: '1', className: 'adm-input', value: draft.villageDistanceM ?? '', placeholder: '可选' });
  liftInp.addEventListener('input', () => { draft.liftDistanceM = Math.max(0, Number.parseInt(liftInp.value || '0', 10) || 0); notify(); });
  vilInp.addEventListener('input', () => {
    if (vilInp.value.trim() === '') delete draft.villageDistanceM;
    else draft.villageDistanceM = Math.max(0, Number.parseInt(vilInp.value, 10) || 0);
    notify();
  });

  const skiChk = h('input', { type: 'checkbox', checked: Boolean(draft.skiInOut) });
  const kidsChk = h('input', { type: 'checkbox', checked: Boolean(draft.kidsClub) });
  skiChk.addEventListener('change', () => { draft.skiInOut = skiChk.checked; notify(); });
  kidsChk.addEventListener('change', () => { draft.kidsClub = kidsChk.checked; notify(); });

  return h('div', { className: 'prd-card' }, [
    h('h4', { className: 'prd-card__title', textContent: '位置坐标、动线距离与入住参数' }),
    h('div', { className: 'prd-grid-3' }, [
      ...buildCoordAndRatingControls(draft, meta, notify),
      fieldBox('入住时间（HH:mm）', inInp),
      fieldBox('退房时间（HH:mm）', outInp),
      fieldBox('距最近缆车距离（米）', liftInp),
      fieldBox('距中心商业街距离（米，可选）', vilInp),
    ]),
    h('div', { className: 'prd-check-grid', style: 'margin-top:10px' }, [
      h('label', { className: 'prd-check-item' }, [skiChk, '支持滑进滑出（skiInOut）']),
      h('label', { className: 'prd-check-item' }, [kidsChk, '提供儿童托管俱乐部（kidsClub）']),
    ]),
  ]);
}

function renderStayAmenitiesAndPriceCard(draft, meta, notify) {
  const priceCtrl = createCnyPriceControl({
    amount: draft.price?.amount,
    unit: draft.price?.unit || 'night',
    unitOptions: meta.enums?.priceUnits || [],
    ratesInfo: meta.rates,
    onChange: (nextPrice) => { draft.price = nextPrice; notify(true); },
  });

  const selectedSet = new Set(Array.isArray(draft.amenities) ? draft.amenities : []);
  const checkGrid = h('div', { className: 'prd-check-grid' });
  for (const am of meta.enums?.amenities || []) {
    const chk = h('input', { type: 'checkbox', checked: selectedSet.has(am.value) });
    chk.addEventListener('change', () => {
      if (chk.checked) selectedSet.add(am.value);
      else selectedSet.delete(am.value);
      draft.amenities = Array.from(selectedSet);
      notify();
    });
    checkGrid.appendChild(h('label', { className: 'prd-check-item' }, [chk, am.label]));
  }

  return h('div', { className: 'prd-card' }, [
    h('h4', { className: 'prd-card__title', textContent: '起步价格（CNY）与配套设施' }),
    fieldBox('起步参考价（以人民币 CNY 存储，自动预览 5 币种换算）', priceCtrl),
    fieldBox('酒店设施多选（amenities）', checkGrid),
  ]);
}

function renderSingleRoomRow(room, idx, ratesInfo, translations, onUpdate, onRemove) {
  const nameEd = createI18nEditor({ value: room.name || {}, translations, onChange: (v) => { room.name = v; onUpdate(); } });
  const areaInp = h('input', { type: 'number', min: '1', className: 'adm-input', value: room.areaSqm ?? 30 });
  const guestInp = h('input', { type: 'number', min: '1', className: 'adm-input', value: room.maxGuests ?? 2 });
  const priceInp = h('input', { type: 'number', min: '1', className: 'adm-input', value: room.priceCny ?? 1500 });
  const rateBar = h('div', { className: 'prd-rates-bar' });
  renderCurrencyPreviewBar(rateBar, room.priceCny, ratesInfo);

  areaInp.addEventListener('input', () => { room.areaSqm = Math.max(1, Number.parseInt(areaInp.value || '1', 10) || 1); onUpdate(); });
  guestInp.addEventListener('input', () => { room.maxGuests = Math.max(1, Number.parseInt(guestInp.value || '1', 10) || 1); onUpdate(); });
  priceInp.addEventListener('input', () => {
    room.priceCny = Math.max(1, Number(priceInp.value || '0') || 1);
    renderCurrencyPreviewBar(rateBar, room.priceCny, ratesInfo);
    onUpdate();
  });
  const rmBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '删除房型', onClick: onRemove });
  return h('div', { className: 'prd-repeat-item' }, [
    h('div', { className: 'prd-repeat-head' }, [h('span', { textContent: `房型 #${idx + 1}` }), rmBtn]),
    fieldBox('房型多语言名称', nameEd.el),
    h('div', { className: 'prd-grid-3' }, [
      fieldBox('面积（㎡）', areaInp),
      fieldBox('最大入住人数', guestInp),
      fieldBox('房型参考价（CNY）', priceInp),
    ]),
    rateBar,
  ]);
}

function renderStayRoomsCard(draft, meta, notify) {
  const rooms = Array.isArray(draft.rooms) ? draft.rooms.map((r) => structuredClone(r)) : [];
  draft.rooms = rooms;
  const addBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '+ 新增房型' });
  const host = h('div');
  const redraw = () => {
    host.innerHTML = '';
    if (rooms.length === 0) host.appendChild(h('p', { className: 'adm-muted', textContent: '尚未添加房型，点击右上角新增。' }));
    rooms.forEach((rm, idx) => {
      host.appendChild(
        renderSingleRoomRow(rm, idx, meta.rates, draft.translations || {}, () => notify(), () => {
          rooms.splice(idx, 1);
          notify();
          redraw();
        }),
      );
    });
  };
  addBtn.addEventListener('click', () => {
    rooms.push({ name: { 'zh-CN': '新房型' }, areaSqm: 35, maxGuests: 2, priceCny: draft.price?.amount || 1800 });
    notify();
    redraw();
  });
  redraw();
  return h('div', { className: 'prd-card' }, [
    h('h4', { className: 'prd-card__title' }, [h('span', { textContent: '房型规格与房价列表（rooms）' }), addBtn]),
    host,
  ]);
}

export function renderStayFormFields(container, { draft, meta, isCreate, onDraftChange }) {
  container.innerHTML = '';
  const tr = draft.translations || {};
  container.append(
    renderStayBaseCard(draft, meta, isCreate, onDraftChange),
    renderStayCopyCard(draft, onDraftChange),
    renderStaySpecsCard(draft, meta, onDraftChange),
    renderStayAmenitiesAndPriceCard(draft, meta, onDraftChange),
    renderStayRoomsCard(draft, meta, onDraftChange),
    createI18nListEditor({
      title: '核心亮点（highlights）',
      items: draft.highlights || [],
      maxItems: 3,
      translations: tr,
      addLabel: '+ 新增亮点',
      onChange: (list) => { draft.highlights = list; onDraftChange(); },
    }),
    createFaqListEditor({
      items: draft.faq || [],
      translations: tr,
      onChange: (list) => { draft.faq = list; onDraftChange(); },
    }),
    createBookingEditor({
      value: draft.booking,
      bookingMeta: meta.booking,
      onChange: (bk) => { draft.booking = bk; onDraftChange(true); },
    }),
    createVerificationEditor({
      value: draft.verification,
      translations: tr,
      onChange: (ver) => { draft.verification = ver; onDraftChange(); },
    }),
  );
}
