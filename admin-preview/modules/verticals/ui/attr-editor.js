import { ADMIN_LOCALES } from '/ui/kit/index.js';

const TYPE_LABELS = {
  number: '数字 (number)',
  string: '文本 (string)',
  boolean: '布尔开关 (boolean)',
  enum: '枚举单选 (enum)',
  range: '数值/月份区间 (range)',
  localizedString: '5语言富文本 (localizedString)',
  list: '多值列表 (list)',
};

const FORMAT_LABELS = {
  plain: '默认文本 (plain)',
  integer: '整数 (integer)',
  decimal: '小数 (decimal)',
  percent: '百分比 (percent)',
  currencyCny: '人民币 (currencyCny)',
  monthRange: '月份区间 (monthRange)',
  coords: '经纬度 (coords)',
  booleanBadge: '是否徽章 (booleanBadge)',
  enumLabel: '枚举标签 (enumLabel)',
};

export function syncDerivedProfileSpecs(profile) {
  const sorted = [...(profile.attributes || [])].map((a, idx) => ({ ...a, order: idx + 1 }));
  const filterWidgets = { boolean: 'boolean', range: 'range', list: 'multiSelect' };
  const autoFilters = sorted
    .filter((a) => a.filterable)
    .map((a, idx) => ({
      key: a.key,
      attributeKey: a.key,
      widget: filterWidgets[a.type] || 'select',
      order: idx + 2,
    }));
  const countryFilter = { key: 'country', attributeKey: 'country', widget: 'select', order: 1 };
  const compare = sorted
    .filter((a) => a.comparable)
    .map((a, idx) => ({ attributeKey: a.key, order: idx + 1 }));
  const cardAttrs = sorted.filter((a) => a.showOnCard).map((a) => a.key);
  const prevBadges = (profile.card?.badgeAttributeKeys || []).filter((k) => sorted.some((a) => a.key === k));
  return {
    ...profile,
    attributes: sorted,
    filters: [countryFilter, ...autoFilters],
    compare,
    card: {
      statAttributeKeys: cardAttrs,
      badgeAttributeKeys: prevBadges.length > 0 ? prevBadges : cardAttrs.slice(0, 1),
      showCoords: profile.card?.showCoords !== false,
      highlightLimit: Number(profile.card?.highlightLimit ?? 3),
    },
  };
}

function renderFiveLocaleInputs(titleText, valMap, readOnly, onMutate) {
  const wrap = Object.assign(document.createElement('div'), { className: 'adm-field' });
  wrap.appendChild(Object.assign(document.createElement('span'), { className: 'adm-label', textContent: titleText }));
  const row = Object.assign(document.createElement('div'), { className: 'vc-locale-row' });
  for (const loc of ADMIN_LOCALES) {
    const cell = Object.assign(document.createElement('label'), { className: 'vc-locale-mini' });
    cell.appendChild(Object.assign(document.createElement('span'), { textContent: loc.code }));
    const inp = Object.assign(document.createElement('input'), {
      type: 'text',
      className: 'adm-input',
      value: String(valMap?.[loc.code] || ''),
      disabled: readOnly,
    });
    inp.addEventListener('input', () => {
      const next = { ...(valMap || {}) };
      if (inp.value.trim()) next[loc.code] = inp.value;
      else delete next[loc.code];
      onMutate(next);
    });
    cell.appendChild(inp);
    row.appendChild(cell);
  }
  wrap.appendChild(row);
  return wrap;
}

