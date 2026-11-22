import { adminApi, bindAsyncButton, html } from '/ui/kit/index.js';

const BASE_PATH_RE = /^\/([a-z0-9-]+\/)+$/;

function validateWizardOriginInput(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '站点源地址必须以 https:// 开头';
    if (parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') {
      return '站点源地址只能填写协议与主域名（如 https://example.com），不能包含子路径';
    }
    return '';
  } catch {
    return '站点源地址格式不合法';
  }
}

function validateWizardBasePathInput(rawBasePath, deployMode) {
  if (deployMode !== 'path') return '';
  const trimmed = String(rawBasePath || '').trim();
  if (!trimmed) return '共用域名模式下必须填写子路径';
  if (!BASE_PATH_RE.test(trimmed)) {
    return '子路径格式必须为 /<段>/（可多段如 /travel/ski/），仅限小写字母、数字与连字符 -';
  }
  return '';
}

function computeWizardOnlineUrlPreview(s1) {
  const cleanId = s1.siteId || 'new-site';
  const defaultOrigin = s1.deployMode === 'path' ? 'https://shared.example.com' : `https://${cleanId}.example.com`;
  const origin = String(s1.url || '').trim().replace(/\/+$/, '') || defaultOrigin;
  if (s1.deployMode === 'path') {
    const bp = String(s1.basePath || '').trim() || `/${cleanId}/`;
    return `${origin}${bp.startsWith('/') ? bp : `/${bp}`}`;
  }
  return `${origin}/`;
}

function createWizardModeRadio(value, title, desc, checked, onSelect) {
  const labelEl = Object.assign(document.createElement('label'), {
    style:
      'display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid var(--adm-border);border-radius:var(--adm-radius);background:#fafbfe;cursor:pointer;flex:1;min-width:240px;',
  });
  const radio = Object.assign(document.createElement('input'), {
    type: 'radio', name: 'wzStep1DeployMode', value, checked: Boolean(checked), style: 'margin-top:3px;',
  });
  radio.addEventListener('change', () => {
    if (radio.checked) onSelect(value);
  });
  const textDiv = document.createElement('div');
  textDiv.innerHTML = html`<div style="font-weight:600;font-size:14px;">${title}</div><div class="adm-muted" style="font-size:12px;margin-top:2px;">${desc}</div>`;
  labelEl.append(radio, textDiv);
  return { labelEl, radio };
}

function makeLabeledBlock(labelText, controlEl, hintText = '', errEl = null) {
  const wrap = Object.assign(document.createElement('div'), { className: 'adm-field' });
  wrap.appendChild(Object.assign(document.createElement('label'), { className: 'adm-label', textContent: labelText }));
  wrap.appendChild(controlEl);
  if (errEl) wrap.appendChild(errEl);
  if (hintText) wrap.appendChild(Object.assign(document.createElement('small'), { className: 'adm-muted', textContent: hintText }));
  return wrap;
}

function paintWizardPreviewBanner(previewBox, s1) {
  const isPath = s1.deployMode === 'path';
  const onlineUrl = computeWizardOnlineUrlPreview(s1);
  const badgeText = isPath ? '共用域名子路径 (mode=path)' : '独立域名根路径 (mode=domain)';
  previewBox.innerHTML = html`
    <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;">
      <div>
        <span class="adm-muted" style="font-size:12px;">线上地址预览：</span>
        <code style="font-size:14px;font-weight:700;color:#1e3a8a;">${onlineUrl}</code>
      </div>
      <span class="adm-badge" style="background:#dbeafe;color:#1e40af;">${badgeText}</span>
    </div>
    ${isPath
      ? html`<div class="adm-muted" style="font-size:12px;margin-top:6px;">提示：同一源地址（url）下各站子路径不得相同或互为父子前缀；上线后需运行 <code>npm run build:root</code> 汇总根目录索引。</div>`
      : ''}`;
}

function buildIdCheckControls(s1, state) {
  const idRow = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const idInput = Object.assign(document.createElement('input'), {
    type: 'text', className: 'adm-input', placeholder: '例如 slowkin 或 okinawa-dive', value: s1.siteId || '',
  });
  const checkBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline', textContent: '检查 ID 与路径可用性' });
  const checkMsg = Object.assign(document.createElement('span'), { className: 'adm-muted' });
  bindAsyncButton(checkBtn, async () => {
    const res = await adminApi.post('/site-wizard/check-site-id', {
      siteId: s1.siteId, deployMode: s1.deployMode, basePath: s1.basePath, url: s1.url,
      allowExisting: Boolean(state.draft.scaffoldCommitHash),
    });
    checkMsg.className = res.valid ? 'wz-pill-ok' : 'wz-pill-warn';
    checkMsg.textContent = res.message;
  });
  idRow.append(idInput, checkBtn, checkMsg);
  return { idRow, idInput };
}

function applyWizardModeChange(nextMode, s1, refs, refresh) {
  s1.deployMode = nextMode;
  if (nextMode === 'path') {
    const autoBp = s1.siteId ? `/${s1.siteId}/` : '/new-site/';
    if (!s1.basePath || s1.basePath === '/') {
      s1.basePath = s1.siteId ? `/${s1.siteId}/` : '';
      refs.tracker.lastAuto = s1.basePath;
    }
    refs.bpInput.value = s1.basePath || autoBp;
    if (!s1.basePath && s1.siteId) s1.basePath = autoBp;
    refs.urlInput.placeholder = 'https://shared.example.com（共用主域名源地址）';
    refs.bpWrap.hidden = false;
  } else {
    s1.basePath = '';
    refs.urlInput.placeholder = 'https://your-site.example.com';
    refs.bpWrap.hidden = true;
  }
  refs.domainRadio.labelEl.style.borderColor = nextMode === 'domain' ? 'var(--adm-primary)' : 'var(--adm-border)';
  refs.pathRadio.labelEl.style.borderColor = nextMode === 'path' ? 'var(--adm-primary)' : 'var(--adm-border)';
  refresh();
}

