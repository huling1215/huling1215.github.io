import { html } from '/ui/kit/index.js';
import { createSectionCard } from './controls.js';
import { formatOnlineUrlPreview, validateBasePathField } from './validators.js';

function createModeRadioOption({ value, title, desc, checked, disabled, onSelect }) {
  const labelEl = Object.assign(document.createElement('label'), {
    style:
      'display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid var(--adm-border);border-radius:var(--adm-radius);background:#f9fafc;cursor:pointer;flex:1;min-width:240px;',
  });
  const radio = Object.assign(document.createElement('input'), {
    type: 'radio',
    name: 'admSettingsDeployMode',
    value,
    checked: Boolean(checked),
    disabled: Boolean(disabled),
    style: 'margin-top:3px;',
  });
  radio.addEventListener('change', () => {
    if (radio.checked) onSelect(value);
  });
  const textBox = document.createElement('div');
  textBox.innerHTML = html`<div style="font-weight:600;font-size:14px;">${title}</div><div class="adm-muted" style="font-size:12px;margin-top:2px;">${desc}</div>`;
  labelEl.append(radio, textBox);
  return { labelEl, radio };
}

function paintOnlinePreviewBanner(box, draft, siteId) {
  const mode = draft.deploy?.mode === 'path' ? 'path' : 'domain';
  const previewUrl = formatOnlineUrlPreview(draft.url, mode, draft.deploy?.basePath, siteId);
  const modeTag = mode === 'path' ? '共用域名子路径模式 (path)' : '独立域名根路径模式 (domain)';
  box.innerHTML = html`
    <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;">
      <div>
        <span class="adm-muted" style="font-size:12px;">线上地址预览：</span>
        <code style="font-size:14px;font-weight:700;color:#1e3a8a;">${previewUrl}</code>
      </div>
      <span class="adm-badge" style="background:#dbeafe;color:#1e40af;">${modeTag}</span>
    </div>
    ${mode === 'path'
      ? html`<div class="adm-muted" style="font-size:12px;margin-top:6px;">提示：共用域名模式下，源地址（url）仅填主域名（不带路径）；发布或新增子路径站点后需运行 <code>npm run build:root</code> 更新根目录聚合索引，切换路径后旧地址需配置 301 跳转。</div>`
      : ''}`;
}

function appendHighRiskLabel(container, text) {
  const lblRow = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  lblRow.append(
    Object.assign(document.createElement('label'), { className: 'adm-label', textContent: text }),
    Object.assign(document.createElement('span'), { className: 'adm-badge adm-badge--stale', textContent: '高风险全局字段' }),
  );
  container.appendChild(lblRow);
}

function buildBasePathSubfield(draft, siteId, disabled, onChanged) {
  const wrap = Object.assign(document.createElement('div'), { className: 'adm-field' });
  appendHighRiskLabel(wrap, '共用域名子路径 (deploy.basePath) *');
  const input = Object.assign(document.createElement('input'), {
    type: 'text',
    className: 'adm-input',
    placeholder: `/${siteId}/`,
    value: String(draft.deploy?.basePath || `/${siteId}/`),
    disabled: Boolean(disabled),
  });
  input.dataset.field = 'deploy.basePath';
  const errEl = Object.assign(document.createElement('p'), { className: 'adm-field__error', hidden: true });
  const hintEl = Object.assign(document.createElement('small'), {
    className: 'adm-muted',
    textContent: '格式必须为 /<段>/（可多段，如 /travel/ski/），仅允许小写字母、数字和连字符 -',
  });

  const sync = () => {
    const val = input.value.trim();
    const curMode = draft.deploy?.mode === 'path' ? 'path' : 'domain';
    if (curMode === 'path') draft.deploy = { ...(draft.deploy || {}), mode: 'path', basePath: val };
    const errMsg = validateBasePathField(val, curMode);
    errEl.textContent = errMsg;
    errEl.hidden = !errMsg;
    onChanged();
  };
  input.addEventListener('input', sync);
  input.addEventListener('blur', sync);
  wrap.append(input, errEl, hintEl);
  return { wrap, input, errEl };
}

