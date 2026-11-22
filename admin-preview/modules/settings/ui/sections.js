import { createI18nEditor } from '/ui/kit/index.js';
import {
  LOCALE_NAMES,
  createAiEnginesEditor,
  createCheckboxField,
  createChatRoutingEditor,
  createMultiCheckField,
  createSectionCard,
  createSelectField,
  createTwoColGrid,
  createValidatedInput,
} from './controls.js';
import { buildDeployModeCard } from './deploy-card.js';
import {
  validateConcurrencyField,
  validateGa4IdField,
  validateHttpsUrlField,
  validateMiniProgramAppIdField,
  validateOriginHttpsUrlField,
  validatePhoneField,
  validateWsUrlField,
} from './validators.js';

export function cloneConfigDraft(source) {
  return JSON.parse(JSON.stringify(source || {}));
}

function attachBrandInputs(body, draft, disabled, onUrlUpdated) {
  const i18nField = Object.assign(document.createElement('div'), { className: 'adm-field' });
  i18nField.appendChild(Object.assign(document.createElement('label'), { className: 'adm-label', textContent: '多语言品牌站名（5 语种均必填） *' }));
  const nameEditor = createI18nEditor({
    value: draft.brand?.name || {},
    defaultLocale: draft.defaultLocale || 'zh-CN',
    onChange: (nextVal) => { draft.brand = { ...(draft.brand || {}), name: nextVal }; },
  });
  if (disabled) nameEditor.el.querySelectorAll('input,textarea').forEach((n) => { n.disabled = true; });
  i18nField.appendChild(nameEditor.el);

  const grid = createTwoColGrid();
  grid.append(
    createValidatedInput({
      label: '正式访问源地址 (url)', required: true, highRisk: true, disabled, value: draft.url,
      placeholder: 'https://www.example.com', hint: '仅填 https:// 源地址，不带末尾斜杠与子路径',
      validate: (v) => validateOriginHttpsUrlField(v, '正式访问源地址（url）', true),
      onChange: (v) => { draft.url = v; onUrlUpdated?.(); },
    }),
    createValidatedInput({
      label: '品牌 Logo 资源路径 (brand.logo)', required: true, disabled, value: draft.brand?.logo,
      placeholder: '/brand/logo.svg', validate: (v) => (!v ? '请填写品牌 Logo 路径' : ''),
      onChange: (v) => { draft.brand = { ...(draft.brand || {}), logo: v }; },
    }),
  );
  body.append(i18nField, grid);
}

function buildBrandAndLocaleCard(draft, opts, disabled, onUrlUpdated) {
  const { card, body } = createSectionCard('1. 品牌、源地址、多语言与币种', '修改正式访问源地址（url）或默认语言（defaultLocale）会影响全站所有页面的 canonical、hreflang 与路由结构。');
  attachBrandInputs(body, draft, disabled, onUrlUpdated);
  const localeOpts = (opts.locales || []).map((l) => ({ value: l, label: LOCALE_NAMES[l] || l }));
  const currOpts = (opts.currencies || []).map((c) => ({ value: c, label: c }));
  body.append(
    createSelectField({
      label: '默认主语言 (defaultLocale)', highRisk: true, disabled, value: draft.defaultLocale, options: localeOpts,
      hint: '默认语言部署在站点根路径，其余语言部署在 /<locale>/ 路径',
      onChange: (v) => { draft.defaultLocale = v; },
    }),
    createMultiCheckField({ label: '已启用语言列表 (locales)', disabled, selected: draft.locales, options: localeOpts, onChange: (arr) => { draft.locales = arr; } }),
    createMultiCheckField({ label: '站内切换币种列表 (currencies)', disabled, selected: draft.currencies, options: currOpts, onChange: (arr) => { draft.currencies = arr; } }),
  );
  return card;
}