function renderEnumOptionsEditor(attr, readOnly, onRefreshAll, onSoftUpdate) {
  const box = Object.assign(document.createElement('div'), { className: 'adm-field' });
  const head = Object.assign(document.createElement('div'), { className: 'vc-attr-head' });
  head.appendChild(Object.assign(document.createElement('span'), { className: 'adm-label', textContent: '枚举选项（enumOptions · 5语言标签）' }));
  if (!readOnly) {
    const addBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '+ 新增枚举项' });
    addBtn.addEventListener('click', () => {
      const list = [...(attr.enumOptions || [])];
      list.push({ value: `opt-${list.length + 1}`, label: { 'zh-CN': `选项${list.length + 1}`, en: `Option ${list.length + 1}` } });
      attr.enumOptions = list;
      onRefreshAll();
    });
    head.appendChild(addBtn);
  }
  box.appendChild(head);
  (attr.enumOptions || []).forEach((opt, oIdx) => {
    const row = Object.assign(document.createElement('div'), { className: 'vc-enum-row' });
    const valInp = Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', value: opt.value, placeholder: '枚举值', disabled: readOnly });
    valInp.addEventListener('input', () => { opt.value = valInp.value.trim(); onSoftUpdate(); });
    const locInputs = renderFiveLocaleInputs('选项标签', opt.label, readOnly, (m) => { opt.label = m; onSoftUpdate(); });
    const delBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '删除', disabled: readOnly });
    delBtn.addEventListener('click', () => { attr.enumOptions.splice(oIdx, 1); onRefreshAll(); });
    row.append(valInp, locInputs, delBtn);
    box.appendChild(row);
  });
  return box;
}

function renderAttrTopInputs(attr, readOnly, onRefreshAll, onSoftUpdate) {
  const grid = Object.assign(document.createElement('div'), { className: 'vc-grid-3' });
  const mkField = (lbl, ctrl) => {
    const f = Object.assign(document.createElement('div'), { className: 'adm-field' });
    f.append(Object.assign(document.createElement('label'), { className: 'adm-label', textContent: lbl }), ctrl);
    return f;
  };
  const keyInp = Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', value: attr.key, disabled: readOnly });
  keyInp.addEventListener('input', () => { attr.key = keyInp.value.trim(); onSoftUpdate(); });
  const pathInp = Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', value: attr.path, disabled: readOnly });
  pathInp.addEventListener('input', () => { attr.path = pathInp.value.trim(); onSoftUpdate(); });

  const typeSel = Object.assign(document.createElement('select'), { className: 'adm-input', disabled: readOnly });
  for (const [k, label] of Object.entries(TYPE_LABELS)) {
    typeSel.appendChild(Object.assign(document.createElement('option'), { value: k, textContent: label, selected: attr.type === k }));
  }
  typeSel.addEventListener('change', () => {
    attr.type = typeSel.value;
    if (attr.type !== 'localizedString') attr.translatable = false;
    if (attr.type === 'enum' && (!attr.enumOptions || attr.enumOptions.length === 0)) {
      attr.enumOptions = [{ value: 'standard', label: { 'zh-CN': '常规', en: 'Standard' } }];
    }
    onRefreshAll();
  });

  const fmtSel = Object.assign(document.createElement('select'), { className: 'adm-input', disabled: readOnly });
  for (const [k, label] of Object.entries(FORMAT_LABELS)) {
    fmtSel.appendChild(Object.assign(document.createElement('option'), { value: k, textContent: label, selected: (attr.format || 'plain') === k }));
  }
  fmtSel.addEventListener('change', () => { attr.format = fmtSel.value; onSoftUpdate(); });

  grid.append(mkField('属性 Key', keyInp), mkField('数据路径 Path', pathInp), mkField('类型 Type', typeSel), mkField('显示格式 Format', fmtSel));
  return grid;
}

function renderAttrFlagsBar(attr, readOnly, onSoftUpdate) {
  const bar = Object.assign(document.createElement('div'), { className: 'vc-switches' });
  const defs = [
    ['required', '必填'],
    ['translatable', '可翻译'],
    ['filterable', '用于筛选'],
    ['comparable', '用于对比'],
    ['showOnCard', '卡片展示'],
  ];
  for (const [prop, label] of defs) {
    const wrap = Object.assign(document.createElement('label'), { className: 'vc-switch-item' });
    const lockTranslatable = prop === 'translatable' && attr.type !== 'localizedString';
    const cb = Object.assign(document.createElement('input'), {
      type: 'checkbox',
      checked: Boolean(attr[prop]),
      disabled: readOnly || lockTranslatable,
    });
    cb.addEventListener('change', () => { attr[prop] = cb.checked; onSoftUpdate(); });
    wrap.append(cb, Object.assign(document.createElement('span'), { textContent: label }));
    bar.appendChild(wrap);
  }
  return bar;
}

