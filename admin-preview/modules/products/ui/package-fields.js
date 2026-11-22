import { createI18nEditor } from '/ui/kit/index.js';
import { createDeparturesCalendarPanel } from './calendar-panel.js';
import {
  createBookingEditor,
  createCnyPriceControl,
  createCoverPickerField,
  fieldBox,
  h,
} from './dom-helpers.js';
import {
  createFaqListEditor,
  createI18nListEditor,
  createVerificationEditor,
} from './list-editors.js';

function buildPackageMetaSelects(draft, meta, notify) {
  const destLabel = meta.vertical?.entitySingularZh || '目的地';
  const destSel = h('select', { className: 'adm-input' }, [h('option', { value: '', textContent: `-- 请选择所属${destLabel} --` })]);
  for (const d of meta.destinations || []) {
    destSel.appendChild(h('option', { value: d.slug, textContent: `${d.nameZh} (${d.slug})`, selected: d.slug === draft.resort }));
  }
  destSel.addEventListener('change', () => { draft.resort = destSel.value; notify(true); });

  const staySel = h('select', { className: 'adm-input' }, [h('option', { value: '', textContent: '不绑定特定酒店（自由组合）' })]);
  for (const s of meta.stays || []) {
    staySel.appendChild(h('option', { value: s.slug, textContent: `${s.nameZh} (${s.slug})`, selected: s.slug === (draft.stay || '') }));
  }
  staySel.addEventListener('change', () => {
    if (staySel.value) draft.stay = staySel.value;
    else delete draft.stay;
    notify();
  });

  const levelSel = h('select', { className: 'adm-input' });
  for (const lv of meta.enums?.skillLevels || []) {
    levelSel.appendChild(h('option', { value: lv.value, textContent: lv.label, selected: lv.value === (draft.level || 'beginner') }));
  }
  levelSel.addEventListener('change', () => { draft.level = levelSel.value; notify(); });

  return { destLabel, destSel, staySel, levelSel };
}

function renderPackageBaseCard(draft, meta, isCreate, notify) {
  const slugInp = h('input', { type: 'text', className: 'adm-input', value: draft.slug || '', readOnly: !isCreate, placeholder: '例如：beidahu-beginner-camp-4d3n' });
  slugInp.addEventListener('input', () => { draft.slug = slugInp.value.trim(); notify(); });

  const daysInp = h('input', { type: 'number', min: '1', step: '1', className: 'adm-input', value: draft.days ?? 5 });
  daysInp.addEventListener('input', () => { draft.days = Math.max(1, Number.parseInt(daysInp.value || '1', 10) || 1); notify(); });

  const srcSel = h('select', { className: 'adm-input' });
  for (const opt of meta.enums?.sourceTypes || []) srcSel.appendChild(h('option', { value: opt.value, textContent: opt.label, selected: opt.value === (draft.sourceType || 'editorial') }));
  srcSel.addEventListener('change', () => { draft.sourceType = srcSel.value; notify(); });

  const { destLabel, destSel, staySel, levelSel } = buildPackageMetaSelects(draft, meta, notify);
  const coverField = createCoverPickerField({
    value: draft.cover,
    onChange: (val) => { if (val) draft.cover = val; else delete draft.cover; notify(); },
  });

  return h('div', { className: 'prd-card' }, [
    h('h4', { className: 'prd-card__title', textContent: '套餐基础参数、关联酒店与封面' }),
    h('div', { className: 'prd-grid-3' }, [
      fieldBox('套餐标识 Slug', slugInp, isCreate ? '仅限小写字母、数字和连字符' : '已有条目不可直接改名'),
      fieldBox(`所属${destLabel}`, destSel),
      fieldBox('关联入住酒店（可选）', staySel),
      fieldBox('行程天数（days）', daysInp),
      fieldBox('适合水平（level）', levelSel),
      fieldBox('数据来源（sourceType）', srcSel),
    ]),
    fieldBox('套餐封面图（cover）', coverField),
  ]);
}

function renderPackageCopyAndPriceCard(draft, meta, notify) {
  const tr = draft.translations || {};
  const nameEd = createI18nEditor({ value: draft.name || {}, translations: tr, onChange: (v) => { draft.name = v; notify(); } });
  const sumEd = createI18nEditor({ value: draft.summary || {}, translations: tr, multiline: true, rows: 3, onChange: (v) => { draft.summary = v; notify(); } });

  const hasPriceChk = h('input', { type: 'checkbox', checked: Boolean(draft.price?.amount) });
  const priceWrap = h('div', { hidden: !hasPriceChk.checked });
  const priceCtrl = createCnyPriceControl({
    amount: draft.price?.amount || 4980,
    unit: draft.price?.unit || 'person',
    unitOptions: meta.enums?.priceUnits || [],
    ratesInfo: meta.rates,
    onChange: (nextPrice) => { if (hasPriceChk.checked) draft.price = nextPrice; notify(true); },
  });
  priceWrap.appendChild(priceCtrl);
  hasPriceChk.addEventListener('change', () => {
    priceWrap.hidden = !hasPriceChk.checked;
    if (hasPriceChk.checked) draft.price = { amount: draft.price?.amount || 4980, currency: 'CNY', unit: 'person' };
    else delete draft.price;
    notify(true);
  });

  return h('div', { className: 'prd-card' }, [
    h('h4', { className: 'prd-card__title', textContent: '多语言标题概述与起步价格' }),
    fieldBox('套餐名称（name）', nameEd.el),
    fieldBox('行程概述（summary）', sumEd.el),
    h('label', { className: 'prd-check-item', style: 'margin:8px 0' }, [hasPriceChk, '设置起步参考价 CNY（转正上线建议开启，实时预览多币种换算）']),
    priceWrap,
  ]);
}

export function renderPackageFormFields(container, { draft, meta, isCreate, onDraftChange }) {
  container.innerHTML = '';
  const tr = draft.translations || {};
  container.append(
    renderPackageBaseCard(draft, meta, isCreate, onDraftChange),
    renderPackageCopyAndPriceCard(draft, meta, onDraftChange),
    createDeparturesCalendarPanel({ draft, meta, onChange: () => onDraftChange() }),
    createI18nListEditor({ title: '费用包含清单（includes）', items: draft.includes || [], translations: tr, addLabel: '+ 新增包含项', onChange: (list) => { draft.includes = list; onDraftChange(); } }),
    createI18nListEditor({ title: '费用不含清单（excludes）', items: draft.excludes || [], translations: tr, addLabel: '+ 新增不含项', onChange: (list) => { draft.excludes = list; onDraftChange(); } }),
    createI18nListEditor({ title: '核心亮点（highlights）', items: draft.highlights || [], maxItems: 3, translations: tr, addLabel: '+ 新增亮点', onChange: (list) => { draft.highlights = list; onDraftChange(); } }),
    createFaqListEditor({ items: draft.faq || [], translations: tr, onChange: (list) => { draft.faq = list; onDraftChange(); } }),
    createBookingEditor({ value: draft.booking, bookingMeta: meta.booking, onChange: (bk) => { draft.booking = bk; onDraftChange(true); } }),
    createVerificationEditor({ value: draft.verification, translations: tr, onChange: (ver) => { draft.verification = ver; onDraftChange(); } }),
  );
}
