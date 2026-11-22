import { adminApi, bindAsyncButton, renderDiffView, showToast } from '/ui/kit/index.js';
import { renderLintIssuesPanel } from './overview.js';
import { LOCALE_LABELS, STATE_LABELS } from './styles.js';

export function focusFieldInDetail(host, fieldPath) {
  if (!fieldPath) return;
  for (const card of host.querySelectorAll('.tr-field-card')) {
    const matched = card.dataset.fieldPath === fieldPath;
    card.classList.toggle('is-focused', matched);
    if (matched) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.querySelector('textarea')?.focus();
    }
  }
}

function buildDetailLocaleTabs(evaluation, activeLocale, onSwitchLocale) {
  const bar = Object.assign(document.createElement('div'), { className: 'adm-i18n-tabs', role: 'tablist' });
  for (const loc of evaluation.targetLocales || []) {
    const locEval = evaluation.locales?.[loc];
    const st = locEval?.summaryState || 'missing';
    const btn = Object.assign(document.createElement('button'), {
      type: 'button',
      className: `adm-i18n-tab ${loc === activeLocale ? 'is-active' : ''}`,
    });
    btn.append(
      Object.assign(document.createElement('span'), { textContent: LOCALE_LABELS[loc] || loc }),
      Object.assign(document.createElement('span'), {
        className: `adm-badge adm-badge--${st}`,
        textContent: `${STATE_LABELS[st] || st} (${locEval?.reviewedCount ?? 0}/${locEval?.totalFields ?? 0})`,
      }),
    );
    btn.addEventListener('click', () => onSwitchLocale(loc));
    bar.appendChild(btn);
  }
  return bar;
}

function renderFieldHeadRow(field, fieldIssues, canReview, onSingleToggle) {
  const head = Object.assign(document.createElement('div'), { className: 'tr-field-head' });
  const left = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  left.append(
    Object.assign(document.createElement('code'), { textContent: field.fieldPath }),
    Object.assign(document.createElement('span'), {
      className: `adm-badge adm-badge--${field.state}`,
      textContent: STATE_LABELS[field.state] || field.state,
    }),
  );
  if (field.reviewed && field.reviewer) {
    left.appendChild(Object.assign(document.createElement('span'), {
      className: 'adm-muted',
      textContent: `审校人：${field.reviewer} (${String(field.reviewedAt || '').slice(0, 10)})`,
    }));
  }
  if (fieldIssues.length > 0) {
    left.appendChild(Object.assign(document.createElement('span'), {
      className: 'adm-badge adm-badge--stale',
      textContent: `Lint 违规 ${fieldIssues.length} 项`,
    }));
  }

  const toggleBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: `adm-btn adm-btn--sm ${field.reviewed ? 'adm-btn--outline' : 'adm-btn--primary'}`,
    textContent: field.reviewed ? '✓ 已审校（点击取消）' : '标记已审校',
    disabled: !canReview,
    title: canReview ? '保存该字段译文并切换已审校状态' : '需要 translations:review 审校权限',
  });
  bindAsyncButton(toggleBtn, onSingleToggle, {
    loadingLabel: '提交中…',
    onError: (err) => showToast(err.message || '审校状态提交失败', 'error'),
  });
  head.append(left, toggleBtn);
  return head;
}

function appendFieldStaleAndLintBlocks(card, field, fieldIssues) {
  if (field.state === 'stale' && field.sourceDiff) {
    const staleNote = Object.assign(document.createElement('div'), {
      className: 'adm-muted',
      textContent: '⚠️ zh-CN 源文已发生变更，当前译文被标记为过期（stale），差异对照如下：',
    });
    const diffBox = document.createElement('div');
    renderDiffView(diffBox, field.sourceDiff);
    card.append(staleNote, diffBox);
  }
  for (const iss of fieldIssues) {
    card.appendChild(Object.assign(document.createElement('p'), {
      className: 'adm-field__error',
      textContent: `[${iss.rule}] ${iss.message}`,
    }));
  }
}

