import { openDialog, renderMonthCalendar, showToast } from '/ui/kit/index.js';
import {
  batchUpdateDepartures,
  deleteSingleDeparture,
  generateWeeklyDepartures,
  normalizePackageForDepartures,
  sortDepartures,
  upsertSingleDeparture,
} from './departures-core.js';
import { fieldBox, h, renderCurrencyPreviewBar } from './dom-helpers.js';

const STATUS_SHORT = { open: '可报', limited: '紧张', full: '已满' };

function formatDepartureCellLabel(dep) {
  const parts = [];
  if (typeof dep.priceCny === 'number') parts.push(`¥${dep.priceCny}`);
  if (typeof dep.seatsLeft === 'number') parts.push(`余${dep.seatsLeft}`);
  if (dep.status) parts.push(STATUS_SHORT[dep.status] || dep.status);
  return parts.length > 0 ? parts.join('·') : '已设团期';
}

function buildStatusSelect(initialVal, allowUnset = false) {
  const sel = h('select', { className: 'adm-input' });
  if (allowUnset) sel.appendChild(h('option', { value: '', textContent: '保持原状态不变' }));
  else sel.appendChild(h('option', { value: '', textContent: '默认状态（不显式指定）' }));
  for (const [val, txt] of [['open', '充足可报 (open)'], ['limited', '余位紧张 (limited)'], ['full', '已满团 (full)']]) {
    sel.appendChild(h('option', { value: val, textContent: txt, selected: val === initialVal }));
  }
  return sel;
}

function openSingleDayDialog(isoDate, existingDep, ratesInfo, applyNextDepartures) {
  const priceInp = h('input', { type: 'number', min: '1', className: 'adm-input', value: existingDep?.priceCny ?? '', placeholder: '留空则使用套餐默认价' });
  const seatsInp = h('input', { type: 'number', min: '0', step: '1', className: 'adm-input', value: existingDep?.seatsLeft ?? '', placeholder: '留空则不显示库存余位' });
  const statusSel = buildStatusSelect(existingDep?.status || '', false);
  const rateBar = h('div', { className: 'prd-rates-bar' });
  renderCurrencyPreviewBar(rateBar, priceInp.value, ratesInfo);
  priceInp.addEventListener('input', () => renderCurrencyPreviewBar(rateBar, priceInp.value, ratesInfo));

  openDialog({
    title: `${existingDep ? '编辑' : '新增'}团期 · ${isoDate}`,
    confirmLabel: '保存该日团期',
    renderBody: (body) => {
      body.append(
        fieldBox('团期价格（CNY，可选）', priceInp),
        rateBar,
        fieldBox('剩余席位（seatsLeft，填写后自动切换为 sync 库存模式）', seatsInp),
        fieldBox('报名状态（status）', statusSel),
      );
      if (existingDep) {
        const delBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--danger adm-btn--sm', textContent: '删除该日团期' });
        delBtn.addEventListener('click', () => {
          applyNextDepartures((list) => deleteSingleDeparture(list, isoDate), isoDate);
          body.closest('.adm-dialog-backdrop')?.remove();
          showToast(`已移除 ${isoDate} 团期`, 'info');
        });
        body.appendChild(h('div', { style: 'margin-top:6px' }, [delBtn]));
      }
    },
    onConfirm: async () => {
      applyNextDepartures(
        (list) => upsertSingleDeparture(list, { date: isoDate, priceCny: priceInp.value, seatsLeft: seatsInp.value, status: statusSel.value }),
        isoDate,
      );
      showToast(`已更新 ${isoDate} 团期`, 'success');
    },
  });
}

function buildWeekdaySelector(weekdaysMeta) {
  const selectedDays = new Set([6]);
  const dayGrid = h('div', { className: 'prd-check-grid' });
  for (const wd of weekdaysMeta) {
    const chk = h('input', { type: 'checkbox', checked: selectedDays.has(wd.day) });
    chk.addEventListener('change', () => {
      if (chk.checked) selectedDays.add(wd.day);
      else selectedDays.delete(wd.day);
    });
    dayGrid.appendChild(h('label', { className: 'prd-check-item' }, [chk, wd.label]));
  }
  return { selectedDays, dayGrid };
}

function openWeeklyGenerateDialog(weekdaysMeta, ratesInfo, applyNextDepartures) {
  const startInp = h('input', { type: 'date', className: 'adm-input', value: '2026-12-01' });
  const endInp = h('input', { type: 'date', className: 'adm-input', value: '2027-02-28' });
  const priceInp = h('input', { type: 'number', min: '1', className: 'adm-input', placeholder: '可选，CNY 金额' });
  const seatsInp = h('input', { type: 'number', min: '0', step: '1', className: 'adm-input', placeholder: '可选，例如 12' });
  const statusSel = buildStatusSelect('open', false);
  const rateBar = h('div', { className: 'prd-rates-bar' });
  priceInp.addEventListener('input', () => renderCurrencyPreviewBar(rateBar, priceInp.value, ratesInfo));
  const { selectedDays, dayGrid } = buildWeekdaySelector(weekdaysMeta);

  openDialog({
    title: '按周重复批量生成团期',
    confirmLabel: '生成团期',
    renderBody: (body) => {
      body.append(
        h('div', { className: 'prd-grid-2' }, [fieldBox('开始日期', startInp), fieldBox('结束日期', endInp)]),
        fieldBox('重复星期（可多选）', dayGrid),
        h('div', { className: 'prd-grid-3' }, [fieldBox('团期价 CNY', priceInp), fieldBox('余位 seatsLeft', seatsInp), fieldBox('状态', statusSel)]),
        rateBar,
      );
    },
    onConfirm: async () => {
      let generated = 0;
      applyNextDepartures((list) => {
        const res = generateWeeklyDepartures(list, { startDate: startInp.value, endDate: endInp.value, weekdays: Array.from(selectedDays), priceCny: priceInp.value, seatsLeft: seatsInp.value, status: statusSel.value });
        generated = res.generatedCount;
        return res.departures;
      }, startInp.value);
      showToast(`已按周批量生成/更新 ${generated} 个团期`, 'success');
    },
  });
}

