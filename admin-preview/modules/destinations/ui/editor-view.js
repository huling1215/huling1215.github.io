import {
  adminApi,
  bindAsyncButton,
  createI18nEditor,
  openDialog,
  html,
  showToast,
} from '/ui/kit/index.js';
import { renderLiveVerticalPreview } from '/modules/verticals/ui/preview.js';
import { renderDynamicAttributeField, setAtDotPath } from './field-widgets.js';

export function buildBlankDestinationEntry(profile, user) {
  const today = new Date().toISOString().slice(0, 10);
  const entry = {
    slug: '',
    status: 'offline',
    sourceType: 'editorial',
    sample: true,
    featured: false,
    updatedAt: today,
    country: profile.id === 'ski' ? 'china' : 'malaysia',
    region: '',
    regionName: { 'zh-CN': '' },
    name: { 'zh-CN': '' },
    summary: { 'zh-CN': '' },
    coords: { lat: 0, lng: 0 },
    highlights: [],
    faq: [],
    verification: {
      verifiedBy: user?.username || 'editorial',
      verifiedAt: today,
      source: { 'zh-CN': '运营后台公开营运数据核验' },
    },
  };
  for (const attr of profile.attributes || []) {
    if (!attr.required) continue;
    if (attr.type === 'number') setAtDotPath(entry, attr.path, 10);
    else if (attr.type === 'enum' && attr.enumOptions?.[0]) setAtDotPath(entry, attr.path, attr.enumOptions[0].value);
    else if (attr.type === 'range') {
      setAtDotPath(entry, attr.path, attr.format === 'monthRange' ? { open: 4, close: 11 } : { min: 24, max: 29 });
    } else if (attr.type === 'list') setAtDotPath(entry, attr.path, ['standard']);
  }
  return entry;
}

function renderBaseFieldsCard(cardEl, st) {
  const d = st.entry;
  cardEl.innerHTML = '';
  cardEl.appendChild(Object.assign(document.createElement('h3'), { className: 'dm-card__title', textContent: '1. 基础标识、坐标与上下架状态' }));
  const grid = Object.assign(document.createElement('div'), { className: 'dm-grid-3' });
  const mkInput = (lbl, val, type, disabled, onChange) => {
    const f = Object.assign(document.createElement('div'), { className: 'adm-field' });
    const inp = Object.assign(document.createElement('input'), { type, className: 'adm-input', value: String(val ?? ''), disabled });
    inp.addEventListener('input', () => onChange(inp.value));
    f.append(Object.assign(document.createElement('label'), { className: 'adm-label', textContent: lbl }), inp);
    return f;
  };
  const statusField = Object.assign(document.createElement('div'), { className: 'adm-field' });
  const statusSel = Object.assign(document.createElement('select'), { className: 'adm-input', disabled: !st.canPublish });
  statusSel.append(
    Object.assign(document.createElement('option'), { value: 'published', textContent: '已上线 (published)', selected: d.status === 'published' }),
    Object.assign(document.createElement('option'), { value: 'offline', textContent: '草稿 / 已下线 (offline)', selected: d.status !== 'published' }),
  );
  statusSel.addEventListener('change', () => { d.status = statusSel.value; });
  statusField.append(Object.assign(document.createElement('label'), { className: 'adm-label', textContent: st.canPublish ? '发布状态' : '发布状态（编辑保存为草稿）' }), statusSel);

  grid.append(
    mkInput('目的地 Slug *（改名自动生成 301）', d.slug, 'text', false, (v) => { d.slug = v.trim(); st.refreshPreview(); }),
    statusField,
    mkInput('国家标识 country *', d.country, 'text', false, (v) => { d.country = v.trim(); st.refreshPreview(); }),
    mkInput('区域标识 region *', d.region, 'text', false, (v) => { d.region = v.trim(); st.refreshPreview(); }),
    mkInput('纬度 coords.lat *', d.coords?.lat ?? 0, 'number', false, (v) => { d.coords = { ...(d.coords || {}), lat: Number(v) }; st.refreshPreview(); }),
    mkInput('经度 coords.lng *', d.coords?.lng ?? 0, 'number', false, (v) => { d.coords = { ...(d.coords || {}), lng: Number(v) }; st.refreshPreview(); }),
  );
  cardEl.appendChild(grid);
}

