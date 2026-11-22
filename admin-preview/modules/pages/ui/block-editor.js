const DISALLOWED_HTML_RE = /<\/?[a-z][a-z0-9-]*(\s[^>]*)?>/i;
const DISALLOWED_LINK_RE = /\]\(\s*(?:javascript|vbscript|data):/i;

export const BLOCK_TYPE_LABELS = {
  heading: '标题块（Heading）',
  paragraph: '段落块（Paragraph）',
  list: '列表块（List）',
  faq: '问答组（FAQ）',
  callout: '提示框（Callout）',
};

const FAQ_GROUP_OPTIONS = [
  { value: '', label: '自定义分组（不合并自动聚合池）' },
  { value: 'transport', label: 'transport · 交通接驳' },
  { value: 'season', label: 'season · 雪季与雪况' },
  { value: 'stays', label: 'stays · 住滑住宿' },
  { value: 'booking', label: 'booking · 套餐与预订' },
  { value: 'family', label: 'family · 亲子与初学' },
  { value: 'visa', label: 'visa · 签证与支付' },
];

export function hasInvalidRestrictedMarkdown(text) {
  const s = String(text || '');
  return DISALLOWED_HTML_RE.test(s) || DISALLOWED_LINK_RE.test(s);
}

export function createEmptyBlock(type, indexNum) {
  const idx = String(indexNum).padStart(2, '0');
  if (type === 'heading') return { type: 'heading', level: 2, text: { 'zh-CN': '新章节标题' } };
  if (type === 'list') return { type: 'list', ordered: false, heading: { 'zh-CN': '要点清单' }, items: [{ 'zh-CN': '列表条目一' }] };
  if (type === 'faq') return { type: 'faq', groupKey: 'booking', icon: 'chat', heading: { 'zh-CN': '常见问题分组' }, items: [{ q: { 'zh-CN': '请输入问题？' }, a: { 'zh-CN': '请输入客观解答。' } }] };
  if (type === 'callout') return { type: 'callout', variant: 'info', heading: { 'zh-CN': '重要说明' }, body: { 'zh-CN': '请填写提示框正文，支持 **粗体** 与 [链接](/contact/)。' } };
  return { type: 'paragraph', index: idx, body: { 'zh-CN': '请输入段落内容，支持 **粗体** 与 [链接](/contact/)。' } };
}

function setLocValue(mapObj, locale, rawVal) {
  if (!mapObj || typeof mapObj !== 'object') return;
  if (String(rawVal || '').trim()) mapObj[locale] = rawVal;
  else delete mapObj[locale];
}

function insertAtCursor(textarea, snippet) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const selected = textarea.value.slice(start, end);
  const next = typeof snippet === 'function' ? snippet(selected) : snippet;
  textarea.value = textarea.value.slice(0, start) + next + textarea.value.slice(end);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
}

function buildMarkdownField(labelText, mapObj, locale, onDirty, rows = 3) {
  const wrap = Object.assign(document.createElement('div'), { className: 'adm-field' });
  const topRow = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  topRow.style.justifyContent = 'space-between';
  const label = Object.assign(document.createElement('label'), { className: 'adm-label', textContent: labelText });
  const tools = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const area = Object.assign(document.createElement('textarea'), {
    className: 'adm-textarea',
    rows,
    value: String(mapObj?.[locale] || ''),
    placeholder: `请输入 ${locale} 文本（支持 **粗体**、[文字](/path/)、- 列表）…`,
  });
  const errEl = Object.assign(document.createElement('p'), { className: 'adm-field__error', hidden: true });

  for (const t of [
    { label: '**粗体**', fn: (sel) => `**${sel || '重点内容'}**` },
    { label: '[链接]', fn: (sel) => `[${sel || '链接文字'}](/contact/)` },
    { label: '• 列表', fn: (sel) => `\n- ${sel || '列表项'}` },
  ]) {
    const btn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: t.label });
    btn.addEventListener('click', () => insertAtCursor(area, t.fn));
    tools.appendChild(btn);
  }

  area.addEventListener('input', () => {
    const bad = hasInvalidRestrictedMarkdown(area.value);
    errEl.hidden = !bad;
    errEl.textContent = bad ? '禁止嵌入原始 HTML 标签或 javascript: 危险协议，仅支持受限 Markdown 子集' : '';
    setLocValue(mapObj, locale, area.value);
    onDirty();
  });
  topRow.append(label, tools);
  wrap.append(topRow, area, errEl);
  return wrap;
}