function openBatchSeatsDialog(applyNextDepartures) {
  const startInp = h('input', { type: 'date', className: 'adm-input' });
  const endInp = h('input', { type: 'date', className: 'adm-input' });
  const modeSel = h('select', { className: 'adm-input' }, [
    h('option', { value: 'update', textContent: '批量修改余位 / 状态 / 价格' }),
    h('option', { value: 'delete', textContent: '批量删除范围内团期' }),
  ]);
  const seatsInp = h('input', { type: 'number', min: '0', step: '1', className: 'adm-input', placeholder: '不改请留空' });
  const clearSeatsChk = h('input', { type: 'checkbox' });
  const priceInp = h('input', { type: 'number', min: '1', className: 'adm-input', placeholder: '不改请留空' });
  const statusSel = buildStatusSelect('', true);

  openDialog({
    title: '批量修改余位与团期状态',
    confirmLabel: '执行批量修改',
    renderBody: (body) => {
      body.append(
        fieldBox('执行动作', modeSel),
        h('div', { className: 'prd-grid-2' }, [fieldBox('起始日期（可选）', startInp), fieldBox('截止日期（可选）', endInp)]),
        h('div', { className: 'prd-grid-3' }, [fieldBox('批量余位', seatsInp), fieldBox('批量价格 CNY', priceInp), fieldBox('批量状态', statusSel)]),
        h('label', { className: 'prd-check-item' }, [clearSeatsChk, '清空余位字段（恢复为纯日期模式）']),
      );
    },
    onConfirm: async () => {
      let count = 0;
      applyNextDepartures((list) => {
        const res = batchUpdateDepartures(list, { mode: modeSel.value, startDate: startInp.value, endDate: endInp.value, seatsLeft: seatsInp.value, clearSeatsLeft: clearSeatsChk.checked, priceCny: priceInp.value, status: statusSel.value });
        count = res.updatedCount;
        return res.departures;
      }, startInp.value);
      showToast(`已批量处理 ${count} 个团期`, 'success');
    },
  });
}

function syncCalendarDisplay(calHost, summaryEl, draft, viewMonth, ratesInfo, applyNextDepartures) {
  const normalized = normalizePackageForDepartures(draft);
  draft.departures = normalized.departures;
  draft.sourceType = normalized.sourceType;
  const withSeats = draft.departures.filter((d) => typeof d.seatsLeft === 'number').length;
  summaryEl.textContent = `当前共 ${draft.departures.length} 个团期（含余位库存 ${withSeats} 个，当前数据来源：${draft.sourceType}）。点击任意日期可单独新增或编辑。`;
  renderMonthCalendar(calHost, {
    year: viewMonth.year,
    month: viewMonth.month,
    items: draft.departures.map((d) => ({ ...d, label: formatDepartureCellLabel(d) })),
    onSelectDate: (iso, entry) => openSingleDayDialog(iso, entry, ratesInfo, applyNextDepartures),
  });
}

export function createDeparturesCalendarPanel({ draft, meta, onChange }) {
  const card = h('div', { className: 'prd-card' });
  const summaryEl = h('p', { className: 'adm-muted', style: 'margin:0 0 10px' });
  const calHost = h('div');
  const firstDate = sortDepartures(draft.departures || [])[0]?.date || '';
  const viewMonth = {
    year: firstDate ? Number.parseInt(firstDate.slice(0, 4), 10) : new Date().getFullYear(),
    month: firstDate ? Number.parseInt(firstDate.slice(5, 7), 10) : new Date().getMonth() + 1,
  };

  const applyNextDepartures = (updaterFn, focusIsoDate = '') => {
    draft.departures = updaterFn(draft.departures || []);
    if (focusIsoDate && /^\d{4}-\d{2}/.test(focusIsoDate)) {
      viewMonth.year = Number.parseInt(focusIsoDate.slice(0, 4), 10);
      viewMonth.month = Number.parseInt(focusIsoDate.slice(5, 7), 10);
    }
    syncCalendarDisplay(calHost, summaryEl, draft, viewMonth, meta.rates, applyNextDepartures);
    onChange();
  };

  const genBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '按周重复批量生成', onClick: () => openWeeklyGenerateDialog(meta.enums?.weekdays || [], meta.rates, applyNextDepartures) });
  const batchBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '批量改余位/状态', onClick: () => openBatchSeatsDialog(applyNextDepartures) });
  const head = h('h4', { className: 'prd-card__title' }, [h('span', { textContent: '团期日历与库存管理（departures）' }), h('div', { className: 'adm-inline-actions' }, [genBtn, batchBtn])]);
  card.append(head, summaryEl, calHost);
  syncCalendarDisplay(calHost, summaryEl, draft, viewMonth, meta.rates, applyNextDepartures);
  return card;
}
