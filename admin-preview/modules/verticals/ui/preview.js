import { ADMIN_LOCALES } from '/ui/kit/index.js';

function readDotPath(obj, dotPath) {
  let cur = obj;
  for (const seg of String(dotPath || '').split('.')) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[seg];
  }
  return cur;
}

function synthesizeFallbackAttrValue(attr, sampleIndex) {
  if (attr.type === 'number') return (sampleIndex + 1) * 18;
  if (attr.type === 'boolean') return sampleIndex % 2 === 0;
  if (attr.type === 'enum') {
    const opts = attr.enumOptions || [];
    return opts[sampleIndex % Math.max(1, opts.length)]?.value || 'standard';
  }
  if (attr.type === 'range') {
    return attr.format === 'monthRange'
      ? { open: 4, close: 11 }
      : { min: 22 + sampleIndex * 2, max: 28 + sampleIndex };
  }
  if (attr.type === 'list') return ['speedboat', 'liveaboard'].slice(0, sampleIndex + 1);
  if (attr.type === 'localizedString') {
    return { 'zh-CN': '示例核验说明文本', en: 'Verified sample note' };
  }
  return `示例-${sampleIndex + 1}`;
}

export function formatPreviewAttrValue(rawVal, attr, locale) {
  const val = rawVal !== undefined && rawVal !== null ? rawVal : synthesizeFallbackAttrValue(attr, 0);
  const unit = attr.unit?.[locale] || attr.unit?.['zh-CN'] || attr.unit?.en || '';
  if (typeof val === 'boolean') {
    const yes = { 'zh-CN': '支持', en: 'Yes', 'zh-Hant': '支援', ja: 'あり', ko: '지원' };
    const no = { 'zh-CN': '不开放', en: 'No', 'zh-Hant': '不開放', ja: 'なし', ko: '미운영' };
    return val ? yes[locale] || '支持' : no[locale] || '不开放';
  }
  if (typeof val === 'number') {
    const numStr = attr.format === 'integer'
      ? new Intl.NumberFormat(locale).format(Math.round(val))
      : attr.format === 'percent'
        ? `${val}%`
        : new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(val);
    return `${numStr}${unit}`;
  }
  if (Array.isArray(val)) return val.join(' / ');
  if (typeof val === 'object' && val !== null) {
    if (attr.format === 'monthRange' && typeof val.open === 'number' && typeof val.close === 'number') {
      return locale === 'en' ? `M${val.open}–M${val.close}` : `${val.open}月–${val.close}月`;
    }
    if (typeof val.min === 'number' && typeof val.max === 'number') {
      return `${val.min}–${val.max}${unit}`;
    }
    return val[locale] || val['zh-CN'] || val.en || '';
  }
  if (attr.type === 'enum' && Array.isArray(attr.enumOptions)) {
    const hit = attr.enumOptions.find((o) => o.value === String(val));
    if (hit) return hit.label?.[locale] || hit.label?.['zh-CN'] || String(val);
  }
  return `${String(val)}${unit}`;
}

function pickLoc(map, locale, fallback = '未命名') {
  if (!map || typeof map !== 'object') return fallback;
  return map[locale] || map['zh-CN'] || map.en || fallback;
}

function buildFallbackSamples(profile) {
  return [0, 1, 2].map((idx) => ({
    slug: `sample-${idx + 1}`,
    name: {
      'zh-CN': `${pickLoc(profile.entityName?.singular, 'zh-CN', '目的地')}示例 #${idx + 1}`,
      en: `${pickLoc(profile.entityName?.singular, 'en', 'Destination')} #${idx + 1}`,
    },
    regionName: { 'zh-CN': `示范区域 ${idx + 1}`, en: `Zone ${idx + 1}` },
    coords: { lat: 4.11 + idx * 1.8, lng: 118.62 + idx * 4.2 },
    highlights: [
      { 'zh-CN': '经编辑部客观参数核验，支持多语言切换预览', en: 'Verified parameters with multilingual preview' },
      { 'zh-CN': '卡片指标与对比表维度随左侧配置实时联动', en: 'Card metrics and spec table update in real time' },
    ],
  }));
}

function renderCardHeroEl(profile, sample, sortedAttrs, badgeKeys, locale) {
  const hero = Object.assign(document.createElement('div'), { className: 'vc-dest-card__hero' });
  const badges = Object.assign(document.createElement('div'), { className: 'vc-dest-card__badges' });
  badges.appendChild(Object.assign(document.createElement('span'), {
    className: 'vc-dest-card__badge',
    textContent: pickLoc(profile.entityName?.singular, locale, '目的地'),
  }));
  for (const bk of badgeKeys) {
    const attr = sortedAttrs.find((a) => a.key === bk);
    if (!attr) continue;
    const val = formatPreviewAttrValue(readDotPath(sample, attr.path), attr, locale);
    badges.appendChild(Object.assign(document.createElement('span'), {
      className: 'vc-dest-card__badge',
      textContent: `${pickLoc(attr.label, locale, attr.key)} · ${val}`,
    }));
  }
  const title = Object.assign(document.createElement('h4'), {
    className: 'vc-dest-card__title',
    textContent: pickLoc(sample.name, locale, sample.slug),
  });
  const coordsText = profile.card?.showCoords !== false && sample.coords
    ? ` · ${Number(sample.coords.lat).toFixed(2)}°, ${Number(sample.coords.lng).toFixed(2)}°`
    : '';
  const meta = Object.assign(document.createElement('div'), {
    className: 'vc-dest-card__meta',
    textContent: `${pickLoc(sample.regionName, locale, sample.region || '')}${coordsText} · /${profile.routeSegment || 'destinations'}/${sample.slug}/`,
  });
  hero.append(badges, title, meta);
  return hero;
}

