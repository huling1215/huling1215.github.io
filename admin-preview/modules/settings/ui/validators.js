export const BASE_PATH_RE = /^\/([a-z0-9-]+\/)+$/;
const GA4_ID_RE = /^G-[A-Z0-9]{4,24}$/i;
const WECHAT_APPID_RE = /^wx[a-f0-9]{16}$/i;
const PHONE_NUMBER_RE = /^\+?[1-9]\d{6,15}$/;
const REQUIRED_LOCALES = ['zh-CN', 'en', 'zh-Hant', 'ja', 'ko'];

function checkUrlProtocol(raw, protocols) {
  try {
    const parsed = new URL(String(raw).trim());
    return protocols.includes(parsed.protocol) && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export function validateHttpsUrlField(value, label = '链接地址', required = false) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return required ? `请填写${label}` : '';
  if (!checkUrlProtocol(trimmed, ['https:'])) {
    return `${label}必须以 https:// 开头且为合法 URL`;
  }
  return '';
}

export function validateOriginHttpsUrlField(value, label = '正式访问源地址（url）', required = true) {
  const baseErr = validateHttpsUrlField(value, label, required);
  if (baseErr || !String(value ?? '').trim()) return baseErr;
  try {
    const parsed = new URL(String(value).trim());
    if (parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') {
      return `${label}只能填写源地址（如 https://example.com），不能包含子路径、查询参数或锚点`;
    }
    return '';
  } catch {
    return `${label}格式不合法`;
  }
}

export function validateBasePathField(value, mode = 'domain') {
  const trimmed = String(value ?? '').trim();
  if (mode === 'path') {
    if (!trimmed) {
      return '共用域名模式下必须填写子路径（如 /powderclub/）';
    }
    if (!BASE_PATH_RE.test(trimmed)) {
      return '子路径格式不合法：必须以 / 开头和结尾（如 /powderclub/ 或 /travel/ski/），且每段仅允许小写字母、数字与连字符 -';
    }
    return '';
  }
  if (trimmed && trimmed !== '/') {
    return '独立域名模式下子路径必须留空或为 /';
  }
  return '';
}

export function formatOnlineUrlPreview(rawUrl, mode = 'domain', rawBasePath = '', fallbackSiteId = 'powderclub') {
  const cleanOrigin = String(rawUrl || '').trim().replace(/\/+$/, '') || `https://${fallbackSiteId}.example.com`;
  if (mode === 'path') {
    const bp = String(rawBasePath || '').trim() || `/${fallbackSiteId}/`;
    const withLead = bp.startsWith('/') ? bp : `/${bp}`;
    return `${cleanOrigin}${withLead}`;
  }
  return `${cleanOrigin}/`;
}

export function validateWsUrlField(value, label = 'WebSocket 地址') {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if (!checkUrlProtocol(trimmed, ['ws:', 'wss:'])) {
    return `${label}必须以 ws:// 或 wss:// 开头`;
  }
  return '';
}

export function validateGa4IdField(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if (!GA4_ID_RE.test(trimmed)) {
    return 'GA4 衡量 ID 格式不合法（应如 G-XXXXXXXXXX）';
  }
  return '';
}

export function validateMiniProgramAppIdField(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if (!WECHAT_APPID_RE.test(trimmed)) {
    return '小程序 AppID 格式不合法（应为 wx 开头的 18 位十六进制字符）';
  }
  return '';
}

export function validatePhoneField(value, label = 'WhatsApp 号码') {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if (!PHONE_NUMBER_RE.test(trimmed)) {
    return `${label}格式不合法（请填带国际区号的 7–16 位纯数字，可加前导 + 号）`;
  }
  return '';
}

export function validateConcurrencyField(value) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 32) {
    return 'AI 最大并发数必须为 1–32 之间的整数';
  }
  return '';
}

