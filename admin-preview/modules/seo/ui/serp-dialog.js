import { ADMIN_LOCALES, adminApi, html, openDialog, showToast, trustedHtml } from '/ui/kit/index.js';

const CJK_COMPACT_SET = new Set(['zh-CN', 'zh-Hant', 'ja']);

function countChars(str) {
  return Array.from(String(str || '')).length;
}

function getTitleMax(locale) {
  return CJK_COMPACT_SET.has(locale) ? 30 : 60;
}

function computePreviewMeta(detail, seoState, locale) {
  const brand = detail.brandName?.[locale] || detail.brandName?.['zh-CN'] || detail.siteId;
  const rawOverrideTitle = String(seoState.title?.[locale] || '').trim();
  const baseTitle = String(detail.defaultTitle?.[locale] || detail.defaultTitle?.['zh-CN'] || detail.slug).trim();
  const effectiveTitle = rawOverrideTitle || (baseTitle.includes(brand) ? baseTitle : `${baseTitle} | ${brand}`);
  const rawOverrideDesc = String(seoState.description?.[locale] || '').trim();
  const baseDesc = String(detail.defaultDescription?.[locale] || detail.defaultDescription?.['zh-CN'] || '').trim();
  const effectiveDesc = rawOverrideDesc || baseDesc || `${baseTitle} — ${brand}`;
  return {
    brand,
    url: detail.localizedUrls?.[locale] || detail.siteUrl,
    effectiveTitle,
    effectiveDesc,
  };
}

function updateCounterDisplay(counterEl, text, isOverride, validator) {
  if (!isOverride) {
    counterEl.className = 'seo-counter seo-counter--muted';
    counterEl.textContent = validator.emptyHint;
    return;
  }
  const len = countChars(text);
  const ok = validator.check(len);
  counterEl.className = `seo-counter ${ok ? 'seo-counter--ok' : 'seo-counter--warn'}`;
  counterEl.textContent = validator.format(len, ok);
}

