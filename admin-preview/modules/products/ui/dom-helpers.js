import { bindAsyncButton, openMediaPicker } from '/ui/kit/index.js';

const PREVIEW_CURRENCIES = ['USD', 'HKD', 'TWD', 'JPY', 'KRW'];

export function injectProductsStyles() {
  if (document.getElementById('ntsProductsModuleStyles')) return;
  const style = document.createElement('style');
  style.id = 'ntsProductsModuleStyles';
  style.textContent = `
    .prd-card { background:#fff; border:1px solid var(--adm-border); border-radius:var(--adm-radius); padding:16px; margin-bottom:14px; }
    .prd-card__title { margin:0 0 12px; font-size:15px; font-weight:700; display:flex; justify-content:space-between; align-items:center; gap:8px; }
    .prd-grid-2 { display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px; }
    .prd-grid-3 { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; }
    .prd-check-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(195px, 1fr)); gap:8px; }
    .prd-check-item { display:flex; align-items:center; gap:6px; padding:6px 8px; border:1px solid var(--adm-border); border-radius:4px; background:#fafbfe; font-size:13px; cursor:pointer; }
    .prd-rates-bar { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
    .prd-rate-chip { font-size:12px; padding:2px 8px; border-radius:999px; background:#f1f4fb; color:#2b3252; border:1px solid #dce2f2; }
    .prd-repeat-item { border:1px dashed var(--adm-border); border-radius:var(--adm-radius); padding:12px; margin-bottom:10px; background:#fcfdff; }
    .prd-repeat-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-weight:600; font-size:13px; }
    .prd-promo-box { border:1px solid var(--adm-border); border-left:4px solid var(--adm-warn); border-radius:var(--adm-radius); padding:14px 16px; background:#fffdf7; margin-bottom:16px; }
    .prd-promo-box.is-ready { border-left-color:var(--adm-ok); background:#f4fbf7; }
    .prd-promo-list { list-style:none; padding:0; margin:8px 0 0; display:grid; gap:6px; }
    .prd-promo-item { display:flex; align-items:center; gap:8px; font-size:13px; }
    .prd-pill { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; font-weight:600; }
    .prd-pill--online { background:#d1fae5; color:#065f46; }
    .prd-pill--draft { background:#fef3c7; color:#92400e; }
    .prd-pill--offline { background:#e5e7eb; color:#374151; }
    .prd-batch-bar { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding:10px 14px; background:#eef2ff; border:1px solid #c7d2fe; border-radius:var(--adm-radius); margin-bottom:12px; }
    .prd-cal-dep { font-size:11px; line-height:1.3; padding:2px 4px; border-radius:3px; margin-top:3px; background:#e0e7ff; color:#1e3a8a; }
    .prd-cal-dep--limited { background:#fef3c7; color:#92400e; }
    .prd-cal-dep--full { background:#fee2e2; color:#991b1b; }
  `;
  document.head.appendChild(style);
}

export function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue;
    if (k === 'className') el.className = v;
    else if (k === 'textContent') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, String(v));
  }
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function fieldBox(labelText, controlEl, hintText = '') {
  const box = h('div', { className: 'adm-field' }, [
    h('label', { className: 'adm-label', textContent: labelText }),
    controlEl,
  ]);
  if (hintText) box.appendChild(h('span', { className: 'adm-muted', textContent: hintText }));
  return box;
}

export function renderCurrencyPreviewBar(barEl, amountCny, ratesInfo) {
  barEl.innerHTML = '';
  const num = Number(amountCny);
  if (!Number.isFinite(num) || num <= 0) {
    barEl.appendChild(h('span', { className: 'adm-muted', textContent: '输入大于 0 的人民币金额后实时换算 USD / HKD / TWD / JPY / KRW' }));
    return;
  }
  const rates = ratesInfo?.rates || {};
  const symbols = ratesInfo?.symbols || { USD: 'US$', HKD: 'HK$', TWD: 'NT$', JPY: 'JP¥', KRW: '₩' };
  for (const cur of PREVIEW_CURRENCIES) {
    const rate = Number(rates[cur] || 0);
    if (!rate) continue;
    const converted = Math.round(num * rate);
    const formatted = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(converted);
    barEl.appendChild(h('span', { className: 'prd-rate-chip', textContent: `${cur} ≈ ${symbols[cur] || ''}${formatted}` }));
  }
}