function renderSingleFieldCard({ field, activeLocale, fieldIssues, canReview, draftMap, onSaveUpdates }) {
  const card = Object.assign(document.createElement('div'), { className: 'tr-field-card' });
  card.dataset.fieldPath = field.fieldPath;
  const textarea = Object.assign(document.createElement('textarea'), {
    className: 'adm-textarea',
    rows: Math.min(8, Math.max(3, Math.ceil((field.sourceText?.length || 20) / 36))),
    value: field.targetText || '',
    readOnly: !canReview,
    placeholder: canReview ? `请输入 ${activeLocale} 译文…` : '当前账号仅可只读查看译文',
  });
  draftMap.set(field.fieldPath, { textarea, initialText: field.targetText || '', reviewed: field.reviewed });

  card.appendChild(renderFieldHeadRow(field, fieldIssues, canReview, () =>
    onSaveUpdates([{ fieldPath: field.fieldPath, text: textarea.value, reviewed: !field.reviewed }]),
  ));
  appendFieldStaleAndLintBlocks(card, field, fieldIssues);

  const cols = Object.assign(document.createElement('div'), { className: 'tr-side-by-side' });
  const leftPane = Object.assign(document.createElement('div'), { className: 'tr-source-pane', textContent: field.sourceText });
  if (activeLocale !== 'en' && field.enReferenceText) {
    leftPane.appendChild(Object.assign(document.createElement('div'), {
      className: 'tr-en-ref',
      textContent: `EN 参考：${field.enReferenceText}`,
    }));
  }
  const rightWrap = Object.assign(document.createElement('div'), { className: 'adm-field' });
  rightWrap.appendChild(textarea);
  cols.append(leftPane, rightWrap);
  card.appendChild(cols);
  return card;
}

function wireDetailButtons({ aiBtn, lintBtn, markAllBtn, saveAllBtn, activeLocale, draftMap, onTranslateEntry, onRunLint, onSaveUpdates }) {
  const onError = (e) => showToast(e.message, 'error');
  bindAsyncButton(aiBtn, onTranslateEntry, { onError });
  bindAsyncButton(lintBtn, onRunLint, { onError });
  bindAsyncButton(markAllBtn, async () => {
    const updates = [...draftMap.entries()].map(([fieldPath, item]) => ({ fieldPath, text: item.textarea.value, reviewed: true }));
    await onSaveUpdates(updates, `完成 ${activeLocale} 全部字段人工审校`);
  }, { onError });
  bindAsyncButton(saveAllBtn, async () => {
    const updates = [...draftMap.entries()]
      .filter(([, item]) => item.textarea.value !== item.initialText)
      .map(([fieldPath, item]) => ({ fieldPath, text: item.textarea.value, reviewed: item.reviewed }));
    if (updates.length === 0) { showToast('当前未修改任何译文字段', 'info'); return; }
    await onSaveUpdates(updates, `更新 ${activeLocale} 译文（${updates.length} 个字段）`);
  }, { onError });
}

function renderDetailTopActions({
  detail, activeLocale, canReview, canTranslate, aiStatus, draftMap, onBack, onTranslateEntry, onRunLint, onSaveUpdates,
}) {
  const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  const left = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const backBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '← 返回翻译总览' });
  backBtn.addEventListener('click', onBack);
  left.append(backBtn, Object.assign(document.createElement('h2'), { textContent: `${detail.collection}/${detail.slug}` }));

  const right = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const aiAllowed = canTranslate && (Boolean(aiStatus?.configured) || activeLocale === 'zh-Hant');
  const aiBtn = Object.assign(document.createElement('button'), {
    type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: `一键 AI 翻译 (${activeLocale})`,
    disabled: !aiAllowed, title: !canTranslate ? '缺少 translations:translate 权限' : (aiStatus?.reason || '触发增量翻译任务'),
  });
  const lintBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '运行此条 Lint' });
  const markAllBtn = Object.assign(document.createElement('button'), {
    type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '本语言全部标记已审校',
    disabled: !canReview, title: canReview ? '将当前语言所有非空字段标记为已审校并提交 Git' : '需要 translations:review 权限',
  });
  const saveAllBtn = Object.assign(document.createElement('button'), {
    type: 'button', className: 'adm-btn adm-btn--primary adm-btn--sm', textContent: '保存译文并提交 Git',
    disabled: !canReview, title: canReview ? '保存修改后的译文并写入 Git 提交' : '需要 translations:review 权限',
  });
  wireDetailButtons({ aiBtn, lintBtn, markAllBtn, saveAllBtn, activeLocale, draftMap, onTranslateEntry, onRunLint, onSaveUpdates });
  right.append(aiBtn, lintBtn, markAllBtn, saveAllBtn);
  head.append(left, right);
  return head;
}

