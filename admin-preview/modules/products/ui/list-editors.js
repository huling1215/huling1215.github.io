import { createI18nEditor } from '/ui/kit/index.js';
import { fieldBox, h } from './dom-helpers.js';

function renderI18nListItem(val, idx, translations, onUpdateItem, onDeleteItem) {
  const rmBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '删除', onClick: onDeleteItem });
  const ed = createI18nEditor({ value: val, translations, onChange: onUpdateItem });
  return h('div', { className: 'prd-repeat-item' }, [
    h('div', { className: 'prd-repeat-head' }, [h('span', { textContent: `第 ${idx + 1} 条` }), rmBtn]),
    ed.el,
  ]);
}

export function createI18nListEditor({ title, items = [], maxItems = 20, translations = {}, addLabel = '+ 新增一条', onChange }) {
  const listState = items.map((it) => ({ ...(it || {}) }));
  const card = h('div', { className: 'prd-card' });
  const addBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: addLabel });
  const head = h('h4', { className: 'prd-card__title' }, [
    h('span', { textContent: `${title}${maxItems < 20 ? `（最多 ${maxItems} 条）` : ''}` }),
    addBtn,
  ]);
  const listHost = h('div');
  const emit = () => onChange(listState.map((x) => ({ ...x })));

  const redraw = () => {
    listHost.innerHTML = '';
    addBtn.disabled = listState.length >= maxItems;
    if (listState.length === 0) {
      listHost.appendChild(h('p', { className: 'adm-muted', textContent: '暂无条目，点击右上角新增。' }));
      return;
    }
    listState.forEach((val, idx) => {
      listHost.appendChild(
        renderI18nListItem(val, idx, translations, (nextVal) => { listState[idx] = nextVal; emit(); }, () => { listState.splice(idx, 1); emit(); redraw(); }),
      );
    });
  };

  addBtn.addEventListener('click', () => {
    if (listState.length >= maxItems) return;
    listState.push({ 'zh-CN': '' });
    emit();
    redraw();
  });
  card.append(head, listHost);
  redraw();
  return card;
}

export function createFaqListEditor({ items = [], translations = {}, onChange }) {
  const faqState = items.map((it) => ({ q: { ...(it?.q || {}) }, a: { ...(it?.a || {}) } }));
  const card = h('div', { className: 'prd-card' });
  const addBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '+ 新增问答' });
  const head = h('h4', { className: 'prd-card__title' }, [h('span', { textContent: '常见问答（FAQ）' }), addBtn]);
  const listHost = h('div');

  const emit = () => onChange(faqState.map((it) => ({ q: { ...it.q }, a: { ...it.a } })));
  const redraw = () => {
    listHost.innerHTML = '';
    if (faqState.length === 0) {
      listHost.appendChild(h('p', { className: 'adm-muted', textContent: '暂无问答，点击右上角新增 FAQ。' }));
      return;
    }
    faqState.forEach((item, idx) => {
      const rmBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '删除此问答' });
      rmBtn.addEventListener('click', () => { faqState.splice(idx, 1); emit(); redraw(); });
      const qEd = createI18nEditor({ value: item.q, translations, onChange: (v) => { faqState[idx].q = v; emit(); } });
      const aEd = createI18nEditor({ value: item.a, translations, multiline: true, rows: 3, onChange: (v) => { faqState[idx].a = v; emit(); } });
      listHost.appendChild(
        h('div', { className: 'prd-repeat-item' }, [
          h('div', { className: 'prd-repeat-head' }, [h('span', { textContent: `FAQ #${idx + 1}` }), rmBtn]),
          fieldBox('问题（Q）', qEd.el),
          fieldBox('回答（A）', aEd.el),
        ]),
      );
    });
  };

  addBtn.addEventListener('click', () => {
    faqState.push({ q: { 'zh-CN': '' }, a: { 'zh-CN': '' } });
    emit();
    redraw();
  });
  card.append(head, listHost);
  redraw();
  return card;
}

export function createVerificationEditor({ value, translations = {}, onChange }) {
  const ver = {
    verifiedBy: value?.verifiedBy || 'admin',
    verifiedAt: value?.verifiedAt || new Date().toISOString().slice(0, 10),
    source: { ...(value?.source || { 'zh-CN': '运营后台人工核验' }) },
    ...(value?.sourceUrl ? { sourceUrl: value.sourceUrl } : {}),
  };
  const emit = () => onChange({ ...ver, source: { ...ver.source } });
  const byInp = h('input', { type: 'text', className: 'adm-input', value: ver.verifiedBy });
  const atInp = h('input', { type: 'date', className: 'adm-input', value: ver.verifiedAt });
  const urlInp = h('input', { type: 'url', className: 'adm-input', value: ver.sourceUrl || '', placeholder: 'https://...（可选核验来源网址）' });
  const srcEd = createI18nEditor({ value: ver.source, translations, onChange: (v) => { ver.source = v; emit(); } });

  byInp.addEventListener('input', () => { ver.verifiedBy = byInp.value.trim(); emit(); });
  atInp.addEventListener('input', () => { ver.verifiedAt = atInp.value.trim(); emit(); });
  urlInp.addEventListener('input', () => {
    if (urlInp.value.trim()) ver.sourceUrl = urlInp.value.trim();
    else delete ver.sourceUrl;
    emit();
  });

  return h('div', { className: 'prd-card' }, [
    h('h4', { className: 'prd-card__title', textContent: '人工核验记录（verification）' }),
    h('div', { className: 'prd-grid-3' }, [
      fieldBox('核验人（verifiedBy）', byInp),
      fieldBox('核验日期（verifiedAt）', atInp),
      fieldBox('核验官网链接（可选）', urlInp),
    ]),
    fieldBox('多语言核验来源说明', srcEd.el),
  ]);
}
