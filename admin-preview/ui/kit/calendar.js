const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function formatIsoDay(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function drawCalendarGrid(ctx) {
  const { container, itemsByDate, onSelectDate } = ctx;
  container.innerHTML = '';

  const head = Object.assign(document.createElement('div'), { className: 'adm-cal-head' });
  const prevBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '上月' });
  const title = Object.assign(document.createElement('strong'), { textContent: `${ctx.year} 年 ${ctx.month} 月` });
  const nextBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '下月' });
  prevBtn.addEventListener('click', () => { ctx.month -= 1; if (ctx.month < 1) { ctx.month = 12; ctx.year -= 1; } drawCalendarGrid(ctx); });
  nextBtn.addEventListener('click', () => { ctx.month += 1; if (ctx.month > 12) { ctx.month = 1; ctx.year += 1; } drawCalendarGrid(ctx); });
  head.append(prevBtn, title, nextBtn);

  const grid = Object.assign(document.createElement('div'), { className: 'adm-cal-grid' });
  for (const wd of WEEKDAY_LABELS) {
    grid.appendChild(Object.assign(document.createElement('div'), { className: 'adm-cal-weekday', textContent: `周${wd}` }));
  }

  const firstWeekday = (new Date(Date.UTC(ctx.year, ctx.month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(ctx.year, ctx.month, 0)).getUTCDate();
  for (let i = 0; i < firstWeekday; i += 1) {
    grid.appendChild(Object.assign(document.createElement('div'), { className: 'adm-cal-cell is-empty' }));
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    const iso = formatIsoDay(ctx.year, ctx.month, d);
    const entry = itemsByDate.get(iso);
    const cell = Object.assign(document.createElement('button'), { type: 'button', className: `adm-cal-cell ${entry ? 'has-item' : ''}` });
    cell.innerHTML = `<span class="adm-cal-day">${d}</span>`;
    if (entry?.label) cell.appendChild(Object.assign(document.createElement('small'), { textContent: entry.label }));
    cell.addEventListener('click', () => { if (typeof onSelectDate === 'function') onSelectDate(iso, entry || null); });
    grid.appendChild(cell);
  }
  container.append(head, grid);
}

export function renderMonthCalendar(container, options = {}) {
  const now = new Date();
  const itemsByDate = new Map();
  for (const item of options.items || []) {
    if (item?.date) itemsByDate.set(item.date, item);
  }
  drawCalendarGrid({
    container,
    year: options.year || now.getFullYear(),
    month: options.month || now.getMonth() + 1,
    itemsByDate,
    onSelectDate: options.onSelectDate,
  });
}