function bindStep1InputListeners(s1, idInput, urlInput, bpInput, tracker, refresh) {
  idInput.addEventListener('input', () => {
    const prevAuto = tracker.lastAuto;
    s1.siteId = idInput.value.trim();
    const nextAuto = s1.siteId ? `/${s1.siteId}/` : '';
    if (s1.deployMode !== 'path' && (!s1.url || s1.url.endsWith('.example.com'))) {
      urlInput.value = s1.siteId ? `https://${s1.siteId}.example.com` : '';
      s1.url = urlInput.value;
    }
    if (s1.deployMode === 'path' && (!s1.basePath || s1.basePath === prevAuto)) {
      s1.basePath = nextAuto;
      bpInput.value = nextAuto;
    }
    tracker.lastAuto = nextAuto;
    refresh();
  });
  urlInput.addEventListener('input', () => { s1.url = urlInput.value.trim(); refresh(); });
  bpInput.addEventListener('input', () => { s1.basePath = bpInput.value.trim(); refresh(); });
}

export function buildStep1DeployAndIdSection(s1, state) {
  if (!s1.deployMode) s1.deployMode = 'domain';
  const tracker = { lastAuto: s1.siteId ? `/${s1.siteId}/` : '' };
  const { idRow, idInput } = buildIdCheckControls(s1, state);
  const urlInput = Object.assign(document.createElement('input'), {
    type: 'url', className: 'adm-input',
    placeholder: s1.deployMode === 'path' ? 'https://shared.example.com' : 'https://your-site.example.com',
    value: s1.url || (s1.siteId && s1.deployMode !== 'path' ? `https://${s1.siteId}.example.com` : ''),
  });
  const urlErr = Object.assign(document.createElement('p'), { className: 'adm-field__error', hidden: true });
  const bpInput = Object.assign(document.createElement('input'), {
    type: 'text', className: 'adm-input', placeholder: '/slowkin/', value: s1.basePath || (s1.siteId ? `/${s1.siteId}/` : ''),
  });
  bpInput.dataset.field = 'wizard-base-path';
  const bpErr = Object.assign(document.createElement('p'), { className: 'adm-field__error', hidden: true });
  const bpWrap = makeLabeledBlock('共用域名子路径 (deploy.basePath) *', bpInput, '默认跟随站点 ID 自动生成 /<siteId>/，也可手动改为多段如 /travel/ski/', bpErr);
  const previewBox = Object.assign(document.createElement('div'), {
    style: 'padding:12px 14px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:var(--adm-radius);',
  });
  previewBox.dataset.role = 'wizard-online-url-preview';

  const refresh = () => {
    const uMsg = validateWizardOriginInput(s1.url);
    urlErr.textContent = uMsg; urlErr.hidden = !uMsg;
    const bMsg = validateWizardBasePathInput(s1.basePath, s1.deployMode);
    bpErr.textContent = bMsg; bpErr.hidden = !bMsg;
    paintWizardPreviewBanner(previewBox, s1);
  };
  const refs = { urlInput, bpInput, bpWrap, tracker, domainRadio: null, pathRadio: null };
  refs.domainRadio = createWizardModeRadio('domain', '独立域名（domain · 默认）', '独占根路径 /，例如 https://powderclub.com/', s1.deployMode !== 'path', (m) => applyWizardModeChange(m, s1, refs, refresh));
  refs.pathRadio = createWizardModeRadio('path', '共用域名（path · 子路径挂载）', '挂载在主域名子路径下，例如 https://xxx.com/slowkin/', s1.deployMode === 'path', (m) => applyWizardModeChange(m, s1, refs, refresh));
  const modeRow = Object.assign(document.createElement('div'), { style: 'display:flex;flex-wrap:wrap;gap:12px;' });
  modeRow.append(refs.domainRadio.labelEl, refs.pathRadio.labelEl);

  bindStep1InputListeners(s1, idInput, urlInput, bpInput, tracker, refresh);
  bpWrap.hidden = s1.deployMode !== 'path';
  refs.domainRadio.labelEl.style.borderColor = s1.deployMode !== 'path' ? 'var(--adm-primary)' : 'var(--adm-border)';
  refs.pathRadio.labelEl.style.borderColor = s1.deployMode === 'path' ? 'var(--adm-primary)' : 'var(--adm-border)';
  refresh();

  const frag = document.createDocumentFragment();
  frag.append(
    makeLabeledBlock('站点 ID（仅小写字母、数字与连字符）', idRow, '创建后对应 sites/<id>/ 与 catalog/<id>/ 目录'),
    makeLabeledBlock('部署方式（独立域名 / 共用域名）', modeRow),
    makeLabeledBlock('站点访问源地址 (url，仅填协议与域名，不含子路径)', urlInput, '独立域名填本站主域名；共用域名填多个站共享的主域名源地址', urlErr),
    bpWrap, previewBox,
  );
  return frag;
}
