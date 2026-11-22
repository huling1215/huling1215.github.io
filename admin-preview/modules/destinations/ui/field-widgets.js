import { createI18nEditor } from '/ui/kit/index.js';

export function getAtDotPath(obj, dotPath) {
  let cur = obj;
  for (const part of String(dotPath || '').split('.')) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

export function setAtDotPath(obj, dotPath, value) {
  const parts = String(dotPath || '').split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const seg = parts[i];
    if (!cur[seg] || typeof cur[seg] !== 'object') cur[seg] = {};
    cur = cur[seg];
  }
  const leaf = parts[parts.length - 1];
  if (value === undefined || value === null || value === '') delete cur[leaf];
  else cur[leaf] = value;
}

function buildNumberOrStringControl(attr, initialVal, unitZh, onUpdate) {
  const wrap = Object.assign(document.createElement('div'), { className: 'dm-unit-wrap' });
  const isNum = attr.type === 'number';
  const inp = Object.assign(document.createElement('input'), {
    type: isNum ? 'number' : 'text',
    className: 'adm-input',
    step: isNum ? (attr.format === 'integer' ? '1' : '0.1') : undefined,
    value: initialVal !== undefined && initialVal !== null ? String(initialVal) : '',
    placeholder: isNum ? '请输入数值' : '请输入文本',
  });
  inp.addEventListener('input', () => {
    if (inp.value.trim() === '') onUpdate(undefined);
    else onUpdate(isNum ? Number(inp.value) : inp.value.trim());
  });
  wrap.appendChild(inp);
  if (unitZh) {
    wrap.appendChild(Object.assign(document.createElement('span'), { className: 'dm-unit-badge', textContent: unitZh }));
  }
  return wrap;
}

function buildRangeControl(attr, initialVal, unitZh, onUpdate) {
  const isMonth = attr.format === 'monthRange';
  const kA = isMonth ? 'open' : 'min';
  const kB = isMonth ? 'close' : 'max';
  const cur = initialVal && typeof initialVal === 'object' ? { ...initialVal } : {};
  const row = Object.assign(document.createElement('div'), { className: 'dm-range-row' });
  const inpA = Object.assign(document.createElement('input'), {
    type: 'number',
    className: 'adm-input',
    min: isMonth ? '1' : undefined,
    max: isMonth ? '12' : undefined,
    placeholder: isMonth ? '起始月 (1-12)' : '区间下限',
    value: cur[kA] !== undefined ? String(cur[kA]) : '',
  });
  const inpB = Object.assign(document.createElement('input'), {
    type: 'number',
    className: 'adm-input',
    min: isMonth ? '1' : undefined,
    max: isMonth ? '12' : undefined,
    placeholder: isMonth ? '结束月 (1-12)' : '区间上限',
    value: cur[kB] !== undefined ? String(cur[kB]) : '',
  });
  const emit = () => {
    if (inpA.value === '' && inpB.value === '') onUpdate(undefined);
    else onUpdate({ [kA]: Number(inpA.value || 0), [kB]: Number(inpB.value || 0) });
  };
  inpA.addEventListener('input', emit);
  inpB.addEventListener('input', emit);
  row.append(
    inpA,
    Object.assign(document.createElement('span'), { className: 'adm-muted', textContent: '至' }),
    inpB,
    Object.assign(document.createElement('span'), { className: 'dm-unit-badge', textContent: unitZh || (isMonth ? '月' : '区间') }),
  );
  return row;
}