function renderStaleReconcileBanner(detail, canReview, onReconcile) {
  if (!detail.evaluation?.needsReconcile) return null;
  const alert = Object.assign(document.createElement('div'), { className: 'adm-alert adm-alert--warn adm-section-head' });
  alert.appendChild(Object.assign(document.createElement('span'), {
    textContent: '检测到源文变更导致审校状态发生自动回退（reviewed → machine），建议同步写回 YAML 与 sidecar。',
  }));
  if (canReview) {
    const syncBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '同步过期状态并提交 Git' });
    bindAsyncButton(syncBtn, onReconcile, { onError: (e) => showToast(e.message, 'error') });
    alert.appendChild(syncBtn);
  }
  return alert;
}

function createDetailSaveHandler(detail, activeLocale, refreshShell, onReloadDetail) {
  return async (updates, message = '') => {
    const res = await adminApi.put(`/translations/entries/${detail.collection}/${detail.slug}`, {
      siteId: detail.siteId, locale: activeLocale, updates, message,
    });
    const nextSt = res.effectiveTranslations?.[activeLocale] || 'machine';
    showToast(`已提交 Git (${res.commitHash.slice(0, 8)}) · ${activeLocale} 状态：${STATE_LABELS[nextSt] || nextSt}`, 'success');
    await refreshShell();
    await onReloadDetail(activeLocale, '');
  };
}

export function renderDetailScreen(host, ctx) {
  const { detail, activeLocale, focusFieldPath, canReview, canTranslate, aiStatus, onBack, onSwitchLocale, onReloadDetail, refreshShell } = ctx;
  host.innerHTML = '';
  const draftMap = new Map();
  const localeEval = detail.evaluation?.locales?.[activeLocale];
  const allLintIssues = detail.lintIssues || [];
  const saveUpdates = createDetailSaveHandler(detail, activeLocale, refreshShell, onReloadDetail);

  host.appendChild(renderDetailTopActions({
    detail, activeLocale, canReview, canTranslate, aiStatus, draftMap, onBack,
    onTranslateEntry: () => ctx.onTranslateScope({ collections: [detail.collection], slugs: [detail.slug], targetLocales: [activeLocale] }),
    onRunLint: async () => {
      const lintRes = await adminApi.get(`/translations/lint?siteId=${encodeURIComponent(detail.siteId)}&collection=${encodeURIComponent(detail.collection)}&slug=${encodeURIComponent(detail.slug)}`);
      detail.lintIssues = lintRes.issues || [];
      renderDetailScreen(host, { ...ctx, focusFieldPath: detail.lintIssues[0]?.fieldPath || '' });
    },
    onSaveUpdates: saveUpdates,
  }));

  const staleBanner = renderStaleReconcileBanner(detail, canReview, async () => {
    const r = await adminApi.post('/translations/reconcile', { siteId: detail.siteId, collection: detail.collection, slug: detail.slug });
    showToast(r.commitHash ? `已同步回退状态 (${r.commitHash.slice(0, 8)})` : '状态已是最新', 'success');
    await refreshShell();
    await onReloadDetail(activeLocale, '');
  });
  if (staleBanner) host.appendChild(staleBanner);
  host.appendChild(buildDetailLocaleTabs(detail.evaluation, activeLocale, onSwitchLocale));

  if (allLintIssues.length > 0) {
    host.appendChild(renderLintIssuesPanel(
      { filesScanned: 1, issues: allLintIssues },
      (_col, _slug, loc, fp) => (loc && loc !== activeLocale ? onSwitchLocale(loc, fp) : focusFieldInDetail(host, fp)),
    ));
  }
  for (const field of localeEval?.fields || []) {
    const fieldIssues = allLintIssues.filter((i) => i.fieldPath === field.fieldPath && (!i.locale || i.locale === activeLocale));
    host.appendChild(renderSingleFieldCard({ field, activeLocale, fieldIssues, canReview, draftMap, onSaveUpdates: saveUpdates }));
  }
  if (focusFieldPath) window.requestAnimationFrame(() => focusFieldInDetail(host, focusFieldPath));
}