function collectBrandLocaleAndDeployErrors(draft, errors) {
  const missingNames = REQUIRED_LOCALES.filter((loc) => !String(draft?.brand?.name?.[loc] ?? '').trim());
  if (missingNames.length > 0) {
    errors.push(`请补全全部 5 种语言的品牌站名（当前缺失：${missingNames.join('、')}）`);
  }
  if (!String(draft?.brand?.logo ?? '').trim()) {
    errors.push('请填写品牌 Logo 资源路径');
  }
  const urlErr = validateOriginHttpsUrlField(draft?.url, '正式访问源地址（url）', true);
  if (urlErr) errors.push(urlErr);
  const deployMode = draft?.deploy?.mode === 'path' ? 'path' : 'domain';
  const bpErr = validateBasePathField(draft?.deploy?.basePath, deployMode);
  if (bpErr) errors.push(bpErr);

  if (!Array.isArray(draft?.locales) || draft.locales.length === 0) {
    errors.push('至少需要启用 1 种站点语言');
  } else if (!draft.locales.includes(draft.defaultLocale)) {
    errors.push(`默认语言（${draft.defaultLocale}）必须包含在已启用语言列表中`);
  }
  if (!Array.isArray(draft?.currencies) || draft.currencies.length === 0) {
    errors.push('至少需要启用 1 种显示币种');
  }
}

export function validateSettingsDraft(draft) {
  const errors = [];
  collectBrandLocaleAndDeployErrors(draft, errors);

  const checks = [
    validateHttpsUrlField(draft?.leads?.endpoint, '留资接口地址'),
    validateWsUrlField(draft?.chat?.wsUrl, '客服 WebSocket 地址'),
    validateHttpsUrlField(draft?.chat?.realtimeEndpoint, '实时客服 HTTP 地址'),
    validateHttpsUrlField(draft?.chat?.wecomKf?.url, '企业微信客服链接'),
    validatePhoneField(draft?.chat?.whatsapp?.number, 'WhatsApp 号码'),
    validateHttpsUrlField(draft?.chat?.line?.url, 'LINE 客服链接'),
    validateHttpsUrlField(draft?.chat?.kakao?.url, 'KakaoTalk 客服链接'),
    validateGa4IdField(draft?.analytics?.ga4),
    validateHttpsUrlField(draft?.analytics?.umami?.src, 'Umami 脚本地址'),
    validateMiniProgramAppIdField(draft?.miniProgram?.appId),
    validateConcurrencyField(draft?.ai?.maxConcurrency),
  ];
  for (const msg of checks) {
    if (msg) errors.push(msg);
  }
  const umamiSrc = String(draft?.analytics?.umami?.src ?? '').trim();
  const umamiId = String(draft?.analytics?.umami?.websiteId ?? '').trim();
  if ((umamiSrc && !umamiId) || (!umamiSrc && umamiId)) {
    errors.push('Umami 统计需同时填写脚本地址（src）与 Website ID，或同时留空');
  }
  return { valid: errors.length === 0, errors };
}

export function detectDraftHighRiskChanges(initialConfig, nextDraft) {
  const changes = [];
  const prevUrl = String(initialConfig?.url ?? '').trim().replace(/\/+$/, '');
  const nextUrl = String(nextDraft?.url ?? '').trim().replace(/\/+$/, '');
  if (prevUrl && prevUrl !== nextUrl) {
    changes.push(`正式访问源地址（${prevUrl} → ${nextUrl}）`);
  }
  const prevLocale = String(initialConfig?.defaultLocale ?? '').trim();
  const nextLocale = String(nextDraft?.defaultLocale ?? '').trim();
  if (prevLocale && prevLocale !== nextLocale) {
    changes.push(`默认语言（${prevLocale} → ${nextLocale}）`);
  }
  const prevMode = initialConfig?.deploy?.mode === 'path' ? 'path' : 'domain';
  const nextMode = nextDraft?.deploy?.mode === 'path' ? 'path' : 'domain';
  if (prevMode !== nextMode) {
    const pLabel = prevMode === 'path' ? '共用域名 (path)' : '独立域名 (domain)';
    const nLabel = nextMode === 'path' ? '共用域名 (path)' : '独立域名 (domain)';
    changes.push(`部署方式（${pLabel} → ${nLabel}）`);
  }
  const prevBase = prevMode === 'path' ? String(initialConfig?.deploy?.basePath || '/').trim() : '/';
  const nextBase = nextMode === 'path' ? String(nextDraft?.deploy?.basePath || '/').trim() : '/';
  if (prevBase !== nextBase) {
    changes.push(`部署子路径（${prevBase} → ${nextBase}）`);
  }
  return changes;
}
