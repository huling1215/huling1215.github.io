import {
  adminApi,
  openDialog,
  renderForm,
  showToast,
} from '/ui/kit/index.js';

function validateRateInput(val) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) {
    return '请输入合法的数字汇率';
  }
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0) {
    return '固定汇率必须为大于 0 的有限正数';
  }
  return '';
}

function validateNoteInput(val) {
  if (typeof val === 'string' && val.length > 200) {
    return '备注长度不能超过 200 个字符';
  }
  return '';
}

function buildOverrideFormFields(row) {
  return [
    {
      name: 'rate',
      label: `固定汇率（1 CNY 兑换多少 ${row.currency}）`,
      type: 'number',
      required: true,
      placeholder: String(row.baseRate),
      validate: validateRateInput,
    },
    {
      name: 'locked',
      label: '手动锁定该汇率（更新实时汇率时跳过覆盖，前台立即生效）',
      type: 'checkbox',
    },
    {
      name: 'note',
      label: '调整备注（选填）',
      type: 'text',
      placeholder: '例如：2026 雪季套餐统一锁汇',
      validate: validateNoteInput,
    },
  ];
}

function renderOverrideDialogBody(body, row, closeDlg, onSaved) {
  const hint = Object.assign(document.createElement('p'), {
    className: 'adm-muted',
    textContent: `当前实时基准：1 CNY = ${row.baseRate} ${row.currency}。勾选“手动锁定”后，前台换算优先使用该固定汇率，且自动更新汇率时跳过 ${row.currency}。`,
  });
  const formHost = document.createElement('div');
  body.append(hint, formHost);
  renderForm(formHost, {
    submitLabel: '保存并提交 Git',
    initialValues: {
      rate: row.overrideRate ?? row.baseRate,
      locked: row.hasOverride ? Boolean(row.locked) : true,
      note: row.note || '',
    },
    fields: buildOverrideFormFields(row),
    onSubmit: async (vals) => {
      const res = await adminApi.put(`/rates/overrides/${row.currency}`, {
        rate: Number(vals.rate),
        locked: Boolean(vals.locked),
        note: vals.note || '',
      });
      showToast(`${row.currency} 汇率已保存（提交 ${res.commitHash.slice(0, 8)}）`, 'success');
      closeDlg();
      await onSaved();
    },
  });
}

export function openOverrideEditorDialog(row, { onSaved }) {
  const dlg = openDialog({
    title: `设置固定汇率 · ${row.currency}（${row.label}）`,
    cancelLabel: '关闭',
    renderBody: (body) => renderOverrideDialogBody(body, row, () => dlg.close(), onSaved),
  });
}

function attachJobSseListeners(es, pre, onFinished) {
  let finished = false;
  const markDone = async (status) => {
    if (finished) return;
    finished = true;
    es.close();
    if (status === 'succeeded') {
      showToast('实时汇率更新任务已完成', 'success');
    } else {
      showToast('实时汇率更新失败，请查看日志详情', 'error');
    }
    await onFinished();
  };

  es.addEventListener('init', (evt) => {
    const snap = JSON.parse(evt.data);
    pre.textContent = `${(snap.logs || []).join('\n')}\n`;
    if (snap.status === 'succeeded' || snap.status === 'failed') {
      markDone(snap.status);
    }
  });
  es.addEventListener('log', (evt) => {
    const { line } = JSON.parse(evt.data);
    pre.textContent += `${line}\n`;
    pre.scrollTop = pre.scrollHeight;
  });
  es.addEventListener('status', (evt) => {
    const snap = JSON.parse(evt.data);
    if (snap.status === 'succeeded' || snap.status === 'failed') {
      markDone(snap.status);
    }
  });
  es.onerror = () => es.close();
}

export function openRatesJobProgressDialog(jobId, { onFinished }) {
  openDialog({
    title: `更新实时汇率 · 任务 #${jobId.slice(0, 8)}`,
    cancelLabel: '关闭窗口',
    renderBody: (body) => {
      const pre = Object.assign(document.createElement('pre'), {
        className: 'adm-code',
        textContent: '正在连接任务队列日志流…\n',
      });
      body.appendChild(pre);
      const es = new EventSource(`/api/admin/jobs/${encodeURIComponent(jobId)}/stream`);
      attachJobSseListeners(es, pre, onFinished);
    },
  });
}

function appendCommitSection(container, headingText, commits) {
  const heading = Object.assign(document.createElement('h4'), {
    style: 'margin: 6px 0;',
    textContent: headingText,
  });
  container.appendChild(heading);
  if (!commits || commits.length === 0) {
    container.appendChild(
      Object.assign(document.createElement('p'), {
        className: 'adm-muted',
        textContent: '暂无 Git 提交记录。',
      }),
    );
    return;
  }
  for (const c of commits) {
    const row = Object.assign(document.createElement('div'), { className: 'adm-history-row' });
    const left = document.createElement('div');
    const meta = Object.assign(document.createElement('div'), {
      textContent: `${c.commit.slice(0, 8)} · ${c.authorName} · ${c.date.slice(0, 19).replace('T', ' ')}`,
    });
    meta.style.fontWeight = '600';
    const subj = Object.assign(document.createElement('div'), {
      className: 'adm-muted',
      textContent: c.subject,
    });
    left.append(meta, subj);
    row.appendChild(left);
    container.appendChild(row);
  }
}

export async function openRatesHistoryDialog() {
  const data = await adminApi.get('/rates/history');
  openDialog({
    title: '汇率配置与快照 Git 变更记录',
    cancelLabel: '关闭',
    renderBody: (body) => {
      appendCommitSection(body, '手动锁定覆盖记录（data/rates-overrides.json）', data.overridesHistory);
      appendCommitSection(body, '实时汇率快照记录（data/rates.json）', data.snapshotHistory);
    },
  });
}