function renderSerpCards(hostEl, meta, noindexVal) {
  hostEl.innerHTML = '';
  const noindexBadge = noindexVal === true ? trustedHtml('<span class="adm-badge adm-badge--missing">noindex 不收录</span>') : '';

  const googleCard = Object.assign(document.createElement('div'), { className: 'serp-card' });
  googleCard.innerHTML = html`<div class="serp-card__engine"><span>Google 搜索预览</span>${noindexBadge}</div>`;
  googleCard.append(
    Object.assign(document.createElement('div'), { className: 'serp-google__site', textContent: meta.brand }),
    Object.assign(document.createElement('div'), { className: 'serp-google__url', textContent: meta.url }),
    Object.assign(document.createElement('div'), { className: 'serp-google__title', textContent: meta.effectiveTitle }),
    Object.assign(document.createElement('div'), { className: 'serp-google__desc', textContent: meta.effectiveDesc }),
  );

  const baiduCard = Object.assign(document.createElement('div'), { className: 'serp-card' });
  baiduCard.innerHTML = html`<div class="serp-card__engine"><span>百度搜索预览</span>${noindexBadge}</div>`;
  const foot = Object.assign(document.createElement('div'), { className: 'serp-baidu__foot' });
  foot.append(
    Object.assign(document.createElement('span'), { textContent: meta.brand }),
    Object.assign(document.createElement('span'), { textContent: meta.url.replace(/^https?:\/\//, '').slice(0, 42) }),
    Object.assign(document.createElement('span'), { textContent: '百度快照' }),
  );
  baiduCard.append(
    Object.assign(document.createElement('div'), { className: 'serp-baidu__title', textContent: meta.effectiveTitle }),
    Object.assign(document.createElement('div'), { className: 'serp-baidu__desc', textContent: meta.effectiveDesc }),
    foot,
  );
  hostEl.append(googleCard, baiduCard);
}

function syncSeoDialogControls(els, detail, seoState, getLoc, setLoc) {
  const activeLocale = getLoc();
  const maxT = getTitleMax(activeLocale);
  const curTitle = String(seoState.title?.[activeLocale] || '');
  const curDesc = String(seoState.description?.[activeLocale] || '');
  els.titleInput.value = curTitle;
  els.titleInput.placeholder = `留空使用默认标题（${activeLocale} 上限 ${maxT} 字符）`;
  els.descInput.value = curDesc;
  els.descInput.placeholder = `留空使用默认描述（${activeLocale} 要求 ≥ 50 字符）`;

  updateCounterDisplay(els.titleCounter, curTitle.trim(), Boolean(curTitle.trim()), {
    emptyHint: `当前未覆写（${activeLocale} 审计上限 ≤ ${maxT} 字符）`,
    check: (n) => n > 0 && n <= maxT,
    format: (n, ok) => (ok ? `✓ ${n} / ${maxT} 字符（符合审计要求）` : `⚠ ${n} / ${maxT} 字符（超出上限，seo:audit 将阻断）`),
  });
  updateCounterDisplay(els.descCounter, curDesc.trim(), Boolean(curDesc.trim()), {
    emptyHint: `当前未覆写（${activeLocale} 审计下限 ≥ 50 字符）`,
    check: (n) => n >= 50,
    format: (n, ok) => (ok ? `✓ ${n} 字符（满足 ≥ 50 字符要求）` : `⚠ ${n} 字符（不足 50 字符，seo:audit 将阻断）`),
  });
  renderSerpCards(els.serpHost, computePreviewMeta(detail, seoState, activeLocale), seoState.noindex);

  els.localeTabs.innerHTML = '';
  for (const loc of ADMIN_LOCALES) {
    const hasVal = Boolean(seoState.title?.[loc.code]?.trim() || seoState.description?.[loc.code]?.trim());
    const btn = Object.assign(document.createElement('button'), {
      type: 'button',
      className: `adm-i18n-tab ${loc.code === activeLocale ? 'is-active' : ''}`,
      textContent: `${loc.label}${hasVal ? ' ●' : ''}`,
    });
    btn.addEventListener('click', () => setLoc(loc.code));
    els.localeTabs.appendChild(btn);
  }
}

function buildSeoDialogBody(body, detail, seoState, canWrite) {
  let activeLocale = 'zh-CN';
  const els = {
    localeTabs: Object.assign(document.createElement('div'), { className: 'adm-i18n-tabs' }),
    titleInput: Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', disabled: !canWrite }),
    titleCounter: document.createElement('div'),
    descInput: Object.assign(document.createElement('textarea'), { className: 'adm-textarea', rows: 3, disabled: !canWrite }),
    descCounter: document.createElement('div'),
    noindexSelect: Object.assign(document.createElement('select'), { className: 'adm-input', disabled: !canWrite }),
    serpHost: Object.assign(document.createElement('div'), { className: 'serp-grid' }),
  };

  for (const opt of [
    { v: 'inherit', l: '跟随页面默认（正常允许收录）' },
    { v: 'true', l: '强制禁止收录（noindex: true）' },
    { v: 'false', l: '强制允许收录（noindex: false）' },
  ]) {
    const selected = (seoState.noindex === true && opt.v === 'true') || (seoState.noindex === false && opt.v === 'false') || (seoState.noindex === undefined && opt.v === 'inherit');
    els.noindexSelect.appendChild(Object.assign(document.createElement('option'), { value: opt.v, textContent: opt.l, selected }));
  }

  const sync = () => syncSeoDialogControls(els, detail, seoState, () => activeLocale, (loc) => { activeLocale = loc; sync(); });
  els.titleInput.addEventListener('input', () => { seoState.title = { ...(seoState.title || {}), [activeLocale]: els.titleInput.value }; sync(); });
  els.descInput.addEventListener('input', () => { seoState.description = { ...(seoState.description || {}), [activeLocale]: els.descInput.value }; sync(); });
  els.noindexSelect.addEventListener('change', () => {
    seoState.noindex = els.noindexSelect.value === 'true' ? true : els.noindexSelect.value === 'false' ? false : undefined;
    sync();
  });

  body.append(
    els.localeTabs,
    Object.assign(document.createElement('label'), { className: 'adm-label', textContent: 'SEO 标题覆写（seo.title）' }),
    els.titleInput, els.titleCounter,
    Object.assign(document.createElement('label'), { className: 'adm-label', textContent: 'SEO 描述覆写（seo.description）' }),
    els.descInput, els.descCounter,
    Object.assign(document.createElement('label'), { className: 'adm-label', textContent: '索引策略（seo.noindex）' }),
    els.noindexSelect,
    Object.assign(document.createElement('label'), { className: 'adm-label', textContent: 'Google 与百度搜索结果卡片实时预览（SERP）' }),
    els.serpHost,
  );
  sync();
}

export async function openSeoOverrideDialog(siteId, collection, slug, canWrite, onSaved) {
  const detail = await adminApi.get(`/seo/entries/${collection}/${slug}?siteId=${encodeURIComponent(siteId)}`);
  const seoState = {
    title: { ...(detail.seo?.title || {}) },
    description: { ...(detail.seo?.description || {}) },
    noindex: typeof detail.seo?.noindex === 'boolean' ? detail.seo.noindex : undefined,
  };
  openDialog({
    title: `单页 SEO 覆写与 SERP 预览 · ${collection}/${slug}`,
    confirmLabel: '保存 SEO 覆写并提交 Git',
    renderBody: (body) => buildSeoDialogBody(body, detail, seoState, canWrite),
    onConfirm: canWrite
      ? async () => {
          const res = await adminApi.put(`/seo/entries/${collection}/${slug}`, { siteId, seo: seoState });
          showToast(`SEO 覆写已保存（提交 ${res.commitHash.slice(0, 8)}）`, 'success');
          await onSaved();
        }
      : undefined,
  });
}