function buildCompanyCard(draft, disabled) {
  const { card, body } = createSectionCard('3. 公司主体与备案资质', '用于网站页脚合规披露；启用 zh-CN 正式发布（PRODUCTION=1）前需填写 ICP 备案号。');
  draft.company = { name: '', icp: '', psb: '', address: '', license: '', ...(draft.company || {}) };
  const grid = createTwoColGrid();
  grid.append(
    createValidatedInput({ label: '公司主体全称 (company.name)', disabled, value: draft.company.name, placeholder: '例如：北京某某国际旅行社有限公司', onChange: (v) => { draft.company.name = v; } }),
    createValidatedInput({ label: '工信部 ICP 备案号 (company.icp)', disabled, value: draft.company.icp, placeholder: '例如：京ICP备00000000号-1', onChange: (v) => { draft.company.icp = v; } }),
    createValidatedInput({ label: '公安联网备案号 (company.psb)', disabled, value: draft.company.psb, placeholder: '例如：京公网安备 11010502000000号', onChange: (v) => { draft.company.psb = v; } }),
    createValidatedInput({ label: '旅行社/增值电信经营许可证 (company.license)', disabled, value: draft.company.license, placeholder: '例如：L-BJ-CJ00000', onChange: (v) => { draft.company.license = v; } }),
  );
  body.append(
    grid,
    createValidatedInput({ label: '公司联系地址 (company.address)', disabled, value: draft.company.address, placeholder: '例如：北京市朝阳区某某路 88 号', onChange: (v) => { draft.company.address = v; } }),
  );
  return card;
}

function buildChatChannelsCard(draft, opts, disabled) {
  const { card, body } = createSectionCard('4. 在线客服渠道与语种路由', '未配置任何渠道时，前台右下角客服组件自动降级为离线表单留言。');
  draft.chat = {
    wsUrl: '', realtimeEndpoint: '',
    wecomKf: { url: '', qrImage: '', ...(draft.chat?.wecomKf || {}) },
    whatsapp: { number: '', ...(draft.chat?.whatsapp || {}) },
    line: { url: '', ...(draft.chat?.line || {}) },
    kakao: { url: '', ...(draft.chat?.kakao || {}) },
    routing: { ...(draft.chat?.routing || {}) },
    ...(draft.chat ? { wsUrl: draft.chat.wsUrl || '', realtimeEndpoint: draft.chat.realtimeEndpoint || '' } : {}),
  };
  const grid = createTwoColGrid();
  grid.append(
    createValidatedInput({ label: '企业微信客服链接 (wecomKf.url)', disabled, value: draft.chat.wecomKf.url, placeholder: 'https://work.weixin.qq.com/kfid/...', validate: (v) => validateHttpsUrlField(v, '企业微信客服链接'), onChange: (v) => { draft.chat.wecomKf.url = v; } }),
    createValidatedInput({ label: '企业微信二维码图片路径 (wecomKf.qrImage)', disabled, value: draft.chat.wecomKf.qrImage, placeholder: '/images/wecom-qr.png', onChange: (v) => { draft.chat.wecomKf.qrImage = v; } }),
    createValidatedInput({ label: 'WhatsApp 号码 (whatsapp.number)', disabled, value: draft.chat.whatsapp.number, placeholder: '+85290000000', hint: '国际区号 + 号码，7–16 位数字', validate: (v) => validatePhoneField(v, 'WhatsApp 号码'), onChange: (v) => { draft.chat.whatsapp.number = v; } }),
    createValidatedInput({ label: 'LINE 官方账号链接 (line.url)', disabled, value: draft.chat.line.url, placeholder: 'https://lin.ee/...', validate: (v) => validateHttpsUrlField(v, 'LINE 客服链接'), onChange: (v) => { draft.chat.line.url = v; } }),
    createValidatedInput({ label: 'KakaoTalk 频道链接 (kakao.url)', disabled, value: draft.chat.kakao.url, placeholder: 'https://pf.kakao.com/...', validate: (v) => validateHttpsUrlField(v, 'KakaoTalk 客服链接'), onChange: (v) => { draft.chat.kakao.url = v; } }),
    createValidatedInput({ label: '自建实时客服 WebSocket (chat.wsUrl)', disabled, value: draft.chat.wsUrl, placeholder: 'wss://chat.example.com/ws/chat', validate: (v) => validateWsUrlField(v, '客服 WebSocket 地址'), onChange: (v) => { draft.chat.wsUrl = v; } }),
  );
  body.append(
    grid,
    createValidatedInput({ label: '实时客服 HTTP 接口 (chat.realtimeEndpoint)', disabled, value: draft.chat.realtimeEndpoint, placeholder: 'https://chat.example.com/api/chat', validate: (v) => validateHttpsUrlField(v, '实时客服 HTTP 接口'), onChange: (v) => { draft.chat.realtimeEndpoint = v; } }),
    createChatRoutingEditor({
      routing: draft.chat.routing,
      channels: opts.chatChannels || ['wecomKf', 'whatsapp', 'line', 'kakao'],
      locales: opts.locales || ['zh-CN', 'en', 'zh-Hant', 'ja', 'ko'],
      disabled,
      onChange: (nextRouting) => { draft.chat.routing = nextRouting; },
    }),
  );
  return card;
}

