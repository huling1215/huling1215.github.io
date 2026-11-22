const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const VALID_STATUSES = new Set(['open', 'limited', 'full']);

export function formatUtcMsToIso(ms) {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDateUtc(rawDate, label = '日期') {
  const str = String(rawDate || '').trim();
  if (!ISO_DATE_RE.test(str)) {
    throw new Error(`${label}格式不合法，必须为 YYYY-MM-DD`);
  }
  const [y, m, d] = str.split('-').map((n) => Number.parseInt(n, 10));
  const ms = Date.UTC(y, m - 1, d);
  if (formatUtcMsToIso(ms) !== str) {
    throw new Error(`${label}不是真实存在的日历日期：${str}`);
  }
  return ms;
}

export function sanitizeDeparture(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('团期条目必须为对象');
  }
  const dateStr = String(raw.date || '').trim();
  parseIsoDateUtc(dateStr, '团期日期');
  const clean = { date: dateStr };

  if (raw.priceCny !== undefined && raw.priceCny !== null && raw.priceCny !== '') {
    const p = Number(raw.priceCny);
    if (!Number.isFinite(p) || p <= 0) throw new Error(`团期 ${dateStr} 的价格必须为大于 0 的数字`);
    clean.priceCny = p;
  }
  if (raw.seatsLeft !== undefined && raw.seatsLeft !== null && raw.seatsLeft !== '') {
    const s = Number(raw.seatsLeft);
    if (!Number.isInteger(s) || s < 0) throw new Error(`团期 ${dateStr} 的余位必须为非负整数`);
    clean.seatsLeft = s;
  }
  if (raw.status !== undefined && raw.status !== null && raw.status !== '') {
    const st = String(raw.status).trim();
    if (!VALID_STATUSES.has(st)) throw new Error(`团期 ${dateStr} 状态不合法：${st}`);
    clean.status = st;
  }
  return clean;
}

export function sortDepartures(list) {
  return [...list].map(sanitizeDeparture).sort((a, b) => a.date.localeCompare(b.date));
}

function parseWeekdaysInput(weekdays) {
  if (!Array.isArray(weekdays) || weekdays.length === 0) {
    throw new Error('按周生成团期时，请至少勾选一个星期几');
  }
  const set = new Set();
  for (const w of weekdays) {
    const n = Number(w);
    if (!Number.isInteger(n) || n < 0 || n > 6) {
      throw new Error('星期参数必须在 0（周日）至 6（周六）之间');
    }
    set.add(n);
  }
  return set;
}

export function generateWeeklyDepartures(existing = [], options = {}) {
  const startMs = parseIsoDateUtc(options.startDate, '开始日期');
  const endMs = parseIsoDateUtc(options.endDate, '结束日期');
  if (endMs < startMs) throw new Error('结束日期不能早于开始日期');
  const spanDays = Math.round((endMs - startMs) / DAY_MS) + 1;
  if (spanDays > 370) throw new Error('单次批量生成团期的日期跨度不能超过 370 天');

  const weekdaySet = parseWeekdaysInput(options.weekdays);
  const byDate = new Map(sortDepartures(existing).map((d) => [d.date, d]));
  let generatedCount = 0;

  for (let ms = startMs; ms <= endMs; ms += DAY_MS) {
    const utcDay = new Date(ms).getUTCDay();
    if (!weekdaySet.has(utcDay)) continue;
    const iso = formatUtcMsToIso(ms);
    if (options.overwriteExisting === false && byDate.has(iso)) continue;
    const prev = byDate.get(iso) || {};
    const nextItem = sanitizeDeparture({
      ...prev,
      date: iso,
      ...(options.priceCny !== undefined && options.priceCny !== '' ? { priceCny: options.priceCny } : {}),
      ...(options.seatsLeft !== undefined && options.seatsLeft !== '' ? { seatsLeft: options.seatsLeft } : {}),
      ...(options.status ? { status: options.status } : {}),
    });
    byDate.set(iso, nextItem);
    generatedCount += 1;
  }

  const departures = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  return { departures, generatedCount };
}

function buildDateMatcher(options) {
  if (Array.isArray(options.dates) && options.dates.length > 0) {
    const set = new Set(options.dates.map((d) => String(d).trim()));
    for (const d of set) parseIsoDateUtc(d, '指定团期日期');
    return (iso) => set.has(iso);
  }
  const hasStart = Boolean(options.startDate && String(options.startDate).trim());
  const hasEnd = Boolean(options.endDate && String(options.endDate).trim());
  if (hasStart && hasEnd) {
    const sMs = parseIsoDateUtc(options.startDate, '筛选开始日期');
    const eMs = parseIsoDateUtc(options.endDate, '筛选结束日期');
    if (eMs < sMs) throw new Error('筛选结束日期不能早于开始日期');
  } else if (hasStart) {
    parseIsoDateUtc(options.startDate, '筛选开始日期');
  } else if (hasEnd) {
    parseIsoDateUtc(options.endDate, '筛选结束日期');
  }
  const minIso = hasStart ? String(options.startDate).trim() : '0000-01-01';
  const maxIso = hasEnd ? String(options.endDate).trim() : '9999-12-31';
  return (iso) => iso >= minIso && iso <= maxIso;
}

function applyPatchToDeparture(dep, options) {
  const draft = { ...dep };
  if (options.clearSeatsLeft === true) delete draft.seatsLeft;
  else if (options.seatsLeft !== undefined && options.seatsLeft !== null && options.seatsLeft !== '') {
    draft.seatsLeft = options.seatsLeft;
  }
  if (options.clearPriceCny === true) delete draft.priceCny;
  else if (options.priceCny !== undefined && options.priceCny !== null && options.priceCny !== '') {
    draft.priceCny = options.priceCny;
  }
  if (options.clearStatus === true) delete draft.status;
  else if (options.status !== undefined && options.status !== null && options.status !== '') {
    draft.status = options.status;
  }
  return sanitizeDeparture(draft);
}

export function batchUpdateDepartures(existing = [], options = {}) {
  const matchDate = buildDateMatcher(options);
  const current = sortDepartures(existing);
  if (options.mode === 'delete') {
    const kept = current.filter((d) => !matchDate(d.date));
    return { departures: kept, updatedCount: current.length - kept.length };
  }
  let updatedCount = 0;
  const next = current.map((dep) => {
    if (!matchDate(dep.date)) return dep;
    updatedCount += 1;
    return applyPatchToDeparture(dep, options);
  });
  return { departures: next, updatedCount };
}

export function upsertSingleDeparture(existing = [], item) {
  const clean = sanitizeDeparture(item);
  const byDate = new Map(sortDepartures(existing).map((d) => [d.date, d]));
  byDate.set(clean.date, clean);
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function deleteSingleDeparture(existing = [], dateStr) {
  const cleanDate = String(dateStr || '').trim();
  return sortDepartures(existing).filter((d) => d.date !== cleanDate);
}

export function normalizePackageForDepartures(pkgData) {
  const rawDeps = Array.isArray(pkgData?.departures) ? pkgData.departures : [];
  const departures = sortDepartures(rawDeps);
  const hasSeatsInventory = departures.some((d) => typeof d.seatsLeft === 'number');
  const currentSource = pkgData?.sourceType || 'editorial';
  const nextSource = hasSeatsInventory && currentSource === 'editorial' ? 'sync' : currentSource;
  return {
    ...pkgData,
    sourceType: nextSource,
    departures,
  };
}