function renderMultilingualIdentityCard(cardEl, st) {
  const d = st.entry;
  cardEl.innerHTML = '';
  cardEl.appendChild(Object.assign(document.createElement('h3'), { className: 'dm-card__title', textContent: '2. 多语言名称、区域与核验简介（5语言）' }));
  const addI18n = (label, key, multiline = false) => {
    const f = Object.assign(document.createElement('div'), { className: 'adm-field' });
    f.appendChild(Object.assign(document.createElement('label'), { className: 'adm-label', textContent: label }));
    const ed = createI18nEditor({
      multiline, rows: 3, value: d[key] || {}, translations: d.translations,
      onChange: (val) => { d[key] = val; st.refreshPreview(); },
    });
    f.appendChild(ed.el);
    cardEl.appendChild(f);
  };
  addI18n('目的地名称 name（建议 ≤ 30 字）*', 'name', false);
  addI18n('所属区域显示名 regionName *', 'regionName', false);
  addI18n('客观参数简介 summary（建议 ≥ 50 字以满足 SEO 审计）*', 'summary', true);
}

function renderProfileAttributesCard(cardEl, st) {
  cardEl.innerHTML = '';
  const pName = st.profile.name?.['zh-CN'] || st.profile.id;
  cardEl.appendChild(Object.assign(document.createElement('h3'), {
    className: 'dm-card__title',
    textContent: `3. 「${pName}」品类专属属性（共 ${st.profile.attributes.length} 项，按 VerticalProfile 自动生成）`,
  }));
  const list = Object.assign(document.createElement('div'), { className: 'dm-attr-grid' });
  const sorted = [...(st.profile.attributes || [])].sort((a, b) => a.order - b.order);
  for (const attr of sorted) {
    list.appendChild(renderDynamicAttributeField(attr, st.entry, st.refreshPreview));
  }
  cardEl.appendChild(list);
}

function renderHighlightsAndVerificationCard(cardEl, st) {
  const d = st.entry;
  cardEl.innerHTML = '';
  const head = Object.assign(document.createElement('div'), { className: 'dm-card__title' });
  head.appendChild(Object.assign(document.createElement('span'), { textContent: '4. 目的地亮点与核验信息来源' }));
  const addHlBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '+ 新增亮点' });
  addHlBtn.addEventListener('click', () => {
    d.highlights = [...(d.highlights || []), { 'zh-CN': '' }];
    renderHighlightsAndVerificationCard(cardEl, st);
  });
  head.appendChild(addHlBtn);
  cardEl.appendChild(head);

  (d.highlights || []).forEach((hl, idx) => {
    const item = Object.assign(document.createElement('div'), { className: 'dm-repeater-item' });
    const top = Object.assign(document.createElement('div'), { className: 'dm-card__title' });
    top.appendChild(Object.assign(document.createElement('span'), { className: 'adm-label', textContent: `亮点 #${idx + 1}` }));
    const rm = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '移除' });
    rm.addEventListener('click', () => { d.highlights.splice(idx, 1); renderHighlightsAndVerificationCard(cardEl, st); st.refreshPreview(); });
    top.appendChild(rm);
    const ed = createI18nEditor({ value: hl, onChange: (v) => { d.highlights[idx] = v; st.refreshPreview(); } });
    item.append(top, ed.el);
    cardEl.appendChild(item);
  });

  const verWrap = Object.assign(document.createElement('div'), { className: 'adm-field' });
  verWrap.appendChild(Object.assign(document.createElement('label'), { className: 'adm-label', textContent: '核验数据出处 verification.source *' }));
  verWrap.appendChild(createI18nEditor({
    value: d.verification?.source || {},
    onChange: (v) => { d.verification = { ...(d.verification || {}), source: v }; },
  }).el);
  cardEl.appendChild(verWrap);
}

