import { bindAsyncButton, renderDataTable } from '/ui/kit/index.js';
import { COLLECTION_LABELS, LOCALE_LABELS, STATE_LABELS } from './styles.js';

function createStatCard({ label, count, subText, active, onClick, pills = [] }) {
  const card = Object.assign(document.createElement('div'), {
    className: `tr-stat-card ${active ? 'is-active' : ''}`,
    role: 'button',
    tabIndex: 0,
  });
  card.append(
    Object.assign(document.createElement('div'), { className: 'tr-stat-card__label', textContent: label }),
    Object.assign(document.createElement('div'), { className: 'tr-stat-card__num', textContent: String(count) }),
    Object.assign(document.createElement('div'), { className: 'adm-muted', textContent: subText }),
  );
  card.addEventListener('click', (e) => {
    if (e.target.closest('.tr-pill-btn')) return;
    onClick();
  });
  if (pills.length > 0) {
    const pillRow = Object.assign(document.createElement('div'), { className: 'tr-mini-pills' });
    for (const p of pills) {
      const btn = Object.assign(document.createElement('button'), {
        type: 'button', className: 'tr-pill-btn', textContent: p.text,
      });
      btn.addEventListener('click', (e) => { e.stopPropagation(); p.onSelect(); });
      pillRow.appendChild(btn);
    }
    card.appendChild(pillRow);
  }
  return card;
}

function renderTopStateCards(overview, filters, onFilterChange) {
  const grid = Object.assign(document.createElement('div'), { className: 'tr-cards-grid' });
  const defs = [
    { key: 'missing', label: '缺失译文 (missing)', sub: '点击筛出缺译条目' },
    { key: 'stale', label: '源文变动过期 (stale)', sub: '点击筛出需重译/重审条目' },
    { key: 'machine', label: '机器翻译待审 (machine)', sub: '点击筛出待人工核验条目' },
    { key: 'reviewed', label: '已人工审校 (reviewed)', sub: '点击查看已审校完成字段' },
  ];
  for (const d of defs) {
    grid.appendChild(createStatCard({
      label: d.label,
      count: overview.totals?.[d.key] ?? 0,
      subText: d.sub,
      active: filters.state === d.key,
      onClick: () => onFilterChange({ state: filters.state === d.key ? '' : d.key }),
    }));
  }
  return grid;
}

function renderSiteAndLocaleCards(overview, filters, onFilterChange, onSwitchSite) {
  const frag = document.createDocumentFragment();
  if (Array.isArray(overview.bySite) && overview.bySite.length > 0) {
    frag.appendChild(Object.assign(document.createElement('div'), { className: 'tr-section-sub', textContent: '按站点统计' }));
    const siteGrid = Object.assign(document.createElement('div'), { className: 'tr-cards-grid' });
    for (const s of overview.bySite) {
      siteGrid.appendChild(createStatCard({
        label: `${s.brandNameZh} (${s.siteId})`,
        count: `${s.entriesCount} 条`,
        subText: `缺 ${s.missing} · 过 ${s.stale} · 机翻 ${s.machine} · 已审 ${s.reviewed}`,
        active: s.siteId === overview.siteId,
        onClick: () => onSwitchSite(s.siteId),
      }));
    }
    frag.appendChild(siteGrid);
  }

  frag.appendChild(Object.assign(document.createElement('div'), { className: 'tr-section-sub', textContent: '按目标语言统计（点击卡片或状态胶囊筛选）' }));
  const locGrid = Object.assign(document.createElement('div'), { className: 'tr-cards-grid' });
  for (const l of overview.byLocale || []) {
    locGrid.appendChild(createStatCard({
      label: LOCALE_LABELS[l.locale] || l.locale,
      count: `${l.reviewedEntries}/${l.totalEntries} 条已审`,
      subText: `总字段 ${l.totalFields}`,
      active: filters.locale === l.locale,
      onClick: () => onFilterChange({ locale: filters.locale === l.locale ? '' : l.locale }),
      pills: ['missing', 'stale', 'machine', 'reviewed'].map((stKey) => ({
        text: `${STATE_LABELS[stKey]} ${l[stKey] ?? 0}`,
        onSelect: () => onFilterChange({ locale: l.locale, state: stKey }),
      })),
    }));
  }
  frag.appendChild(locGrid);
  return frag;
}

function renderCollectionCards(overview, filters, onFilterChange) {
  const frag = document.createDocumentFragment();
  frag.appendChild(Object.assign(document.createElement('div'), { className: 'tr-section-sub', textContent: '按内容集合统计（点击筛入对应集合）' }));
  const colGrid = Object.assign(document.createElement('div'), { className: 'tr-cards-grid' });
  for (const c of overview.byCollection || []) {
    colGrid.appendChild(createStatCard({
      label: COLLECTION_LABELS[c.collection] || c.collection,
      count: `${c.entriesCount} 条`,
      subText: `缺 ${c.missing} · 过 ${c.stale} · 机翻 ${c.machine} · 已审 ${c.reviewed}`,
      active: filters.collection === c.collection,
      onClick: () => onFilterChange({ collection: filters.collection === c.collection ? '' : c.collection }),
    }));
  }
  frag.appendChild(colGrid);
  return frag;
}

