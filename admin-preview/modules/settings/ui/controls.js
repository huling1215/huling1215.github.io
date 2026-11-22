export const LOCALE_NAMES = {
  'zh-CN': '简体中文 (zh-CN)',
  en: 'English (en)',
  'zh-Hant': '繁體中文 (zh-Hant)',
  ja: '日本語 (ja)',
  ko: '한국어 (ko)',
};

export const CHANNEL_NAMES = {
  wecomKf: '企业微信客服 (wecomKf)',
  whatsapp: 'WhatsApp',
  line: 'LINE',
  kakao: 'KakaoTalk',
};

export function createSectionCard(title, subtitle = '') {
  const card = Object.assign(document.createElement('section'), {
    style: 'background:var(--adm-surface);border:1px solid var(--adm-border);border-radius:var(--adm-radius);padding:18px;margin-bottom:16px;',
  });
  const head = Object.assign(document.createElement('div'), { style: 'margin-bottom:14px;border-bottom:1px solid var(--adm-border);padding-bottom:10px;' });
  const h3 = Object.assign(document.createElement('h3'), { textContent: title, style: 'margin:0;font-size:16px;' });
  head.appendChild(h3);
  if (subtitle) {
    head.appendChild(Object.assign(document.createElement('p'), { className: 'adm-muted', textContent: subtitle, style: 'margin:4px 0 0;' }));
  }
  const body = Object.assign(document.createElement('div'), { className: 'adm-form' });
  card.append(head, body);
  return { card, body };
}

export function createTwoColGrid() {
  return Object.assign(document.createElement('div'), {
    style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;',
  });
}

function appendLabelWithRiskBadge(row, labelText, required, highRisk) {
  const labelWrap = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const lbl = Object.assign(document.createElement('label'), {
    className: 'adm-label',
    textContent: `${labelText}${required ? ' *' : ''}`,
  });
  labelWrap.appendChild(lbl);
  if (highRisk) {
    labelWrap.appendChild(Object.assign(document.createElement('span'), {
      className: 'adm-badge adm-badge--stale',
      textContent: '高风险全局字段',
    }));
  }
  row.appendChild(labelWrap);
}

export function createValidatedInput(opts) {
  const row = Object.assign(document.createElement('div'), { className: 'adm-field' });
  appendLabelWithRiskBadge(row, opts.label, opts.required, opts.highRisk);

  const isArea = opts.type === 'textarea';
  const ctrl = document.createElement(isArea ? 'textarea' : 'input');
  ctrl.className = isArea ? 'adm-textarea' : 'adm-input';
  if (isArea) ctrl.rows = opts.rows || 3;
  else ctrl.type = opts.type || 'text';
  ctrl.value = String(opts.value ?? '');
  ctrl.placeholder = opts.placeholder || '';
  ctrl.disabled = Boolean(opts.disabled);

  const errEl = Object.assign(document.createElement('p'), { className: 'adm-field__error', hidden: true });
  const syncValidation = () => {
    const rawVal = opts.type === 'number' ? Number(ctrl.value) : ctrl.value.trim();
    const msg = typeof opts.validate === 'function' ? opts.validate(rawVal) : '';
    errEl.textContent = msg || '';
    errEl.hidden = !msg;
    if (typeof opts.onChange === 'function') opts.onChange(rawVal);
  };
  ctrl.addEventListener('input', syncValidation);
  ctrl.addEventListener('blur', syncValidation);

  row.append(ctrl, errEl);
  if (opts.hint) row.appendChild(Object.assign(document.createElement('small'), { className: 'adm-muted', textContent: opts.hint }));
  return row;
}

export function createSelectField(opts) {
  const row = Object.assign(document.createElement('div'), { className: 'adm-field' });
  appendLabelWithRiskBadge(row, opts.label, false, opts.highRisk);
  const sel = Object.assign(document.createElement('select'), { className: 'adm-input', disabled: Boolean(opts.disabled) });
  for (const item of opts.options || []) {
    const opt = Object.assign(document.createElement('option'), { value: item.value, textContent: item.label });
    if (item.value === String(opts.value ?? '')) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => opts.onChange?.(sel.value));
  row.appendChild(sel);
  if (opts.hint) row.appendChild(Object.assign(document.createElement('small'), { className: 'adm-muted', textContent: opts.hint }));
  return row;
}