function buildListTagControl(initialVal, onUpdate) {
  const items = Array.isArray(initialVal) ? [...initialVal.map(String)] : [];
  const box = Object.assign(document.createElement('div'), { className: 'dm-tags-box' });
  const chipsEl = Object.assign(document.createElement('div'), { className: 'dm-tags-chips' });
  const inputRow = Object.assign(document.createElement('div'), { className: 'dm-unit-wrap' });
  const inp = Object.assign(document.createElement('input'), {
    type: 'text',
    className: 'adm-input',
    placeholder: '输入标签值后按回车或点击添加（如 speedboat、liveaboard）',
  });
  const addBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '+ 添加' });

  const redrawChips = () => {
    chipsEl.innerHTML = '';
    items.forEach((tag, idx) => {
      const chip = Object.assign(document.createElement('span'), { className: 'dm-chip' });
      const rm = Object.assign(document.createElement('button'), { type: 'button', textContent: '×' });
      rm.addEventListener('click', () => { items.splice(idx, 1); redrawChips(); onUpdate([...items]); });
      chip.append(Object.assign(document.createElement('span'), { textContent: tag }), rm);
      chipsEl.appendChild(chip);
    });
  };
  const appendCurrent = () => {
    const val = inp.value.trim();
    if (!val || items.includes(val)) return;
    items.push(val);
    inp.value = '';
    redrawChips();
    onUpdate([...items]);
  };
  addBtn.addEventListener('click', appendCurrent);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); appendCurrent(); } });
  redrawChips();
  inputRow.append(inp, addBtn);
  box.append(chipsEl, inputRow);
  return box;
}

function createAttributeWidgetNode(attr, curVal, unitZh, updateVal) {
  if (attr.type === 'boolean') {
    const sw = Object.assign(document.createElement('label'), { className: 'dm-switch' });
    const cb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: Boolean(curVal) });
    const txt = Object.assign(document.createElement('span'), { textContent: cb.checked ? '已开启（支持）' : '关闭（不开放）' });
    cb.addEventListener('change', () => { txt.textContent = cb.checked ? '已开启（支持）' : '关闭（不开放）'; updateVal(cb.checked); });
    sw.append(cb, txt);
    return sw;
  }
  if (attr.type === 'enum') {
    const sel = Object.assign(document.createElement('select'), { className: 'adm-input' });
    if (!attr.required) sel.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: '— 未设置 —' }));
    for (const opt of attr.enumOptions || []) {
      sel.appendChild(Object.assign(document.createElement('option'), {
        value: opt.value, textContent: `${opt.label?.['zh-CN'] || opt.value} (${opt.value})`, selected: curVal === opt.value,
      }));
    }
    if (attr.required && !curVal && attr.enumOptions?.[0]) updateVal(attr.enumOptions[0].value);
    sel.addEventListener('change', () => updateVal(sel.value || undefined));
    return sel;
  }
  if (attr.type === 'range') return buildRangeControl(attr, curVal, unitZh, updateVal);
  if (attr.type === 'localizedString') {
    return createI18nEditor({
      multiline: true, rows: 3,
      value: curVal && typeof curVal === 'object' ? curVal : {},
      onChange: (val) => updateVal(Object.keys(val).length > 0 ? val : undefined),
    }).el;
  }
  if (attr.type === 'list') return buildListTagControl(curVal, updateVal);
  return buildNumberOrStringControl(attr, curVal, unitZh, updateVal);
}

export function renderDynamicAttributeField(attr, entryData, onDataChange) {
  const wrapper = Object.assign(document.createElement('div'), { className: 'adm-field' });
  wrapper.dataset.attrKey = attr.key;
  wrapper.dataset.attrType = attr.type;

  const labelZh = attr.label?.['zh-CN'] || attr.key;
  const unitZh = attr.unit?.['zh-CN'] || attr.unit?.en || '';
  const metaHint = `[${attr.type} · ${attr.path}${unitZh ? ` · 单位 ${unitZh}` : ''}]`;
  const labelEl = Object.assign(document.createElement('label'), {
    className: 'adm-label',
    textContent: `${labelZh}${attr.required ? ' *' : ''} `,
  });
  labelEl.appendChild(Object.assign(document.createElement('span'), { className: 'adm-muted', textContent: metaHint }));
  const curVal = getAtDotPath(entryData, attr.path);
  const updateVal = (next) => { setAtDotPath(entryData, attr.path, next); onDataChange(); };
  wrapper.append(labelEl, createAttributeWidgetNode(attr, curVal, unitZh, updateVal));
  return wrapper;
}