function wireDragSort(cardEl, idx, list, readOnly, onReorder) {
  if (readOnly) return;
  cardEl.draggable = true;
  cardEl.addEventListener('dragstart', (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  });
  cardEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    cardEl.classList.add('is-dragover');
  });
  cardEl.addEventListener('dragleave', () => cardEl.classList.remove('is-dragover'));
  cardEl.addEventListener('drop', (e) => {
    e.preventDefault();
    cardEl.classList.remove('is-dragover');
    const fromIdx = Number.parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (Number.isNaN(fromIdx) || fromIdx === idx || fromIdx < 0 || fromIdx >= list.length) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(idx, 0, moved);
    list.forEach((item, i) => { item.order = i + 1; });
    onReorder();
  });
}

function createAttributeHeader(attr, idx, list, st) {
  const { readOnly, expandedKeys, onRefreshAll } = st;
  const head = Object.assign(document.createElement('div'), { className: 'vc-attr-head' });
  const left = Object.assign(document.createElement('div'), { className: 'vc-toolbar__group' });
  left.append(
    Object.assign(document.createElement('span'), { className: 'vc-drag-handle', textContent: '⋮⋮', title: '拖拽调整顺序' }),
    Object.assign(document.createElement('strong'), { textContent: `${idx + 1}. ${attr.label?.['zh-CN'] || attr.key}` }),
    Object.assign(document.createElement('span'), { className: 'vc-tag', textContent: `${attr.key} → ${attr.path}` }),
    Object.assign(document.createElement('span'), { className: 'vc-tag vc-tag--ok', textContent: attr.type }),
  );
  const right = Object.assign(document.createElement('div'), { className: 'vc-toolbar__group' });
  const isOpen = expandedKeys.has(attr.key);
  const toggleBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: isOpen ? '收起' : '编辑属性' });
  toggleBtn.addEventListener('click', () => {
    if (expandedKeys.has(attr.key)) expandedKeys.delete(attr.key);
    else expandedKeys.add(attr.key);
    onRefreshAll();
  });
  const upBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '↑', disabled: readOnly || idx === 0 });
  upBtn.addEventListener('click', () => { [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]]; onRefreshAll(); });
  const dnBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '↓', disabled: readOnly || idx === list.length - 1 });
  dnBtn.addEventListener('click', () => { [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]]; onRefreshAll(); });
  const delBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '移除', disabled: readOnly || list.length <= 1 });
  delBtn.addEventListener('click', () => { list.splice(idx, 1); onRefreshAll(); });
  right.append(upBtn, dnBtn, toggleBtn, delBtn);
  head.append(left, right);
  return head;
}

function createAttributeCard(attr, idx, list, st) {
  const { readOnly, expandedKeys, onRefreshAll, onSoftUpdate } = st;
  const card = Object.assign(document.createElement('div'), { className: 'vc-attr-card' });
  card.dataset.attrKey = attr.key;
  wireDragSort(card, idx, list, readOnly, onRefreshAll);
  card.appendChild(createAttributeHeader(attr, idx, list, st));

  if (expandedKeys.has(attr.key)) {
    const body = Object.assign(document.createElement('div'), { className: 'vc-attr-body' });
    body.append(
      renderAttrTopInputs(attr, readOnly, onRefreshAll, onSoftUpdate),
      renderAttrFlagsBar(attr, readOnly, onSoftUpdate),
      renderFiveLocaleInputs('属性标签（5语言）*', attr.label, readOnly, (m) => { attr.label = m; onSoftUpdate(); }),
      renderFiveLocaleInputs('单位 Unit（5语言，可选）', attr.unit || {}, readOnly, (m) => {
        if (Object.keys(m).length > 0) attr.unit = m;
        else delete attr.unit;
        onSoftUpdate();
      }),
    );
    if (attr.type === 'enum') body.appendChild(renderEnumOptionsEditor(attr, readOnly, onRefreshAll, onSoftUpdate));
    card.appendChild(body);
  }
  return card;
}

