import {
  adminApi,
  bindAsyncButton,
  renderDataTable,
  showToast,
} from '/ui/kit/index.js';

const GENERATABLE_COLLECTION_OPTIONS = [
  { value: 'guides', label: '攻略指南（guides）' },
  { value: 'collections', label: '主题合集（collections）' },
  { value: 'regions', label: '目的地大区（regions）' },
  { value: 'resorts', label: '目的地雪场（resorts）' },
];

function createFieldBlock(labelText, controlEl, hintText = '') {
  const wrap = Object.assign(document.createElement('div'), { className: 'adm-field' });
  wrap.appendChild(Object.assign(document.createElement('label'), { className: 'adm-label', textContent: labelText }));
  wrap.appendChild(controlEl);
  if (hintText) {
    wrap.appendChild(Object.assign(document.createElement('small'), { className: 'adm-muted', textContent: hintText }));
  }
  return wrap;
}

function coerceFactScalar(rawText) {
  const trimmed = rawText.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed.includes(',')) return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  return trimmed;
}

function serializeFactsToYamlLines(factsObj) {
  if (!factsObj || typeof factsObj !== 'object') return '';
  const lines = [];
  for (const [k, v] of Object.entries(factsObj)) {
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${String(item)}`);
    } else {
      lines.push(`${k}: ${JSON.stringify(v)}`);
    }
  }
  return lines.join('\n');
}

function appendKvFactRow(kvList, keyVal = '', rawVal = '') {
  const row = Object.assign(document.createElement('div'), { className: 'adm-ai-kv-row' });
  const kIn = Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', placeholder: '事实键名（如 nisekoTopM）', value: keyVal });
  const vIn = Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', placeholder: '客观值（数字/文本/逗号分隔列表）', value: rawVal });
  const delBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '移除' });
  delBtn.addEventListener('click', () => row.remove());
  row.append(kIn, vIn, delBtn);
  kvList.appendChild(row);
}

function readKvFactMap(kvList) {
  const out = {};
  for (const row of kvList.querySelectorAll('.adm-ai-kv-row')) {
    const inputs = row.querySelectorAll('input');
    const k = inputs[0]?.value.trim() || '';
    const v = inputs[1]?.value.trim() || '';
    if (k && v !== '') out[k] = coerceFactScalar(v);
  }
  return out;
}

function createFactsEditor() {
  const root = Object.assign(document.createElement('div'), { className: 'adm-ai-box' });
  const modeBar = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const kvBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm is-active', textContent: '键值对编辑' });
  const yamlBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: 'YAML 编辑' });
  const addRowBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '+ 添加事实项' });
  const kvList = Object.assign(document.createElement('div'), { className: 'adm-ai-kv-list' });
  const yamlArea = Object.assign(document.createElement('textarea'), { className: 'adm-textarea adm-code', rows: 6, hidden: true, placeholder: 'nisekoTopM: 1200\nnisekoVerticalM: 940' });
  let mode = 'kv';

  kvBtn.addEventListener('click', () => { mode = 'kv'; kvList.hidden = false; addRowBtn.hidden = false; yamlArea.hidden = true; });
  yamlBtn.addEventListener('click', () => {
    if (mode === 'kv') yamlArea.value = serializeFactsToYamlLines(readKvFactMap(kvList));
    mode = 'yaml'; kvList.hidden = true; addRowBtn.hidden = true; yamlArea.hidden = false;
  });
  addRowBtn.addEventListener('click', () => appendKvFactRow(kvList));
  appendKvFactRow(kvList);
  modeBar.append(kvBtn, yamlBtn, addRowBtn);
  root.append(modeBar, kvList, yamlArea);

  return {
    el: root,
    setFacts: (factsObj) => {
      kvList.innerHTML = '';
      const entries = Object.entries(factsObj || {});
      if (entries.length === 0) appendKvFactRow(kvList);
      for (const [k, v] of entries) appendKvFactRow(kvList, k, Array.isArray(v) ? v.join(', ') : String(v));
      yamlArea.value = serializeFactsToYamlLines(factsObj || {});
    },
    readPayload: () => (mode === 'yaml' ? { requiredFactsYaml: yamlArea.value } : { requiredFacts: readKvFactMap(kvList) }),
  };
}

function renderResortChoices(grid, resorts, selected, query) {
  grid.innerHTML = '';
  if (!resorts.length) {
    grid.appendChild(Object.assign(document.createElement('span'), { className: 'adm-muted', textContent: '当前站点暂无已录入的目的地条目' }));
    return;
  }
  for (const r of resorts) {
    const labelText = `${r.titleZh || r.slug} (${r.slug})`;
    if (query && !labelText.toLowerCase().includes(query)) continue;
    const lbl = Object.assign(document.createElement('label'), { className: 'adm-ai-chip' });
    const cb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: selected.has(r.slug) });
    cb.addEventListener('change', () => {
      if (cb.checked) selected.add(r.slug);
      else selected.delete(r.slug);
    });
    lbl.append(cb, document.createTextNode(` ${labelText}`));
    grid.appendChild(lbl);
  }
}

function createResortMultiPicker(resorts) {
  const wrap = Object.assign(document.createElement('div'), { className: 'adm-ai-box' });
  const filterIn = Object.assign(document.createElement('input'), { type: 'search', className: 'adm-input', placeholder: '搜索关联目的地（按名称或 slug 筛选）…' });
  const grid = Object.assign(document.createElement('div'), { className: 'adm-ai-chip-grid' });
  const selected = new Set();
  const refresh = () => renderResortChoices(grid, resorts, selected, filterIn.value.trim().toLowerCase());

  filterIn.addEventListener('input', refresh);
  refresh();
  wrap.append(filterIn, grid);
  return {
    el: wrap,
    getSlugs: () => Array.from(selected),
    setSlugs: (slugs) => { selected.clear(); for (const s of slugs || []) selected.add(s); refresh(); },
  };
}

function createBriefFormControls(resorts) {
  const colSel = Object.assign(document.createElement('select'), { className: 'adm-input' });
  for (const o of GENERATABLE_COLLECTION_OPTIONS) {
    colSel.appendChild(Object.assign(document.createElement('option'), { value: o.value, textContent: o.label }));
  }
  return {
    colSel,
    slugIn: Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', placeholder: '留空则自动派生 kebab-case slug' }),
    topicIn: Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', placeholder: '例如：二世谷四山接驳巴士与夜滑路线怎么规划？' }),
    questionsIn: Object.assign(document.createElement('textarea'), { className: 'adm-textarea', rows: 4, placeholder: '每行填写一个必须回答的问题（至少 1 条）' }),
    pubDateIn: Object.assign(document.createElement('input'), { type: 'date', className: 'adm-input', value: new Date().toISOString().slice(0, 10) }),
    countryIn: Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', placeholder: '可选，如 japan / china' }),
    regionIn: Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', placeholder: '可选，如 hokkaido / jilin' }),
    minCharsIn: Object.assign(document.createElement('input'), { type: 'number', className: 'adm-input', placeholder: '最少字数 (如 400)' }),
    maxCharsIn: Object.assign(document.createElement('input'), { type: 'number', className: 'adm-input', placeholder: '最多字数 (如 1200)' }),
    secCountIn: Object.assign(document.createElement('input'), { type: 'number', className: 'adm-input', placeholder: '小节数 (1-12)' }),
    resortPicker: createResortMultiPicker(resorts),
    factsEditor: createFactsEditor(),
  };
}

function collectAndValidateBriefForm(ctrls, errBox) {
  errBox.hidden = true;
  const topic = ctrls.topicIn.value.trim();
  const questions = ctrls.questionsIn.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const fail = (msg) => { errBox.textContent = msg; errBox.hidden = false; throw new Error(msg); };
  if (topic.length < 2) fail('请填写选题（topic 至少 2 个字符）');
  if (questions.length === 0) fail('请至少填写 1 个要回答的问题');

  const minC = ctrls.minCharsIn.value ? Number(ctrls.minCharsIn.value) : undefined;
  const maxC = ctrls.maxCharsIn.value ? Number(ctrls.maxCharsIn.value) : undefined;
  const secC = ctrls.secCountIn.value ? Number(ctrls.secCountIn.value) : undefined;
  if (minC !== undefined && maxC !== undefined && minC > maxC) fail('目标最少字数不能大于最多字数');

  return {
    collection: ctrls.colSel.value,
    ...(ctrls.slugIn.value.trim() ? { slug: ctrls.slugIn.value.trim() } : {}),
    topic,
    questions,
    ...(ctrls.countryIn.value.trim() ? { country: ctrls.countryIn.value.trim() } : {}),
    ...(ctrls.regionIn.value.trim() ? { region: ctrls.regionIn.value.trim() } : {}),
    ...(ctrls.pubDateIn.value ? { publishedAt: ctrls.pubDateIn.value } : {}),
    relatedResortSlugs: ctrls.resortPicker.getSlugs(),
    targetLength: { ...(minC ? { minChars: minC } : {}), ...(maxC ? { maxChars: maxC } : {}), ...(secC ? { sectionCount: secC } : {}) },
    ...ctrls.factsEditor.readPayload(),
  };
}

function populateBriefForm(ctrls, briefObj) {
  ctrls.colSel.value = briefObj.collection || 'guides';
  ctrls.slugIn.value = briefObj.slug || '';
  ctrls.topicIn.value = briefObj.topic || '';
  ctrls.questionsIn.value = (briefObj.questions || []).join('\n');
  ctrls.countryIn.value = briefObj.country || '';
  ctrls.regionIn.value = briefObj.region || '';
  ctrls.pubDateIn.value = briefObj.publishedAt || new Date().toISOString().slice(0, 10);
  ctrls.minCharsIn.value = briefObj.targetLength?.minChars ?? '';
  ctrls.maxCharsIn.value = briefObj.targetLength?.maxChars ?? '';
  ctrls.secCountIn.value = briefObj.targetLength?.sectionCount ?? '';
  ctrls.resortPicker.setSlugs(briefObj.relatedResortSlugs || []);
  ctrls.factsEditor.setFacts(briefObj.requiredFacts || {});
}

function buildBriefRowActions(row, overview, canGenerate, onEditBrief, onReload) {
  const aiOk = Boolean(overview.aiStatus?.configured);
  const aiReason = overview.aiStatus?.reason || '未配置 AI 服务';
  const bar = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const loadBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '载入编辑' });
  const genBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--primary adm-btn--sm',
    textContent: '生成草稿',
    disabled: !canGenerate || !aiOk,
    title: !aiOk ? aiReason : '提交异步 AI 草稿生成任务',
  });
  loadBtn.addEventListener('click', () => onEditBrief(row.raw.brief));
  bindAsyncButton(genBtn, async () => {
    const res = await adminApi.post('/ai-studio/generate', { siteId: overview.siteId, slug: row.slug, allowOverwriteDraft: true });
    showToast(`已加入生成队列 #${res.job.id.slice(0, 8)}`, 'success');
    await onReload();
  }, { onError: (err) => showToast(err.message, 'error') });
  bar.append(loadBtn, genBtn);
  return bar;
}