function renderDestinationCardEl(profile, sample, locale) {
  const card = Object.assign(document.createElement('div'), { className: 'vc-dest-card' });
  const sortedAttrs = [...(profile.attributes || [])].sort((a, b) => a.order - b.order);
  const badgeKeys = profile.card?.badgeAttributeKeys?.length
    ? profile.card.badgeAttributeKeys
    : sortedAttrs.filter((a) => a.showOnCard).slice(0, 1).map((a) => a.key);
  const statAttrs = sortedAttrs.filter(
    (a) => a.showOnCard || (profile.card?.statAttributeKeys || []).includes(a.key),
  );
  card.appendChild(renderCardHeroEl(profile, sample, sortedAttrs, badgeKeys, locale));

  const statsGrid = Object.assign(document.createElement('div'), { className: 'vc-dest-card__stats' });
  for (const attr of statAttrs.slice(0, 6)) {
    const box = Object.assign(document.createElement('div'), { className: 'vc-stat-box' });
    box.append(
      Object.assign(document.createElement('span'), { className: 'vc-stat-box__label', textContent: pickLoc(attr.label, locale, attr.key) }),
      Object.assign(document.createElement('span'), { className: 'vc-stat-box__val', textContent: formatPreviewAttrValue(readDotPath(sample, attr.path), attr, locale) }),
    );
    statsGrid.appendChild(box);
  }
  if (statAttrs.length > 0) card.appendChild(statsGrid);

  const hlItems = Array.isArray(sample.highlights) ? sample.highlights.slice(0, Number(profile.card?.highlightLimit ?? 3)) : [];
  if (hlItems.length > 0) {
    const ul = Object.assign(document.createElement('ul'), { className: 'vc-dest-card__highlights' });
    hlItems.forEach((h) => ul.appendChild(Object.assign(document.createElement('li'), { textContent: pickLoc(h, locale, '') })));
    card.appendChild(ul);
  }
  return card;
}

function buildCompareTableRows(tbody, compAttrs, samples, locale) {
  if (compAttrs.length === 0) {
    const tr = document.createElement('tr');
    tr.appendChild(Object.assign(document.createElement('td'), {
      colSpan: 1 + Math.min(3, samples.length),
      className: 'adm-table__empty',
      textContent: '尚未勾选任何「用于对比」属性',
    }));
    tbody.appendChild(tr);
    return;
  }
  for (const attr of compAttrs) {
    const tr = document.createElement('tr');
    tr.appendChild(Object.assign(document.createElement('td'), { textContent: pickLoc(attr.label, locale, attr.key) }));
    samples.slice(0, 3).forEach((s, idx) => {
      const raw = readDotPath(s, attr.path);
      const val = raw !== undefined ? raw : synthesizeFallbackAttrValue(attr, idx);
      tr.appendChild(Object.assign(document.createElement('td'), { textContent: formatPreviewAttrValue(val, attr, locale) }));
    });
    tbody.appendChild(tr);
  }
}

function renderSpecCompareTableEl(profile, samples, locale) {
  const wrap = Object.assign(document.createElement('div'), { className: 'adm-table-wrap' });
  const table = Object.assign(document.createElement('table'), { className: 'adm-table' });
  const compAttrs = [...(profile.attributes || [])].sort((a, b) => a.order - b.order).filter((a) => a.comparable);

  const thead = document.createElement('thead');
  const htr = document.createElement('tr');
  htr.appendChild(Object.assign(document.createElement('th'), { textContent: '规格对比维度' }));
  samples.slice(0, 3).forEach((s) => {
    htr.appendChild(Object.assign(document.createElement('th'), { textContent: pickLoc(s.name, locale, s.slug) }));
  });
  thead.appendChild(htr);

  const tbody = document.createElement('tbody');
  buildCompareTableRows(tbody, compAttrs, samples, locale);
  table.append(thead, tbody);
  wrap.appendChild(table);
  return wrap;
}

export function renderLiveVerticalPreview(container, { profile, examples = [], locale = 'zh-CN', onLocaleChange }) {
  container.innerHTML = '';
  const samples = Array.isArray(examples) && examples.length > 0 ? examples : buildFallbackSamples(profile);

  const head = Object.assign(document.createElement('div'), { className: 'vc-panel__title' });
  head.appendChild(Object.assign(document.createElement('span'), { textContent: '实时效果预览（卡片 + 规格对比表）' }));
  const locTabs = Object.assign(document.createElement('div'), { className: 'adm-i18n-tabs' });
  for (const loc of ADMIN_LOCALES) {
    const b = Object.assign(document.createElement('button'), {
      type: 'button',
      className: `adm-i18n-tab ${loc.code === locale ? 'is-active' : ''}`,
      textContent: loc.code,
    });
    b.addEventListener('click', () => onLocaleChange && onLocaleChange(loc.code));
    locTabs.appendChild(b);
  }
  container.append(head, locTabs);
  container.appendChild(renderDestinationCardEl(profile, samples[0], locale));
  container.appendChild(renderSpecCompareTableEl(profile, samples, locale));

  const activeSections = [...(profile.sections || [])]
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);
  const pillWrap = Object.assign(document.createElement('div'), { className: 'vc-sec-pills' });
  activeSections.forEach((sec, idx) => {
    pillWrap.appendChild(Object.assign(document.createElement('span'), {
      className: 'vc-tag',
      textContent: `${idx + 1}. ${pickLoc(sec.label, locale, sec.id)}`,
    }));
  });
  container.appendChild(pillWrap);
}
