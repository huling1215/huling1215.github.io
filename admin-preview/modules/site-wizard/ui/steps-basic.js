import {
  ADMIN_LOCALES,
  adminApi,
  createI18nEditor,
  html,
  showToast,
} from '/ui/kit/index.js';
import { evaluateClientTheme } from './contrast.js';
import { buildStep1DeployAndIdSection } from './step1-deploy.js';

function makeField(labelText, controlEl, hintText = '') {
  const wrap = Object.assign(document.createElement('div'), { className: 'adm-field' });
  wrap.appendChild(Object.assign(document.createElement('label'), { className: 'adm-label', textContent: labelText }));
  wrap.appendChild(controlEl);
  if (hintText) {
    wrap.appendChild(Object.assign(document.createElement('small'), { className: 'adm-muted', textContent: hintText }));
  }
  return wrap;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').replace(/^data:[^;]+;base64,/, ''));
    reader.onerror = () => reject(new Error('读取本地 Logo 文件失败'));
    reader.readAsDataURL(file);
  });
}

async function handleLogoFileSelected(file, state, refreshStatus) {
  try {
    const saved = await state.ensureDraftSaved();
    const contentBase64 = await readFileAsBase64(file);
    const res = await adminApi.post(`/site-wizard/drafts/${encodeURIComponent(saved.draftId)}/logo`, {
      fileName: file.name,
      mimeType: file.type,
      contentBase64,
    });
    state.draft.logo = { ...res.logo, base64: contentBase64 };
    refreshStatus();
    showToast('Logo 上传校验成功', 'success');
  } catch (err) {
    showToast(err.message || 'Logo 上传失败', 'error');
  }
}

function renderLogoUploader(step1Card, state) {
  const wrap = Object.assign(document.createElement('div'), { className: 'adm-field' });
  const statusEl = Object.assign(document.createElement('div'), { className: 'adm-muted' });
  const refreshStatus = () => {
    statusEl.textContent = state.draft.logo
      ? `已上传自定义 Logo：${state.draft.logo.originalName || `logo.${state.draft.logo.ext}`} (${Math.round((state.draft.logo.sizeBytes || 0) / 1024)} KB)`
      : '尚未上传自定义 Logo（未上传时将自动使用主题色生成品牌 SVG 图标）';
  };
  refreshStatus();

  const fileInput = Object.assign(document.createElement('input'), {
    type: 'file',
    accept: '.svg,.png,image/svg+xml,image/png',
    className: 'adm-input',
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files?.[0]) handleLogoFileSelected(fileInput.files[0], state, refreshStatus);
  });
  wrap.append(
    Object.assign(document.createElement('label'), { className: 'adm-label', textContent: '站点品牌 Logo（支持 SVG / PNG，上限 512 KB）' }),
    fileInput,
    statusEl,
  );
  step1Card.appendChild(wrap);
}

export function renderStep1(host, state) {
  const s1 = state.draft.step1;
  const card = Object.assign(document.createElement('div'), { className: 'wz-card adm-form' });
  card.appendChild(Object.assign(document.createElement('h3'), { textContent: '第 1 步：站点标识、部署方式、多语言品牌名与 Logo' }));

  const deployAndIdFrag = buildStep1DeployAndIdSection(s1, state);
  const brandEditor = createI18nEditor({
    value: s1.brandName || {},
    onChange: (val) => { s1.brandName = val; },
  });
  const syncBrandBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--ghost adm-btn--sm',
    textContent: '用简体/英文名快速补齐空白语种',
  });
  syncBrandBtn.addEventListener('click', () => {
    const cur = brandEditor.getValue();
    const fb = cur.en || cur['zh-CN'] || s1.siteId || 'NewBrand';
    const next = { 'zh-CN': cur['zh-CN'] || fb, en: cur.en || fb, 'zh-Hant': cur['zh-Hant'] || cur['zh-CN'] || fb, ja: cur.ja || cur.en || fb, ko: cur.ko || cur.en || fb };
    s1.brandName = next;
    brandEditor.setValue(next);
  });

  card.append(
    deployAndIdFrag,
    makeField('5 语言品牌名称（简体 / 英文 / 繁体 / 日文 / 韩文必填）', brandEditor.el),
    syncBrandBtn,
  );
  renderLogoUploader(card, state);
  host.appendChild(card);
}