function renderSavedBriefsTable(tableHost, overview, canGenerate, onEditBrief, onReload) {
  renderDataTable(tableHost, {
    rows: overview.briefs.map((b) => ({
      slug: b.slug,
      collection: b.brief.collection,
      topic: b.brief.topic,
      questionCount: b.brief.questions?.length || 0,
      revisionCount: b.revisionNotes?.length || 0,
      raw: b,
    })),
    filterPlaceholder: '按 Brief slug 或选题关键词筛选…',
    columns: [
      { key: 'collection', label: '集合' },
      { key: 'slug', label: 'Slug' },
      { key: 'topic', label: '选题' },
      { key: 'questionCount', label: '问题数' },
      { key: 'revisionCount', label: '退回说明', render: (r) => (r.revisionCount > 0 ? `${r.revisionCount} 条` : '-') },
      {
        key: 'actions',
        label: '操作',
        sortable: false,
        render: (r) => buildBriefRowActions(r, overview, canGenerate, onEditBrief, onReload),
      },
    ],
  });
}

function buildBriefFormActions(ctrls, errBox, overview, shellCtx, onReload) {
  const canGenerate = Boolean(shellCtx.user?.permissions?.includes('ai:generate'));
  const aiOk = Boolean(overview.aiStatus?.configured);
  const aiReason = overview.aiStatus?.reason || '未配置 AI 环境变量';
  const btnBar = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const saveBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline', textContent: '保存选题 Brief', disabled: !canGenerate });
  const saveGenBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--primary',
    textContent: '保存并生成 AI 草稿',
    disabled: !canGenerate || !aiOk,
    title: !aiOk ? aiReason : '保存 Brief 后立即提交 AI 草稿生成任务',
  });
  btnBar.append(saveBtn, saveGenBtn);
  if (!aiOk) btnBar.appendChild(Object.assign(document.createElement('span'), { className: 'adm-muted', textContent: `生成已置灰：${aiReason}` }));

  bindAsyncButton(saveBtn, async () => {
    const brief = collectAndValidateBriefForm(ctrls, errBox);
    const res = await adminApi.post('/ai-studio/briefs', { siteId: overview.siteId, brief });
    ctrls.slugIn.value = res.slug;
    showToast(`Brief 已保存至 ${res.relPath}（提交 ${res.commitHash.slice(0, 8)}）`, 'success');
    await shellCtx.refreshShell();
    await onReload();
  }, { onError: (err) => showToast(err.message, 'error') });

  bindAsyncButton(saveGenBtn, async () => {
    const brief = collectAndValidateBriefForm(ctrls, errBox);
    const res = await adminApi.post('/ai-studio/generate', { siteId: overview.siteId, brief, saveBrief: true, allowOverwriteDraft: true });
    showToast(`Brief 已保存并提交生成任务 #${res.job.id.slice(0, 8)}`, 'success');
    await shellCtx.refreshShell();
    await onReload();
  }, { onError: (err) => showToast(err.message, 'error') });
  return btnBar;
}

