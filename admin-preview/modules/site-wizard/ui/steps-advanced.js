import { html } from '/ui/kit/index.js';

function makeField(labelText, controlEl, hintText = '') {
  const wrap = Object.assign(document.createElement('div'), { className: 'adm-field' });
  wrap.appendChild(Object.assign(document.createElement('label'), { className: 'adm-label', textContent: labelText }));
  wrap.appendChild(controlEl);
  if (hintText) {
    wrap.appendChild(Object.assign(document.createElement('small'), { className: 'adm-muted', textContent: hintText }));
  }
  return wrap;
}

function toUpperEnvPrefix(siteId) {
  return String(siteId || 'NEW_SITE').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'NEW_SITE';
}

function renderDeployFieldsHost(host, s4, siteId) {
  host.innerHTML = '';
  if (!s4.deploy) return;
  const prefix = `DEPLOY_${toUpperEnvPrefix(siteId)}_`;
  const target = s4.deploy.target;

  if (target === 'cloudflare-pages') {
    const pIn = Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', placeholder: '例如 okinawa-dive-prod', value: s4.deploy.projectName || '' });
    pIn.addEventListener('input', () => { s4.deploy.projectName = pIn.value.trim() || undefined; });
    host.appendChild(makeField('Cloudflare Pages 项目名 (deploy.projectName)', pIn, `凭证走服务器环境变量：${prefix}CF_ACCOUNT_ID / ${prefix}CF_API_TOKEN`));
  } else if (target === 'aliyun-oss') {
    const bIn = Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', placeholder: '例如 nts-okinawa-static', value: s4.deploy.bucket || '' });
    bIn.addEventListener('input', () => { s4.deploy.bucket = bIn.value.trim() || undefined; });
    host.appendChild(makeField('阿里云 OSS Bucket 名 (deploy.bucket)', bIn, `凭证走服务器环境变量：${prefix}OSS_REGION / ${prefix}OSS_ACCESS_KEY_ID / ${prefix}OSS_ACCESS_KEY_SECRET`));
  } else if (target === 'rsync') {
    const rIn = Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', placeholder: '例如 deploy@10.0.0.8:/var/www/new-site', value: s4.deploy.path || '' });
    rIn.addEventListener('input', () => { s4.deploy.path = rIn.value.trim() || undefined; });
    host.appendChild(makeField('目标服务器或本地目录路径 (deploy.path)', rIn, `SSH 私钥路径可通过环境变量 ${prefix}RSYNC_SSH_KEY_PATH 指定`));
  }
}

function buildTemplateModeControls(s4, templateSites) {
  const modeSel = Object.assign(document.createElement('select'), { className: 'adm-input' });
  for (const m of [
    { v: 'copy', l: '从既有模板站复制起始配置（复制客服路由、SEO 核心问题与 AI 文风配置段）' },
    { v: 'blank', l: '从空白配置开始（客服、SEO 与 AI 文风均留空自行填写）' },
  ]) {
    modeSel.appendChild(Object.assign(document.createElement('option'), { value: m.v, textContent: m.l, selected: (s4.templateMode || 'copy') === m.v }));
  }
  const tplSiteWrap = document.createElement('div');
  const tplSel = Object.assign(document.createElement('select'), { className: 'adm-input' });
  for (const s of templateSites || []) {
    tplSel.appendChild(Object.assign(document.createElement('option'), { value: s.siteId, textContent: `${s.brandNameZh} (${s.siteId})`, selected: (s4.templateSiteId || 'powderclub') === s.siteId }));
  }
  tplSel.addEventListener('change', () => { s4.templateSiteId = tplSel.value; });
  tplSiteWrap.appendChild(makeField('选择模板来源站点', tplSel));
  tplSiteWrap.hidden = s4.templateMode === 'blank';
  modeSel.addEventListener('change', () => {
    s4.templateMode = modeSel.value;
    tplSiteWrap.hidden = s4.templateMode === 'blank';
  });
  return { modeSel, tplSiteWrap };
}

export function renderStep4(host, state) {
  const s1 = state.draft.step1 || {};
  const s4 = state.draft.step4;
  const card = Object.assign(document.createElement('div'), { className: 'wz-card adm-form' });
  card.appendChild(Object.assign(document.createElement('h3'), { textContent: '第 4 步：起始配置模板与非敏感部署目标' }));

  if (s1.deployMode === 'path') {
    const bp = s1.basePath || (s1.siteId ? `/${s1.siteId}/` : '/new-site/');
    const notice = Object.assign(document.createElement('div'), { className: 'adm-alert adm-alert--warn' });
    notice.innerHTML = html`第 1 步已选择 <strong>共用域名子路径模式</strong>（<code>mode: path, basePath: ${bp}</code>），第 6 步落盘时将与下方部署目标合并写入 <code>deploy</code> 段。建议选择 <strong>Rsync</strong> 或 <strong>阿里云 OSS</strong>（单个 Cloudflare Pages 项目仅能承载一个站点）。`;
    card.appendChild(notice);
  }

  const { modeSel, tplSiteWrap } = buildTemplateModeControls(s4, state.meta.templateSites);
  const deploySel = Object.assign(document.createElement('select'), { className: 'adm-input' });
  for (const d of [
    { v: '', l: '暂不绑定站点专属部署目标（使用全局 DEPLOY_TARGET）' },
    { v: 'cloudflare-pages', l: 'Cloudflare Pages (Direct Upload)' },
    { v: 'aliyun-oss', l: '阿里云 OSS + CDN 刷新' },
    { v: 'rsync', l: 'Rsync 同步至自有服务器目录' },
  ]) {
    deploySel.appendChild(Object.assign(document.createElement('option'), { value: d.v, textContent: d.l, selected: (s4.deploy?.target || '') === d.v }));
  }

  const deployFieldsHost = document.createElement('div');
  deploySel.addEventListener('change', () => {
    s4.deploy = deploySel.value ? { target: deploySel.value } : null;
    renderDeployFieldsHost(deployFieldsHost, s4, s1.siteId);
  });
  renderDeployFieldsHost(deployFieldsHost, s4, s1.siteId);

  card.append(
    makeField('起始配置方式', modeSel),
    tplSiteWrap,
    makeField('站点级部署目标（仅存非敏感标识，API 密钥严禁进后台）', deploySel),
    deployFieldsHost,
  );
  host.appendChild(card);
}