export function createCheckboxField(opts) {
  const row = Object.assign(document.createElement('div'), { className: 'adm-field' });
  const label = Object.assign(document.createElement('label'), { className: 'adm-inline-actions', style: 'cursor:pointer;font-weight:600;' });
  const box = Object.assign(document.createElement('input'), {
    type: 'checkbox',
    checked: Boolean(opts.checked),
    disabled: Boolean(opts.disabled),
  });
  box.addEventListener('change', () => opts.onChange?.(Boolean(box.checked)));
  label.append(box, Object.assign(document.createElement('span'), { textContent: opts.label }));
  row.appendChild(label);
  if (opts.hint) row.appendChild(Object.assign(document.createElement('small'), { className: 'adm-muted', textContent: opts.hint }));
  return row;
}

export function createMultiCheckField(opts) {
  const row = Object.assign(document.createElement('div'), { className: 'adm-field' });
  row.appendChild(Object.assign(document.createElement('label'), { className: 'adm-label', textContent: opts.label }));
  const wrap = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const current = new Set(opts.selected || []);

  for (const item of opts.options || []) {
    const chip = Object.assign(document.createElement('label'), {
      style: 'display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid var(--adm-border);border-radius:var(--adm-radius);background:#f9fafc;cursor:pointer;',
    });
    const cb = Object.assign(document.createElement('input'), {
      type: 'checkbox',
      checked: current.has(item.value),
      disabled: Boolean(opts.disabled),
    });
    cb.addEventListener('change', () => {
      if (cb.checked) current.add(item.value);
      else current.delete(item.value);
      const ordered = (opts.options || []).map((o) => o.value).filter((v) => current.has(v));
      opts.onChange?.(ordered);
    });
    chip.append(cb, Object.assign(document.createElement('span'), { textContent: item.label }));
    wrap.appendChild(chip);
  }
  row.appendChild(wrap);
  if (opts.hint) row.appendChild(Object.assign(document.createElement('small'), { className: 'adm-muted', textContent: opts.hint }));
  return row;
}

function createLocaleRoutingRow(loc, initialList, channels, disabled, onUpdate) {
  const wrap = Object.assign(document.createElement('div'), {
    style: 'display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid var(--adm-border);border-radius:var(--adm-radius);',
  });
  wrap.appendChild(Object.assign(document.createElement('strong'), { textContent: LOCALE_NAMES[loc] || loc, style: 'min-width:150px;font-size:13px;' }));
  const right = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const selected = Array.isArray(initialList) ? [...initialList] : [];

  for (const ch of channels) {
    const lbl = Object.assign(document.createElement('label'), { style: 'display:inline-flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;' });
    const cb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: selected.includes(ch), disabled });
    cb.addEventListener('change', () => {
      const idx = selected.indexOf(ch);
      if (cb.checked && idx === -1) selected.push(ch);
      if (!cb.checked && idx !== -1) selected.splice(idx, 1);
      onUpdate([...selected]);
    });
    lbl.append(cb, Object.assign(document.createElement('span'), { textContent: CHANNEL_NAMES[ch] || ch }));
    right.appendChild(lbl);
  }
  wrap.appendChild(right);
  return wrap;
}

export function createChatRoutingEditor({ routing, channels, locales, disabled, onChange }) {
  const container = Object.assign(document.createElement('div'), { className: 'adm-field' });
  container.appendChild(Object.assign(document.createElement('label'), { className: 'adm-label', textContent: '5 语种客服展示路由规则（勾选顺序即优先展示顺序）' }));
  const state = { ...routing };
  for (const loc of locales) {
    const rowEl = createLocaleRoutingRow(loc, state[loc] || [], channels, Boolean(disabled), (nextArr) => {
      state[loc] = nextArr;
      onChange?.({ ...state });
    });
    container.appendChild(rowEl);
  }
  return container;
}

export function createAiEnginesEditor({ engines, locales, modes, disabled, onChange }) {
  const container = Object.assign(document.createElement('div'), { className: 'adm-field' });
  container.appendChild(Object.assign(document.createElement('label'), { className: 'adm-label', textContent: '各语种翻译引擎（engines）' }));
  const grid = createTwoColGrid();
  const state = { ...engines };
  for (const loc of locales) {
    const sel = createSelectField({
      label: LOCALE_NAMES[loc] || loc,
      value: state[loc] || (loc === 'zh-Hant' ? 'opencc' : 'llm'),
      disabled,
      options: modes.map((m) => ({ value: m, label: m === 'opencc' ? 'opencc（简繁确定性转换）' : 'llm（大模型翻译）' })),
      onChange: (val) => {
        state[loc] = val;
        onChange?.({ ...state });
      },
    });
    grid.appendChild(sel);
  }
  container.appendChild(grid);
  return container;
}
