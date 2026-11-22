import { adminApi, bindAsyncButton, openDialog, showToast } from '/ui/kit/index.js';
import { COLLECTION_LABELS } from './styles.js';

const REVIEW_EXPORT_LOCALES = [
  { value: 'ja', label: '日本語 (ja)' },
  { value: 'ko', label: '한국어 (ko)' },
  { value: 'zh-Hant', label: '繁體中文 (zh-Hant)' },
];

async function triggerCsvFileDownload(urlPath, fileName) {
  const res = await fetch(urlPath, { method: 'GET', credentials: 'same-origin' });
  if (!res.ok) {
    let errText = `导出失败（HTTP ${res.status}）`;
    try {
      const payload = await res.json();
      if (payload?.error) errText = payload.error;
    } catch {
      // Keep fallback message
    }
    throw new Error(errText);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: objectUrl, download: fileName });
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function buildCsvExportDialogBody(body, currentFilters) {
  const localeSelect = Object.assign(document.createElement('select'), { className: 'adm-input' });
  for (const opt of REVIEW_EXPORT_LOCALES) {
    localeSelect.appendChild(Object.assign(document.createElement('option'), {
      value: opt.value, textContent: opt.label, selected: currentFilters.locale === opt.value,
    }));
  }
  const colSelect = Object.assign(document.createElement('select'), { className: 'adm-input' });
  colSelect.appendChild(Object.assign(document.createElement('option'), { value: 'all', textContent: '全部集合' }));
  for (const [key, label] of Object.entries(COLLECTION_LABELS)) {
    colSelect.appendChild(Object.assign(document.createElement('option'), {
      value: key, textContent: label, selected: currentFilters.collection === key,
    }));
  }
  const hint = Object.assign(document.createElement('p'), {
    className: 'adm-muted',
    textContent: '仅导出处于 machine（机器翻译待审）状态的条目字段，可用 Excel 直接打开填写「修改后译文 / 审校人 / 结论」。',
  });
  body.append(
    Object.assign(document.createElement('label'), { className: 'adm-label', textContent: '导出目标语言' }),
    localeSelect,
    Object.assign(document.createElement('label'), { className: 'adm-label', textContent: '集合范围' }),
    colSelect,
    hint,
  );
  return { localeSelect, colSelect };
}

export function openCsvExportDialog(siteId, currentFilters = {}) {
  let refs;
  openDialog({
    title: '导出外包人工审校 CSV（含 UTF-8 BOM）',
    confirmLabel: '下载 CSV 文件',
    renderBody: (body) => { refs = buildCsvExportDialogBody(body, currentFilters); },
    onConfirm: async () => {
      const loc = refs.localeSelect.value;
      const col = refs.colSelect.value;
      const qs = new URLSearchParams({ siteId, locale: loc, ...(col !== 'all' ? { collection: col } : {}) });
      await triggerCsvFileDownload(`/api/admin/translations/csv/export?${qs.toString()}`, `review-${siteId}-${loc}.csv`);
      showToast(`已导出 ${loc} 审校 CSV`, 'success');
    },
  });
}

function renderImportPreviewSummary(previewHost, res) {
  previewHost.innerHTML = '';
  const st = res.stats || {};
  const summary = Object.assign(document.createElement('div'), {
    className: 'adm-alert adm-alert--warn',
    textContent:
      `预检结果：通过 ${st.approvedCount ?? 0} 行 · 修改 ${st.modifiedCount ?? 0} 行 · 驳回 ${st.rejectedCount ?? 0} 行 · ` +
      `拟更新 ${res.updatedFiles?.length ?? 0} 个文件 · 升为已审校 ${res.promotedToReviewed?.length ?? 0} 条 · 阻断 ${res.blockedEntries?.length ?? 0} 条`,
  });
  previewHost.appendChild(summary);
  if (Array.isArray(res.blockedEntries) && res.blockedEntries.length > 0) {
    const pre = Object.assign(document.createElement('pre'), {
      className: 'adm-code',
      textContent: res.blockedEntries.map((b) => `[${b.locale}] ${b.file}: ${b.reasons.join('；')}`).join('\n'),
    });
    previewHost.appendChild(pre);
  }
}

function buildCsvImportDialogBody(body, siteId, canReview) {
  const localeSelect = Object.assign(document.createElement('select'), { className: 'adm-input' });
  for (const opt of REVIEW_EXPORT_LOCALES) {
    localeSelect.appendChild(Object.assign(document.createElement('option'), { value: opt.value, textContent: opt.label }));
  }
  const fileInput = Object.assign(document.createElement('input'), { type: 'file', accept: '.csv,text/csv', className: 'adm-input' });
  const csvArea = Object.assign(document.createElement('textarea'), {
    className: 'adm-textarea adm-code', rows: 7, placeholder: '选择本地 CSV 文件，或在此直接粘贴审校后的 CSV 文本…',
  });
  const noteInput = Object.assign(document.createElement('input'), {
    type: 'text', className: 'adm-input', placeholder: '可选：Git 提交备注（例如：完成北海道日语外包审校）',
  });
  const previewBtn = Object.assign(document.createElement('button'), {
    type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '第一步：预检校验（Dry-Run）',
    disabled: !canReview,
  });
  const previewHost = document.createElement('div');

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (file) csvArea.value = await file.text();
  });
  bindAsyncButton(previewBtn, async () => {
    const res = await adminApi.post('/translations/csv/import', {
      siteId, locale: localeSelect.value, csvContent: csvArea.value, write: false,
    });
    renderImportPreviewSummary(previewHost, res);
  }, { onError: (err) => showToast(err.message || 'CSV 预检失败', 'error') });

  body.append(
    Object.assign(document.createElement('label'), { className: 'adm-label', textContent: '审校语言' }),
    localeSelect,
    Object.assign(document.createElement('label'), { className: 'adm-label', textContent: '上传 CSV 文件或粘贴内容' }),
    fileInput, csvArea,
    Object.assign(document.createElement('label'), { className: 'adm-label', textContent: '提交说明' }),
    noteInput, previewBtn, previewHost,
  );
  return { localeSelect, csvArea, noteInput, previewHost };
}

export function openCsvImportDialog(siteId, canReview, onImported) {
  let refs;
  openDialog({
    title: '导入外包审校 CSV 并写回 Git',
    confirmLabel: canReview ? '确认写回并提交 Git' : '缺少审校权限',
    renderBody: (body) => { refs = buildCsvImportDialogBody(body, siteId, canReview); },
    onConfirm: async () => {
      if (!canReview) throw new Error('当前账号缺少 translations:review 权限，无法导入写回');
      const res = await adminApi.post('/translations/csv/import', {
        siteId, locale: refs.localeSelect.value, csvContent: refs.csvArea.value,
        write: true, message: refs.noteInput.value.trim(),
      });
      if (res.blockedEntries?.length > 0 && (!res.updatedFiles || res.updatedFiles.length === 0)) {
        renderImportPreviewSummary(refs.previewHost, res);
        throw new Error(`CSV 存在 ${res.blockedEntries.length} 条质检阻断项，未写入磁盘`);
      }
      showToast(
        res.commitHash
          ? `CSV 导入完成，已生成提交 ${res.commitHash.slice(0, 8)}`
          : 'CSV 无实际字段变更',
        'success',
      );
      if (typeof onImported === 'function') await onImported();
    },
  });
}