export function renderLintIssuesPanel(lintReport, onJumpToField, onDismiss) {
  const box = Object.assign(document.createElement('div'), { className: 'tr-lint-box' });
  const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  const issues = lintReport.issues || [];
  head.append(
    Object.assign(document.createElement('strong'), {
      textContent: issues.length > 0
        ? `翻译质量检查发现 ${issues.length} 项违规（扫描 ${lintReport.filesScanned ?? 1} 个条目，点击可直接定位字段）`
        : `✅ 翻译质量检查通过（扫描 ${lintReport.filesScanned ?? 1} 个条目，0 项违规）`,
    }),
  );
  if (typeof onDismiss === 'function') {
    const closeBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '收起' });
    closeBtn.addEventListener('click', onDismiss);
    head.appendChild(closeBtn);
  }
  box.appendChild(head);
  for (const item of issues.slice(0, 60)) {
    const row = Object.assign(document.createElement('div'), { className: 'tr-lint-item' });
    const text = Object.assign(document.createElement('div'), {
      textContent: `[${item.rule}][${item.locale}] ${item.collection}/${item.slug} :: ${item.fieldPath} — ${item.message}`,
    });
    const jumpBtn = Object.assign(document.createElement('button'), {
      type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '定位到字段 →',
    });
    bindAsyncButton(jumpBtn, async () => onJumpToField(item.collection, item.slug, item.locale, item.fieldPath));
    row.append(text, jumpBtn);
    box.appendChild(row);
  }
  return box;
}

function filterOverviewRows(entries, filters) {
  return (entries || []).filter((r) => {
    if (filters.collection && r.collection !== filters.collection) return false;
    if (filters.locale) {
      const cell = r.localeStates?.[filters.locale];
      if (!cell || cell.totalFields === 0) return false;
      if (filters.state === 'reviewed' && cell.summaryState !== 'reviewed' && cell.reviewed === 0) return false;
      if ((filters.state === 'missing' || filters.state === 'stale' || filters.state === 'machine') && cell[filters.state] <= 0) return false;
    } else if (filters.state && (r[filters.state] ?? 0) <= 0) {
      return false;
    }
    return true;
  });
}

function renderEntryLocaleBadges(row, targetLocales, onOpenEntry) {
  const wrap = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  for (const loc of targetLocales) {
    const cell = row.localeStates?.[loc];
    const st = cell?.summaryState || 'missing';
    const btn = Object.assign(document.createElement('button'), {
      type: 'button',
      className: `tr-pill-btn adm-badge adm-badge--${st}`,
      textContent: `${loc}: ${STATE_LABELS[st] || st}`,
    });
    btn.addEventListener('click', () => onOpenEntry(row.collection, row.slug, loc));
    wrap.appendChild(btn);
  }
  return wrap;
}

function renderOverviewDataTable(tableHost, overview, filters, onOpenEntry) {
  renderDataTable(tableHost, {
    rows: filterOverviewRows(overview.entries, filters),
    filterPlaceholder: '输入 slug 或中文标题搜索…',
    columns: [
      { key: 'collection', label: '集合' },
      { key: 'slug', label: 'Slug' },
      { key: 'titleZh', label: '中文标题' },
      { key: 'locales', label: '多语审校状态（点击直达）', sortable: false, render: (r) => renderEntryLocaleBadges(r, overview.targetLocales || [], onOpenEntry) },
      { key: 'missing', label: '缺失' },
      { key: 'stale', label: '过期' },
      { key: 'machine', label: '机翻待审' },
      { key: 'reviewed', label: '已审校' },
      {
        key: 'act', label: '操作', sortable: false,
        render: (r) => {
          const btn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--primary adm-btn--sm', textContent: '左右对照审校' });
          bindAsyncButton(btn, async () => onOpenEntry(r.collection, r.slug, filters.locale || overview.targetLocales?.[0] || 'ja'));
          return btn;
        },
      },
    ],
  });
}

export function renderOverviewScreen(host, { overview, filters, lintReport, onFilterChange, onSwitchSite, onOpenEntry, onDismissLint }) {
  host.innerHTML = '';
  host.append(
    renderTopStateCards(overview, filters, onFilterChange),
    renderSiteAndLocaleCards(overview, filters, onFilterChange, onSwitchSite),
    renderCollectionCards(overview, filters, onFilterChange),
  );
  if (lintReport) host.appendChild(renderLintIssuesPanel(lintReport, onOpenEntry, onDismissLint));

  const filterBanner = Object.assign(document.createElement('div'), { className: 'adm-table-bar' });
  const activeTags = [
    filters.collection ? `集合=${filters.collection}` : '',
    filters.locale ? `语言=${filters.locale}` : '',
    filters.state ? `状态=${STATE_LABELS[filters.state] || filters.state}` : '',
  ].filter(Boolean);
  filterBanner.appendChild(Object.assign(document.createElement('strong'), {
    textContent: activeTags.length > 0 ? `当前筛选：${activeTags.join(' · ')}` : '全部可审校内容条目',
  }));
  if (activeTags.length > 0) {
    const clearBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '清除筛选条件' });
    clearBtn.addEventListener('click', () => onFilterChange({ collection: '', locale: '', state: '' }));
    filterBanner.appendChild(clearBtn);
  }
  const tableHost = document.createElement('div');
  host.append(filterBanner, tableHost);
  renderOverviewDataTable(tableHost, overview, filters, onOpenEntry);
}