function buildPlainLocField(labelText, mapObj, locale, onDirty, placeholder = '') {
  const wrap = Object.assign(document.createElement('div'), { className: 'adm-field' });
  const label = Object.assign(document.createElement('label'), { className: 'adm-label', textContent: labelText });
  const input = Object.assign(document.createElement('input'), {
    type: 'text',
    className: 'adm-input',
    value: String(mapObj?.[locale] || ''),
    placeholder: placeholder || `请输入 ${locale} 文本…`,
  });
  input.addEventListener('input', () => {
    setLocValue(mapObj, locale, input.value);
    onDirty();
  });
  wrap.append(label, input);
  return wrap;
}

function renderListItemsControls(block, locale, rerender, onDirty) {
  const box = Object.assign(document.createElement('div'), { className: 'adm-form' });
  block.items = Array.isArray(block.items) ? block.items : [];
  block.items.forEach((item, idx) => {
    const row = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
    row.style.alignItems = 'flex-start';
    const isStructured = item && typeof item.title === 'object' && item.title !== null;
    const targetMap = isStructured ? item.title : item;
    const field = buildMarkdownField(`列表项 #${idx + 1}`, targetMap, locale, onDirty, 2);
    field.style.flex = '1';
    const delBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '移除' });
    delBtn.addEventListener('click', () => {
      if (block.items.length <= 1) return;
      block.items.splice(idx, 1);
      onDirty();
      rerender();
    });
    row.append(field, delBtn);
    box.appendChild(row);
  });
  const addBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '+ 新增列表项' });
  addBtn.addEventListener('click', () => {
    block.items.push({ [locale]: '新列表条目' });
    onDirty();
    rerender();
  });
  box.appendChild(addBtn);
  return box;
}

function renderFaqItemsControls(block, locale, rerender, onDirty) {
  const box = Object.assign(document.createElement('div'), { className: 'adm-form' });
  block.items = Array.isArray(block.items) ? block.items : [];
  block.items.forEach((qa, idx) => {
    qa.q = qa.q || {};
    qa.a = qa.a || {};
    const card = Object.assign(document.createElement('div'), { className: 'adm-i18n-editor' });
    const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
    head.appendChild(Object.assign(document.createElement('strong'), { textContent: `问答 #${idx + 1}` }));
    const delBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '删除此问答' });
    delBtn.addEventListener('click', () => {
      block.items.splice(idx, 1);
      onDirty();
      rerender();
    });
    head.appendChild(delBtn);
    card.append(head, buildPlainLocField('问题（Q）', qa.q, locale, onDirty), buildMarkdownField('回答（A，受限 Markdown）', qa.a, locale, onDirty, 2));
    box.appendChild(card);
  });
  const addQa = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '+ 在本组新增自定义问答' });
  addQa.addEventListener('click', () => {
    block.items.push({ q: { [locale]: '新常见问题？' }, a: { [locale]: '请填写核验后的回答。' } });
    onDirty();
    rerender();
  });
  box.appendChild(addQa);
  return box;
}