function updateDeployModeState(nextMode, draft, siteId, subField, opts, refreshPreview) {
  const preserved = { ...(draft.deploy || {}) };
  if (nextMode === 'path') {
    const nextBp = preserved.basePath && preserved.basePath !== '/' ? preserved.basePath : `/${siteId}/`;
    draft.deploy = { ...preserved, mode: 'path', basePath: nextBp };
    subField.input.value = nextBp;
    subField.wrap.hidden = false;
    const errMsg = validateBasePathField(nextBp, 'path');
    subField.errEl.textContent = errMsg;
    subField.errEl.hidden = !errMsg;
  } else {
    delete preserved.basePath;
    draft.deploy = { ...preserved, mode: 'domain' };
    subField.wrap.hidden = true;
    subField.errEl.hidden = true;
  }
  opts.domainOpt.labelEl.style.borderColor = nextMode === 'domain' ? 'var(--adm-primary)' : 'var(--adm-border)';
  opts.pathOpt.labelEl.style.borderColor = nextMode === 'path' ? 'var(--adm-primary)' : 'var(--adm-border)';
  refreshPreview();
}

export function buildDeployModeCard(draft, disabled) {
  const siteId = String(draft.id || 'powderclub').trim() || 'powderclub';
  const { card, body } = createSectionCard(
    '2. 部署方式（独立域名 / 共用域名）',
    '修改部署方式或子路径后，全站线上地址将发生变化，旧地址需要配置 301 跳转，共用域名还需重新运行 build:root 更新根目录索引。',
  );
  const currentMode = draft.deploy?.mode === 'path' ? 'path' : 'domain';
  if (draft.deploy) draft.deploy = { ...draft.deploy, mode: currentMode };

  const modeField = Object.assign(document.createElement('div'), { className: 'adm-field' });
  appendHighRiskLabel(modeField, '站点部署方式 (deploy.mode) *');
  const radioWrap = Object.assign(document.createElement('div'), { style: 'display:flex;flex-wrap:wrap;gap:12px;' });
  const previewBox = Object.assign(document.createElement('div'), {
    style: 'padding:12px 14px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:var(--adm-radius);margin-top:4px;',
  });
  previewBox.dataset.role = 'online-url-preview';
  const refreshPreview = () => paintOnlinePreviewBanner(previewBox, draft, siteId);
  const subField = buildBasePathSubfield(draft, siteId, disabled, refreshPreview);

  const opts = { domainOpt: null, pathOpt: null };
  const onSelect = (m) => updateDeployModeState(m, draft, siteId, subField, opts, refreshPreview);
  opts.domainOpt = createModeRadioOption({
    value: 'domain', title: '独立域名（domain · 默认）', desc: '独占根路径 /，例如 https://powderclub.com/',
    checked: currentMode === 'domain', disabled, onSelect,
  });
  opts.pathOpt = createModeRadioOption({
    value: 'path', title: '共用域名（path · 子路径挂载）', desc: `多站挂在同一源地址不同路径下，例如 https://xxx.com/${siteId}/`,
    checked: currentMode === 'path', disabled, onSelect,
  });

  radioWrap.append(opts.domainOpt.labelEl, opts.pathOpt.labelEl);
  modeField.appendChild(radioWrap);
  subField.wrap.hidden = currentMode !== 'path';
  opts.domainOpt.labelEl.style.borderColor = currentMode === 'domain' ? 'var(--adm-primary)' : 'var(--adm-border)';
  opts.pathOpt.labelEl.style.borderColor = currentMode === 'path' ? 'var(--adm-primary)' : 'var(--adm-border)';
  refreshPreview();

  body.append(modeField, subField.wrap, previewBox);
  return { card, refreshPreview };
}
