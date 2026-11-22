export const ADMIN_LOCALES = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en', label: 'English' },
  { code: 'zh-Hant', label: '繁體中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
];

const STATE_LABELS = {
  source: '源语言',
  reviewed: '已审校',
  machine: '机器翻译',
  stale: '过期',
  missing: '缺失',
};

function computeLocaleState(localeCode, valMap, translations, staleLocales) {
  const text = String(valMap?.[localeCode] || '').trim();
  if (!text) return 'missing';
  if (staleLocales?.has?.(localeCode)) return 'stale';
  const explicit = translations?.[localeCode];
  if (explicit && STATE_LABELS[explicit]) return explicit;
  return localeCode === 'zh-CN' ? 'source' : 'machine';
}

function renderLocaleTabs(ctx) {
  ctx.tabBar.innerHTML = '';
  for (const loc of ADMIN_LOCALES) {
    const st = computeLocaleState(loc.code, ctx.value, ctx.translations, ctx.staleLocales);
    const btn = Object.assign(document.createElement('button'), {
      type: 'button',
      className: `adm-i18n-tab ${loc.code === ctx.activeLocale ? 'is-active' : ''}`,
    });
    const nameSpan = Object.assign(document.createElement('span'), { textContent: loc.label });
    const badge = Object.assign(document.createElement('span'), {
      className: `adm-badge adm-badge--${st}`,
      textContent: STATE_LABELS[st] || st,
    });
    btn.append(nameSpan, badge);
    btn.addEventListener('click', () => {
      ctx.activeLocale = loc.code;
      ctx.inputEl.value = String(ctx.value[ctx.activeLocale] || '');
      ctx.inputEl.placeholder = `请输入 ${ctx.activeLocale} 文本…`;
      renderLocaleTabs(ctx);
    });
    ctx.tabBar.appendChild(btn);
  }
}

export function createI18nEditor(options = {}) {
  const multiline = Boolean(options.multiline);
  const inputEl = multiline ? document.createElement('textarea') : document.createElement('input');
  inputEl.className = multiline ? 'adm-textarea' : 'adm-input';
  if (multiline) inputEl.rows = options.rows || 4;
  else inputEl.type = 'text';

  const ctx = {
    value: { ...(options.value || {}) },
    translations: options.translations || {},
    staleLocales: new Set(options.staleLocales || []),
    activeLocale: options.defaultLocale || 'zh-CN',
    tabBar: Object.assign(document.createElement('div'), { className: 'adm-i18n-tabs' }),
    inputEl,
  };
  ctx.tabBar.setAttribute('role', 'tablist');

  const root = Object.assign(document.createElement('div'), { className: 'adm-i18n-editor' });
  const inputWrap = Object.assign(document.createElement('div'), { className: 'adm-i18n-body' });
  inputWrap.appendChild(inputEl);

  inputEl.value = String(ctx.value[ctx.activeLocale] || '');
  inputEl.placeholder = `请输入 ${ctx.activeLocale} 文本…`;
  inputEl.addEventListener('input', () => {
    if (inputEl.value.trim()) ctx.value[ctx.activeLocale] = inputEl.value;
    else delete ctx.value[ctx.activeLocale];
    renderLocaleTabs(ctx);
    if (typeof options.onChange === 'function') options.onChange({ ...ctx.value });
  });

  renderLocaleTabs(ctx);
  root.append(ctx.tabBar, inputWrap);
  return {
    el: root,
    getValue: () => ({ ...ctx.value }),
    setValue: (nextVal) => {
      for (const k of Object.keys(ctx.value)) delete ctx.value[k];
      Object.assign(ctx.value, nextVal || {});
      inputEl.value = String(ctx.value[ctx.activeLocale] || '');
      renderLocaleTabs(ctx);
    },
  };
}