function populateBlockFields(body, block, locale, rerender, onDirty) {
  if (block.type === 'heading') {
    block.text = block.text || {};
    block.subtitle = block.subtitle || {};
    const lvlSel = Object.assign(document.createElement('select'), { className: 'adm-input' });
    for (const lv of [2, 3]) lvlSel.appendChild(Object.assign(document.createElement('option'), { value: String(lv), textContent: `H${lv} 标题`, selected: (block.level || 2) === lv }));
    lvlSel.addEventListener('change', () => { block.level = Number(lvlSel.value); onDirty(); });
    body.append(lvlSel, buildPlainLocField('标题文本', block.text, locale, onDirty), buildMarkdownField('可选副标题', block.subtitle, locale, onDirty, 2));
    return;
  }
  if (block.type === 'paragraph') {
    block.heading = block.heading || {};
    block.body = block.body || {};
    const idxInput = Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', value: block.index || '', placeholder: '可选序号（如 01、02）' });
    idxInput.addEventListener('input', () => {
      if (idxInput.value.trim()) block.index = idxInput.value.trim();
      else delete block.index;
      onDirty();
    });
    body.append(idxInput, buildPlainLocField('段落小标题（可选）', block.heading, locale, onDirty), buildMarkdownField('段落正文（受限 Markdown）', block.body, locale, onDirty, 4));
    return;
  }
  if (block.type === 'list') {
    block.heading = block.heading || {};
    const ordChk = Object.assign(document.createElement('input'), { type: 'checkbox', checked: Boolean(block.ordered) });
    ordChk.addEventListener('change', () => { block.ordered = ordChk.checked; onDirty(); });
    const chkWrap = Object.assign(document.createElement('label'), { className: 'adm-inline-actions' });
    chkWrap.append(ordChk, document.createTextNode('使用有序编号列表（1. 2. 3.）'));
    body.append(chkWrap, buildPlainLocField('列表标题（可选）', block.heading, locale, onDirty), renderListItemsControls(block, locale, rerender, onDirty));
    return;
  }
  if (block.type === 'faq') {
    block.heading = block.heading || {};
    const grpSel = Object.assign(document.createElement('select'), { className: 'adm-input' });
    for (const opt of FAQ_GROUP_OPTIONS) grpSel.appendChild(Object.assign(document.createElement('option'), { value: opt.value, textContent: opt.label, selected: (block.groupKey || '') === opt.value }));
    grpSel.addEventListener('change', () => {
      if (grpSel.value) block.groupKey = grpSel.value;
      else delete block.groupKey;
      onDirty();
    });
    body.append(grpSel, buildPlainLocField('分组标题', block.heading, locale, onDirty), renderFaqItemsControls(block, locale, rerender, onDirty));
    return;
  }
  block.heading = block.heading || {};
  block.body = block.body || {};
  const varSel = Object.assign(document.createElement('select'), { className: 'adm-input' });
  for (const v of ['info', 'warning', 'note', 'accent']) varSel.appendChild(Object.assign(document.createElement('option'), { value: v, textContent: `样式：${v}`, selected: (block.variant || 'info') === v }));
  varSel.addEventListener('change', () => { block.variant = varSel.value; onDirty(); });
  body.append(varSel, buildPlainLocField('提示框标题（可选）', block.heading, locale, onDirty), buildMarkdownField('提示框正文', block.body, locale, onDirty, 3));
}

export function renderBlockListEditor(host, pageData, locale, onDirty) {
  const rerender = () => renderBlockListEditor(host, pageData, locale, onDirty);
  host.innerHTML = '';
  pageData.blocks = Array.isArray(pageData.blocks) ? pageData.blocks : [];

  pageData.blocks.forEach((block, idx) => {
    const card = Object.assign(document.createElement('div'), { className: 'adm-i18n-editor' });
    card.style.marginBottom = '12px';
    card.dataset.blockIndex = String(idx);
    const header = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
    header.appendChild(Object.assign(document.createElement('strong'), { textContent: `#${idx + 1} · ${BLOCK_TYPE_LABELS[block.type] || block.type}` }));

    const ctrls = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
    const upBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '↑ 上移', disabled: idx === 0 });
    const downBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '↓ 下移', disabled: idx === pageData.blocks.length - 1 });
    const delBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--danger adm-btn--sm', textContent: '删除块' });
    upBtn.addEventListener('click', () => { [pageData.blocks[idx - 1], pageData.blocks[idx]] = [pageData.blocks[idx], pageData.blocks[idx - 1]]; onDirty(); rerender(); });
    downBtn.addEventListener('click', () => { [pageData.blocks[idx + 1], pageData.blocks[idx]] = [pageData.blocks[idx], pageData.blocks[idx + 1]]; onDirty(); rerender(); });
    delBtn.addEventListener('click', () => { pageData.blocks.splice(idx, 1); onDirty(); rerender(); });
    ctrls.append(upBtn, downBtn, delBtn);
    header.appendChild(ctrls);

    const body = Object.assign(document.createElement('div'), { className: 'adm-form' });
    populateBlockFields(body, block, locale, rerender, onDirty);
    card.append(header, body);
    host.appendChild(card);
  });

  const addBar = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  for (const [bType, bLabel] of Object.entries(BLOCK_TYPE_LABELS)) {
    const addBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: `+ ${bLabel.split('（')[0]}` });
    addBtn.dataset.addBlockType = bType;
    addBtn.addEventListener('click', () => {
      pageData.blocks.push(createEmptyBlock(bType, pageData.blocks.length + 1));
      onDirty();
      rerender();
    });
    addBar.appendChild(addBtn);
  }
  host.appendChild(addBar);
}