function renderCheckboxList(options, selectedList, onUpdate) {
  const wrap = Object.assign(document.createElement('div'), { className: 'wz-check-group' });
  const selected = new Set(selectedList);
  for (const item of options) {
    const lbl = Object.assign(document.createElement('label'), { className: 'adm-inline-actions' });
    const cb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: selected.has(item.value) });
    cb.addEventListener('change', () => {
      if (cb.checked) selected.add(item.value);
      else selected.delete(item.value);
      onUpdate(Array.from(selected));
    });
    lbl.append(cb, document.createTextNode(item.label));
    wrap.appendChild(lbl);
  }
  return wrap;
}

function buildVerticalPickerGrid(verticals, s2) {
  const vGrid = Object.assign(document.createElement('div'), { className: 'wz-grid-2' });
  const paint = () => {
    vGrid.innerHTML = '';
    for (const v of verticals || []) {
      const vc = Object.assign(document.createElement('div'), { className: `wz-vcard ${s2.vertical === v.id ? 'is-selected' : ''}` });
      const srcBadge = v.source === 'template' ? '模板库' : v.source === 'installed' ? '已安装' : '系统内置';
      vc.innerHTML = html`<strong>${v.name?.['zh-CN'] || v.id}</strong> <span class="adm-badge">${srcBadge}</span><div class="adm-muted">ID: ${v.id} · 路由: /${v.routeSegment}/ · 实体: ${v.entityName?.singular?.['zh-CN'] || v.id}</div>`;
      vc.addEventListener('click', () => { s2.vertical = v.id; paint(); });
      vGrid.appendChild(vc);
    }
  };
  paint();
  return vGrid;
}

export function renderStep2(host, state) {
  const s2 = state.draft.step2;
  const card = Object.assign(document.createElement('div'), { className: 'wz-card adm-form' });
  card.appendChild(Object.assign(document.createElement('h3'), { textContent: '第 2 步：选择站点品类、启用语言与币种' }));

  const defaultLocSel = Object.assign(document.createElement('select'), { className: 'adm-input' });
  const syncDefaultLocOptions = () => {
    defaultLocSel.innerHTML = '';
    if (!s2.locales.includes(s2.defaultLocale) && s2.locales[0]) s2.defaultLocale = s2.locales[0];
    for (const code of s2.locales) {
      defaultLocSel.appendChild(Object.assign(document.createElement('option'), { value: code, textContent: code, selected: code === s2.defaultLocale }));
    }
  };
  defaultLocSel.addEventListener('change', () => { s2.defaultLocale = defaultLocSel.value; });
  syncDefaultLocOptions();

  const locChecks = renderCheckboxList(
    ADMIN_LOCALES.map((l) => ({ value: l.code, label: `${l.label} (${l.code})` })),
    s2.locales,
    (next) => { s2.locales = next; syncDefaultLocOptions(); },
  );
  const curChecks = renderCheckboxList(
    (state.meta.currencies || []).map((c) => ({ value: c, label: c })),
    s2.currencies,
    (next) => { s2.currencies = next; },
  );

  card.append(
    makeField('选择业务品类（读取 verticals/ 与品类配置器新建品类）', buildVerticalPickerGrid(state.meta.verticals, s2)),
    makeField('启用的前台语言', locChecks),
    makeField('站点默认语言（根路径 / 对应语种）', defaultLocSel),
    makeField('启用的前台换算币种', curChecks),
  );
  host.appendChild(card);
}