export function renderBriefStudioPanel(host, { overview, shellCtx, onReload }) {
  host.innerHTML = '';
  const canGenerate = Boolean(shellCtx.user?.permissions?.includes('ai:generate'));
  const formCard = Object.assign(document.createElement('section'), { className: 'adm-ai-card' });
  formCard.appendChild(Object.assign(document.createElement('h3'), { textContent: '新建 / 编辑选题 Brief' }));
  const ctrls = createBriefFormControls(overview.resorts || []);
  const errBox = Object.assign(document.createElement('p'), { className: 'adm-field__error', hidden: true });

  const row1 = Object.assign(document.createElement('div'), { className: 'adm-ai-grid-3' });
  row1.append(createFieldBlock('目标集合 *', ctrls.colSel), createFieldBlock('预设 Slug', ctrls.slugIn), createFieldBlock('发布日期', ctrls.pubDateIn));
  const row2 = Object.assign(document.createElement('div'), { className: 'adm-ai-grid-2' });
  row2.append(createFieldBlock('国家 (country)', ctrls.countryIn), createFieldBlock('区域 (region)', ctrls.regionIn));
  const row3 = Object.assign(document.createElement('div'), { className: 'adm-ai-grid-3' });
  row3.append(createFieldBlock('最少字数', ctrls.minCharsIn), createFieldBlock('最多字数', ctrls.maxCharsIn), createFieldBlock('正文小节数', ctrls.secCountIn));

  formCard.append(
    row1,
    createFieldBlock('核心选题 (topic) *', ctrls.topicIn),
    createFieldBlock('要回答的问题列表 (questions，每行一条) *', ctrls.questionsIn),
    row2,
    createFieldBlock('关联目的地 (relatedResortSlugs)', ctrls.resortPicker.el),
    createFieldBlock('必须引用的客观事实 (requiredFacts)', ctrls.factsEditor.el),
    row3,
    errBox,
    buildBriefFormActions(ctrls, errBox, overview, shellCtx, onReload),
  );

  const listCard = Object.assign(document.createElement('section'), { className: 'adm-ai-card' });
  listCard.appendChild(Object.assign(document.createElement('h3'), { textContent: `已保存选题 Brief（${overview.briefs.length}）` }));
  const tableHost = document.createElement('div');
  listCard.appendChild(tableHost);
  renderSavedBriefsTable(tableHost, overview, canGenerate, (b) => { populateBriefForm(ctrls, b); formCard.scrollIntoView({ behavior: 'smooth' }); }, onReload);
  host.append(formCard, listCard);
}