export function createCnyPriceControl({ amount, unit, unitOptions, ratesInfo, showUnit = true, onChange }) {
  const wrap = h('div');
  const row = h('div', { className: 'adm-inline-actions' });
  const amountInput = h('input', {
    type: 'number',
    min: '1',
    step: '1',
    className: 'adm-input',
    value: amount ?? '',
    placeholder: 'CNY 金额（例如 2980）',
  });
  const unitSelect = h('select', { className: 'adm-input', hidden: !showUnit });
  for (const opt of unitOptions || []) {
    unitSelect.appendChild(h('option', { value: opt.value, textContent: opt.label, selected: opt.value === (unit || 'night') }));
  }
  const previewBar = h('div', { className: 'prd-rates-bar' });
  const emit = () => {
    const parsed = Number(amountInput.value);
    renderCurrencyPreviewBar(previewBar, parsed, ratesInfo);
    onChange({
      amount: Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
      currency: 'CNY',
      unit: unitSelect.value || unit || 'night',
    });
  };
  amountInput.addEventListener('input', emit);
  unitSelect.addEventListener('change', emit);
  renderCurrencyPreviewBar(previewBar, Number(amount), ratesInfo);
  row.append(h('strong', { textContent: '¥ CNY' }), amountInput);
  if (showUnit) row.appendChild(unitSelect);
  wrap.append(row, previewBar);
  return wrap;
}

export function createCoverPickerField({ value, onChange }) {
  const input = h('input', {
    type: 'text',
    className: 'adm-input',
    value: value || '',
    placeholder: '点击右侧按钮选择图片，或填入路径如 ./cover.jpg',
  });
  const pickBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '从媒体库选图' });
  const clearBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '清空' });
  input.addEventListener('input', () => onChange(input.value.trim() || undefined));
  bindAsyncButton(pickBtn, async () => {
    const picked = await openMediaPicker({ title: '选择产品封面图', currentValue: input.value });
    if (picked) {
      input.value = picked;
      onChange(picked);
    }
  });
  clearBtn.addEventListener('click', () => {
    input.value = '';
    onChange(undefined);
  });
  return h('div', { className: 'adm-inline-actions' }, [input, pickBtn, clearBtn]);
}

function buildBookingDetailInputs(state, emit) {
  const mkInput = (key, placeholder) => {
    const inp = h('input', { type: 'text', className: 'adm-input', value: state[key] || '', placeholder });
    inp.addEventListener('input', () => {
      if (inp.value.trim()) state[key] = inp.value.trim();
      else delete state[key];
      emit();
    });
    return inp;
  };
  return h('div', { className: 'prd-grid-2' }, [
    fieldBox('落地页 URL（booking.url）', mkInput('url', 'https://...（外部预订渠道必填有效链接或商品 ID）')),
    fieldBox('渠道商品 ID（booking.productId）', mkInput('productId', '例如：PKG-BDH-BEG-4D')),
    fieldBox('关联小程序 AppID（可选）', mkInput('mpAppId', 'wx...（覆盖站点默认小程序 AppID）')),
    fieldBox('关联小程序页面路径（可选）', mkInput('mpPath', 'pages/detail/index?id=...')),
  ]);
}

export function createBookingEditor({ value, bookingMeta, onChange }) {
  const providers = bookingMeta?.providers || [];
  const state = { provider: value?.provider || bookingMeta?.defaultProvider || 'inquiry', ...(value || {}) };
  const card = h('div', { className: 'prd-card' }, [h('h4', { className: 'prd-card__title', textContent: '预订与转化渠道设置' })]);
  const providerSel = h('select', { className: 'adm-input' });
  for (const p of providers) {
    const suffix = p.id === 'inquiry' ? '（站内默认可用）' : p.enabledInSite ? '（站点已启用）' : '（站点未启用，前台自动回退咨询）';
    providerSel.appendChild(h('option', { value: p.id, textContent: `${p.label} ${suffix}`, selected: p.id === state.provider }));
  }
  const hintEl = h('p', { className: 'adm-muted' });
  const emit = () => {
    const matched = providers.find((p) => p.id === state.provider);
    const paramKeys = matched?.defaultParams ? Object.keys(matched.defaultParams) : [];
    const paramNote = paramKeys.length ? `；站点归因参数：${paramKeys.join(', ')}` : '';
    hintEl.textContent = `${matched?.hint || ''}${paramNote}`;
    onChange({ ...state });
  };
  providerSel.addEventListener('change', () => {
    state.provider = providerSel.value;
    emit();
  });
  card.append(fieldBox('预订渠道（复用 booking registry）', providerSel), hintEl, buildBookingDetailInputs(state, emit));
  emit();
  return card;
}