export async function waitAndPollJob(jobId) {
  for (let i = 0; i < 60; i += 1) {
    const { job } = await adminApi.get(`/jobs/${encodeURIComponent(jobId)}`);
    if (job.status === 'succeeded') return job;
    if (job.status === 'failed') throw new Error(job.error || '后台翻译任务执行失败');
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('等待后台任务完成超时，请前往「后台任务」查看进度');
}

async function openHistoryDialog(siteId, slug) {
  const { relPath, commits } = await adminApi.get(`/destinations/${encodeURIComponent(slug)}/history?siteId=${encodeURIComponent(siteId)}`);
  openDialog({
    title: `Git 修改历史：${relPath}`,
    renderBody: (body) => {
      if (!commits.length) {
        body.appendChild(Object.assign(document.createElement('p'), { className: 'adm-muted', textContent: '暂无提交记录' }));
        return;
      }
      for (const c of commits) {
        const row = Object.assign(document.createElement('div'), { className: 'adm-history-row' });
        row.innerHTML = html`<div><strong>${c.subject}</strong><div class="adm-muted">${c.authorName} · ${c.date}</div></div><code>${c.commit.slice(0, 8)}</code>`;
        body.appendChild(row);
      }
    },
  });
}

function renderEditorTopToolbar(toolbarEl, st) {
  const backBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline', textContent: '← 返回目的地列表' });
  backBtn.addEventListener('click', () => st.onBack());
  const right = Object.assign(document.createElement('div'), { className: 'dm-toolbar__group' });

  if (!st.isNew) {
    const histBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline', textContent: 'Git 历史' });
    bindAsyncButton(histBtn, () => openHistoryDialog(st.siteId, st.entry.slug));
    const trBtn = Object.assign(document.createElement('button'), {
      type: 'button', className: 'adm-btn adm-btn--outline', textContent: '一键 AI 翻译 5 语言', disabled: !st.aiStatus?.configured,
    });
    trBtn.title = st.aiStatus?.reason || '';
    bindAsyncButton(trBtn, async () => {
      const { job } = await adminApi.post('/destinations/translate', { siteId: st.siteId, slug: st.entry.slug });
      showToast('已提交 AI 翻译任务，正在生成多语言文本…', 'info');
      const done = await waitAndPollJob(job.id);
      showToast(`AI 翻译完成（更新 ${done.result?.translatedEntries ?? 0} 条）`, 'success');
      const fresh = await adminApi.get(`/destinations/${encodeURIComponent(st.entry.slug)}?siteId=${encodeURIComponent(st.siteId)}`);
      st.entry = fresh.data;
      st.redrawForm();
    }, { onError: (e) => showToast(e.message, 'error') });
    right.append(histBtn, trBtn);
  }

  const saveBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--primary', textContent: '保存目的地（Git 提交）' });
  bindAsyncButton(saveBtn, async () => {
    const pathUrl = st.isNew ? '/destinations' : `/destinations/${encodeURIComponent(st.entry.slug)}`;
    const method = st.isNew ? adminApi.post : adminApi.put;
    const saved = await method(pathUrl, { siteId: st.siteId, slug: st.entry.slug, data: st.entry });
    showToast(`已保存「${saved.slug}」（提交 ${saved.commitHash.slice(0, 7)}）`, 'success');
    st.isNew = false;
    st.entry = saved.data;
    if (st.onSaved) await st.onSaved(saved);
    st.redrawForm();
  }, { onError: (e) => showToast(e.message || '保存失败', 'error') });
  right.appendChild(saveBtn);
  toolbarEl.append(backBtn, right);
}

export function renderDestinationEditorView(container, opts) {
  container.innerHTML = '';
  const toolbarEl = Object.assign(document.createElement('div'), { className: 'dm-toolbar' });
  const grid = Object.assign(document.createElement('div'), { className: 'dm-editor-grid' });
  const leftCol = document.createElement('div');
  const c1 = Object.assign(document.createElement('div'), { className: 'dm-card' });
  const c2 = Object.assign(document.createElement('div'), { className: 'dm-card' });
  const c3 = Object.assign(document.createElement('div'), { className: 'dm-card' });
  const c4 = Object.assign(document.createElement('div'), { className: 'dm-card' });
  leftCol.append(c1, c2, c3, c4);
  const previewCol = Object.assign(document.createElement('div'), { className: 'dm-card dm-sticky' });
  grid.append(leftCol, previewCol);
  container.append(toolbarEl, grid);

  const st = {
    ...opts,
    previewLocale: 'zh-CN',
    refreshPreview: () => {
      renderLiveVerticalPreview(previewCol, {
        profile: st.profile,
        examples: [st.entry],
        locale: st.previewLocale,
        onLocaleChange: (loc) => { st.previewLocale = loc; st.refreshPreview(); },
      });
    },
    redrawForm: () => {
      toolbarEl.innerHTML = '';
      renderEditorTopToolbar(toolbarEl, st);
      renderBaseFieldsCard(c1, st);
      renderMultilingualIdentityCard(c2, st);
      renderProfileAttributesCard(c3, st);
      renderHighlightsAndVerificationCard(c4, st);
      st.refreshPreview();
    },
  };
  st.redrawForm();
}