function buildAnalyticsCard(draft, disabled) {
  const { card, body } = createSectionCard('5. 访问统计 ID', '留空则线上不注入对应第三方统计脚本；海外语种自动遵循 GDPR 同意后加载。');
  draft.analytics = {
    baidu: '', ga4: '',
    ...draft.analytics,
    umami: { src: '', websiteId: '', ...(draft.analytics?.umami || {}) },
  };
  const grid = createTwoColGrid();
  grid.append(
    createValidatedInput({ label: '百度统计站点 ID (analytics.baidu)', disabled, value: draft.analytics.baidu, placeholder: 'hm.js? 后的 32 位字符串', onChange: (v) => { draft.analytics.baidu = v; } }),
    createValidatedInput({ label: 'Google Analytics 4 ID (analytics.ga4)', disabled, value: draft.analytics.ga4, placeholder: 'G-XXXXXXXXXX', validate: validateGa4IdField, onChange: (v) => { draft.analytics.ga4 = v; } }),
    createValidatedInput({ label: 'Umami 脚本地址 (umami.src)', disabled, value: draft.analytics.umami.src, placeholder: 'https://cloud.umami.is/script.js', validate: (v) => validateHttpsUrlField(v, 'Umami 脚本地址'), onChange: (v) => { draft.analytics.umami.src = v; } }),
    createValidatedInput({ label: 'Umami Website ID (umami.websiteId)', disabled, value: draft.analytics.umami.websiteId, placeholder: 'UUID 格式站点标识', onChange: (v) => { draft.analytics.umami.websiteId = v; } }),
  );
  body.appendChild(grid);
  return card;
}

function buildVerificationCard(draft, disabled) {
  const { card, body } = createSectionCard('6. 搜索引擎站长平台验证码', '仅填写 meta 标签 content="..." 引号内的验证码字符串，保存时自动保留 primaryQuestions 等已有 SEO 字段。');
  draft.seo = { ...(draft.seo || {}), verification: { ...(draft.seo?.verification || {}) } };
  const platforms = [
    ['baidu', '百度搜索资源平台 (baidu)'],
    ['google', 'Google Search Console (google)'],
    ['bing', 'Bing Webmaster (bing)'],
    ['sogou', '搜狗站长平台 (sogou)'],
    ['so360', '360 站长平台 (so360)'],
    ['naver', 'Naver Search Advisor (naver)'],
    ['yandex', 'Yandex Webmaster (yandex)'],
  ];
  const grid = createTwoColGrid();
  for (const [key, label] of platforms) {
    grid.appendChild(createValidatedInput({
      label, disabled, value: draft.seo.verification[key] || '', placeholder: '选填验证码 token',
      onChange: (v) => { draft.seo.verification[key] = v; },
    }));
  }
  body.appendChild(grid);
  return card;
}

function buildMiniProgramAndLeadsCards(draft, disabled) {
  const mpSec = createSectionCard('7. 微信小程序 WebView 配置', '配置小程序壳 AppID 与预订桥接页路径（保留已有 partnerApps 配置）。');
  draft.miniProgram = { enabled: true, appId: '', bridgePath: '/pages/booking-bridge/index', ...(draft.miniProgram || {}) };
  const mpGrid = createTwoColGrid();
  mpGrid.append(
    createValidatedInput({ label: '微信小程序 AppID (miniProgram.appId)', disabled, value: draft.miniProgram.appId, placeholder: 'wx0123456789abcdef', validate: validateMiniProgramAppIdField, onChange: (v) => { draft.miniProgram.appId = v; } }),
    createValidatedInput({ label: '预订桥接页路径 (miniProgram.bridgePath)', disabled, value: draft.miniProgram.bridgePath, placeholder: '/pages/booking-bridge/index', onChange: (v) => { draft.miniProgram.bridgePath = v; } }),
  );
  mpSec.body.append(
    createCheckboxField({ label: '启用微信小程序环境适配 (miniProgram.enabled)', disabled, checked: draft.miniProgram.enabled, onChange: (c) => { draft.miniProgram.enabled = c; } }),
    mpGrid,
  );

  const leadSec = createSectionCard('8. 留资接口地址', '接收定制咨询表单与离线留言并写入飞书多维表格（PRODUCTION=1 正式发布必填）。');
  draft.leads = { endpoint: '', ...(draft.leads || {}) };
  leadSec.body.appendChild(createValidatedInput({
    label: '留资云函数 HTTPS 接口地址 (leads.endpoint)', disabled, value: draft.leads.endpoint,
    placeholder: 'https://lead.example.com/api/lead',
    hint: '仅填公开接收表单的 HTTPS 地址；飞书 App Secret 等敏感凭证须配置在云函数环境变量中',
    validate: (v) => validateHttpsUrlField(v, '留资接口地址'),
    onChange: (v) => { draft.leads.endpoint = v; },
  }));
  return [mpSec.card, leadSec.card];
}