export function renderAttributesSection(container, st) {
  container.innerHTML = '';
  const list = st.profile.attributes;
  list.sort((a, b) => a.order - b.order);
  const head = Object.assign(document.createElement('div'), { className: 'vc-panel__title' });
  head.appendChild(Object.assign(document.createElement('span'), { textContent: `目的地属性列表（共 ${list.length} 项 · 支持拖拽排序）` }));
  if (!st.readOnly) {
    const addBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--primary adm-btn--sm', textContent: '+ 新增属性' });
    addBtn.addEventListener('click', () => {
      const nextIdx = list.length + 1;
      const newKey = `customAttr${nextIdx}`;
      list.push({
        key: newKey, path: `stats.${newKey}`, type: 'number', format: 'integer',
        unit: { 'zh-CN': 'm', en: 'm', 'zh-Hant': 'm', ja: 'm', ko: 'm' },
        label: { 'zh-CN': `新增指标${nextIdx}`, en: `Metric ${nextIdx}`, 'zh-Hant': `新增指標${nextIdx}`, ja: `指標${nextIdx}`, ko: `지표${nextIdx}` },
        required: false, translatable: false, filterable: false, comparable: true, showOnCard: true, order: nextIdx,
      });
      st.expandedKeys.add(newKey);
      st.onRefreshAll();
    });
    head.appendChild(addBtn);
  }
  const wrap = Object.assign(document.createElement('div'), { className: 'vc-attr-list' });
  list.forEach((attr, idx) => wrap.appendChild(createAttributeCard(attr, idx, list, st)));
  container.append(head, wrap);
}

export function renderSectionsEditor(container, st) {
  container.innerHTML = '';
  const sections = st.profile.sections;
  sections.sort((a, b) => a.order - b.order);
  const head = Object.assign(document.createElement('div'), { className: 'vc-panel__title' });
  head.appendChild(Object.assign(document.createElement('span'), { textContent: `详情页区块顺序与开关（共 ${sections.length} 个区块）` }));
  const listWrap = Object.assign(document.createElement('div'), { className: 'vc-sec-list' });
  sections.forEach((sec, idx) => {
    const row = Object.assign(document.createElement('div'), { className: 'vc-sec-row' });
    wireDragSort(row, idx, sections, st.readOnly, st.onRefreshAll);
    const left = Object.assign(document.createElement('label'), { className: 'vc-switch-item' });
    const cb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: Boolean(sec.enabled), disabled: st.readOnly });
    cb.addEventListener('change', () => { sec.enabled = cb.checked; st.onSoftUpdate(); });
    left.append(
      Object.assign(document.createElement('span'), { className: 'vc-drag-handle', textContent: '⋮⋮' }),
      cb,
      Object.assign(document.createElement('span'), { textContent: `${idx + 1}. ${sec.label?.['zh-CN'] || sec.id} (${sec.id})` }),
    );
    const right = Object.assign(document.createElement('div'), { className: 'vc-toolbar__group' });
    const up = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '↑', disabled: st.readOnly || idx === 0 });
    up.addEventListener('click', () => { [sections[idx - 1], sections[idx]] = [sections[idx], sections[idx - 1]]; st.onRefreshAll(); });
    const dn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '↓', disabled: st.readOnly || idx === sections.length - 1 });
    dn.addEventListener('click', () => { [sections[idx], sections[idx + 1]] = [sections[idx + 1], sections[idx]]; st.onRefreshAll(); });
    right.append(up, dn);
    row.append(left, right);
    listWrap.appendChild(row);
  });
  container.append(head, listWrap);
}