function parseFactsLines(rawText) {
  const facts = {};
  for (const line of String(rawText || '').split('\n')) {
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const rawVal = line.slice(idx + 1).trim();
    if (!key || !rawVal) continue;
    const num = Number(rawVal);
    facts[key] = !Number.isNaN(num) && rawVal !== '' ? num : rawVal === 'true' ? true : rawVal === 'false' ? false : rawVal;
  }
  return Object.keys(facts).length > 0 ? facts : undefined;
}

function formatFactsLines(factsObj) {
  if (!factsObj || typeof factsObj !== 'object') return '';
  return Object.entries(factsObj).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : v}`).join('\n');
}

function buildCollectionSelect(brief) {
  const colSel = Object.assign(document.createElement('select'), { className: 'adm-input' });
  for (const c of [
    { v: 'guides', l: '攻略文章 (guides)' },
    { v: 'resorts', l: '目的地档案 (resorts)' },
    { v: 'regions', l: '区域概览 (regions)' },
    { v: 'collections', l: '主题合集 (collections)' },
  ]) {
    colSel.appendChild(Object.assign(document.createElement('option'), { value: c.v, textContent: c.l, selected: (brief.collection || 'guides') === c.v }));
  }
  colSel.addEventListener('change', () => { brief.collection = colSel.value; });
  return colSel;
}

function renderSingleBriefCard(brief, index, onRemove) {
  const box = Object.assign(document.createElement('div'), { className: 'wz-brief-card adm-form' });
  const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  head.appendChild(Object.assign(document.createElement('strong'), { textContent: `选题 #${index + 1}` }));
  const delBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--danger adm-btn--sm', textContent: '移除此条' });
  delBtn.addEventListener('click', onRemove);
  head.appendChild(delBtn);

  const slugIn = Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', placeholder: '例如 okinawa-beginner-transfer-guide', value: brief.slug || '' });
  slugIn.addEventListener('input', () => { brief.slug = slugIn.value.trim() || undefined; });

  const topicIn = Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', placeholder: '例如：冲绳青之洞窟新手潜点交通与季节怎么安排？', value: brief.topic || '' });
  topicIn.addEventListener('input', () => { brief.topic = topicIn.value; });

  const qArea = Object.assign(document.createElement('textarea'), { className: 'adm-textarea', rows: 3, placeholder: '每行输入一个待回答的具体问题（至少 1 行）', value: (brief.questions || []).join('\n') });
  qArea.addEventListener('input', () => { brief.questions = qArea.value.split('\n').map((s) => s.trim()).filter(Boolean); });

  const factsArea = Object.assign(document.createElement('textarea'), { className: 'adm-textarea', rows: 2, placeholder: '可选，每行 key=value，例如 shuttleMinutes=45', value: formatFactsLines(brief.requiredFacts) });
  factsArea.addEventListener('input', () => { brief.requiredFacts = parseFactsLines(factsArea.value); });

  const rowGrid = Object.assign(document.createElement('div'), { className: 'wz-grid-2' });
  rowGrid.append(makeField('内容集合', buildCollectionSelect(brief)), makeField('条目 Slug（可选，留空自动推导）', slugIn));
  box.append(head, rowGrid, makeField('核心选题标题 (topic)', topicIn), makeField('必须回答的问题列表（每行 1 个）', qArea), makeField('必须引用的核验事实（可选 key=value）', factsArea));
  return box;
}

export function renderStep5(host, state) {
  if (!state.draft.step5) state.draft.step5 = { briefs: [] };
  const briefs = state.draft.step5.briefs;
  const card = Object.assign(document.createElement('div'), { className: 'wz-card adm-form' });

  const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  head.appendChild(Object.assign(document.createElement('h3'), { textContent: '第 5 步：批量填写初始选题清单（生成 sites/<id>/briefs/*.yaml）' }));
  const addBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--primary adm-btn--sm', textContent: '+ 新增一条选题 Brief' });
  head.appendChild(addBtn);

  const listHost = document.createElement('div');
  const paintList = () => {
    listHost.innerHTML = '';
    if (briefs.length === 0) {
      listHost.appendChild(Object.assign(document.createElement('p'), { className: 'adm-muted', textContent: '当前尚未添加初始选题（可点击右上角新增多条攻略/目的地选题，也可留空先创建站点骨架）。' }));
      return;
    }
    briefs.forEach((b, idx) => {
      listHost.appendChild(renderSingleBriefCard(b, idx, () => { briefs.splice(idx, 1); paintList(); }));
    });
  };

  addBtn.addEventListener('click', () => {
    briefs.push({ collection: 'guides', slug: '', topic: '', questions: [''], targetLength: { minChars: 350, maxChars: 1000, sectionCount: 2 } });
    paintList();
  });
  paintList();
  card.append(head, listHost);
  host.appendChild(card);
}