function buildAiConfigCard(draft, opts, disabled) {
  const { card, body } = createSectionCard('9. AI 内容与翻译流水线配置', '控制源语言、目标翻译语种、简繁转换引擎、文风指南与并发上限（AI API 密钥仅从服务器环境变量读取）。');
  const locales = opts.locales || ['zh-CN', 'en', 'zh-Hant', 'ja', 'ko'];
  draft.ai = {
    sourceLocale: 'zh-CN',
    targetLocales: ['en', 'zh-Hant', 'ja', 'ko'],
    styleGuide: '',
    autoPublish: false,
    maxConcurrency: 3,
    ...(draft.ai || {}),
    engines: { 'zh-CN': 'llm', en: 'llm', 'zh-Hant': 'opencc', ja: 'llm', ko: 'llm', ...(draft.ai?.engines || {}) },
  };
  const locOpts = locales.map((l) => ({ value: l, label: LOCALE_NAMES[l] || l }));
  const topGrid = createTwoColGrid();
  topGrid.append(
    createSelectField({ label: '源语言 (ai.sourceLocale)', disabled, value: draft.ai.sourceLocale, options: locOpts, onChange: (v) => { draft.ai.sourceLocale = v; } }),
    createValidatedInput({ label: '最大并发数 (ai.maxConcurrency)', type: 'number', disabled, value: draft.ai.maxConcurrency, hint: '取值范围 1–32', validate: validateConcurrencyField, onChange: (v) => { draft.ai.maxConcurrency = Number(v); } }),
  );
  body.append(
    topGrid,
    createMultiCheckField({ label: '目标翻译语种 (ai.targetLocales)', disabled, selected: draft.ai.targetLocales, options: locOpts, onChange: (arr) => { draft.ai.targetLocales = arr; } }),
    createAiEnginesEditor({ engines: draft.ai.engines, locales, modes: opts.aiEngineModes || ['llm', 'opencc'], disabled, onChange: (eng) => { draft.ai.engines = eng; } }),
    createValidatedInput({ label: 'AI 写作与翻译文风指南 (ai.styleGuide)', type: 'textarea', rows: 4, disabled, value: draft.ai.styleGuide, placeholder: '规定客观行文基调、禁用夸大极限词等要求…', onChange: (v) => { draft.ai.styleGuide = v; } }),
    createCheckboxField({ label: 'AI 生成后自动设为上线状态 (ai.autoPublish)', disabled, checked: draft.ai.autoPublish, hint: '建议保持关闭，经人工审校后再上线', onChange: (c) => { draft.ai.autoPublish = c; } }),
  );
  return card;
}

export function renderAllSettingsSections(hostEl, draft, options, canWrite) {
  hostEl.innerHTML = '';
  const disabled = !canWrite;
  const deployUi = buildDeployModeCard(draft, disabled);
  const brandCard = buildBrandAndLocaleCard(draft, options, disabled, deployUi.refreshPreview);
  const [mpCard, leadsCard] = buildMiniProgramAndLeadsCards(draft, disabled);
  hostEl.append(
    brandCard,
    deployUi.card,
    buildCompanyCard(draft, disabled),
    buildChatChannelsCard(draft, options, disabled),
    buildAnalyticsCard(draft, disabled),
    buildVerificationCard(draft, disabled),
    mpCard,
    leadsCard,
    buildAiConfigCard(draft, options, disabled),
  );
}