function renderColorControl(label, key, s3, onChange) {
  const row = Object.assign(document.createElement('div'), { className: 'wz-color-row' });
  const picker = Object.assign(document.createElement('input'), {
    type: 'color',
    className: 'wz-color-picker',
    value: /^#[0-9a-fA-F]{6}$/.test(s3[key] || '') ? s3[key] : '#1d1e33',
  });
  const text = Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', value: s3[key] || '', placeholder: '#RRGGBB' });
  picker.addEventListener('input', () => { s3[key] = picker.value.toLowerCase(); text.value = s3[key]; onChange(); });
  text.addEventListener('input', () => {
    s3[key] = text.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(s3[key])) picker.value = s3[key];
    onChange();
  });
  row.append(picker, text);
  return makeField(label, row);
}

function paintThemePreviewAndReport(s3, brandLabel, previewBox, reportBox) {
  const res = evaluateClientTheme(s3);
  previewBox.innerHTML = html`
    <div style="background:${s3.primary};color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;">
      <strong>${brandLabel || '新站点品牌预览'}</strong>
      <span style="background:${s3.accent};color:#fff;padding:5px 12px;font-size:12px;font-weight:600;">立即咨询预订</span>
    </div>
    <div style="background:${s3.surface};color:${s3.ink};padding:14px 18px;">
      <strong>目的地客观参数卡片示例</strong>
      <p style="margin:6px 0 0;font-size:13px;">正文墨水色（${s3.ink}）与浅色表面底色（${s3.surface}）实时预览。</p>
    </div>`;
  reportBox.innerHTML = html`${res.pairs.map((p) => html`<div style="margin:4px 0;"><span class="${p.passesAa ? 'wz-pill-ok' : 'wz-pill-warn'}">${p.passesAa ? 'AA 达标' : '对比度不足'}</span> ${p.label}：<strong>${p.ratio ?? '--'}:1</strong>（要求 ≥ 4.5:1）</div>`)}${res.warnings.length ? html`<div class="adm-alert adm-alert--warn" style="margin-top:8px;">${res.warnings.map((w, i) => html`${i ? html`<br>` : ''}${w}`)}</div>` : ''}`;
}

export function renderStep3(host, state) {
  const s3 = state.draft.step3;
  const card = Object.assign(document.createElement('div'), { className: 'wz-card adm-form' });
  card.appendChild(Object.assign(document.createElement('h3'), { textContent: '第 3 步：设置站点主题色与可读性对比度检查' }));

  const previewBox = Object.assign(document.createElement('div'), { className: 'wz-preview' });
  const reportBox = document.createElement('div');
  const refresh = () => paintThemePreviewAndReport(s3, state.draft.step1.brandName?.['zh-CN'], previewBox, reportBox);

  const colorGrid = Object.assign(document.createElement('div'), { className: 'wz-grid-2' });
  colorGrid.append(
    renderColorControl('深色主色 Primary（导航/横幅底色）', 'primary', s3, refresh),
    renderColorControl('强调色 Accent（按钮/高亮色）', 'accent', s3, refresh),
    renderColorControl('正文文字色 Ink', 'ink', s3, refresh),
    renderColorControl('卡片与表面底色 Surface', 'surface', s3, refresh),
  );

  const fontSel = Object.assign(document.createElement('select'), { className: 'adm-input' });
  for (const fp of [
    { v: 'editorial', l: 'Editorial（Oswald 窄体大写标题 + Roboto 正文）' },
    { v: 'modern', l: 'Modern（Archivo 现代几何无衬线）' },
    { v: 'classic', l: 'Classic（衬线杂志标题风格）' },
  ]) {
    fontSel.appendChild(Object.assign(document.createElement('option'), { value: fp.v, textContent: fp.l, selected: (s3.fontPreset || 'editorial') === fp.v }));
  }
  fontSel.addEventListener('change', () => { s3.fontPreset = fontSel.value; });

  refresh();
  card.append(colorGrid, makeField('标题字体预设（自托管字体，国内直连可用）', fontSel), previewBox, reportBox);
  host.appendChild(card);
}
