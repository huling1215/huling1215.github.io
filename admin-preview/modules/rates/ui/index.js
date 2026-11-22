import {
  adminApi,
  bindAsyncButton,
  confirmAction,
  renderDataTable,
  showToast,
} from '/ui/kit/index.js';
import {
  openOverrideEditorDialog,
  openRatesHistoryDialog,
  openRatesJobProgressDialog,
} from './dialogs.js';

function formatTimestampZh(raw) {
  if (!raw) return '-';
  return String(raw).replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

function renderSummaryBanner(host, overview) {
  host.innerHTML = '';
  const box = Object.assign(document.createElement('div'), {
    className: 'adm-table-wrap',
    style: 'padding: 14px 16px; margin-bottom: 14px; display: flex; flex-wrap: wrap; gap: 18px; align-items: center;',
  });
  const lockedList =
    overview.lockedCurrencies?.length > 0
      ? `已手动锁定：${overview.lockedCurrencies.join('、')}`
      : '无手动锁定币种（全部采用实时基准汇率）';

  const entries = [
    ['结算基准', 'CNY (¥1)'],
    ['实时快照更新时间', formatTimestampZh(overview.snapshotUpdatedAt)],
    ['数据来源', `${overview.source?.name || '-'} (${overview.source?.endpoint || ''})`],
    ['锁定状态', lockedList],
  ];
  for (const [label, val] of entries) {
    const cell = document.createElement('div');
    const lbl = Object.assign(document.createElement('div'), { className: 'adm-muted', textContent: label });
    const strong = Object.assign(document.createElement('strong'), { textContent: val });
    cell.append(lbl, strong);
    box.appendChild(cell);
  }
  host.appendChild(box);
}

function renderPreviewCalculator(host, items) {
  host.innerHTML = '';
  const bar = Object.assign(document.createElement('div'), {
    className: 'adm-table-wrap',
    style: 'padding: 10px 16px; margin-bottom: 14px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center;',
  });
  const label = Object.assign(document.createElement('span'), {
    className: 'adm-label',
    textContent: '前台换算预览（输入 CNY 金额）：',
  });
  const input = Object.assign(document.createElement('input'), {
    type: 'number',
    className: 'adm-input',
    style: 'width: 120px;',
    value: '1000',
    min: '0',
  });
  const resultSpan = Object.assign(document.createElement('span'), { className: 'adm-muted' });

  const updatePreview = () => {
    const amount = Number(input.value);
    if (!Number.isFinite(amount) || amount < 0) {
      resultSpan.textContent = '请输入有效非负金额';
      return;
    }
    const parts = items
      .filter((it) => !it.isBase)
      .map((it) => `${it.currency}: ≈ ${it.symbol}${Math.round(amount * it.effectiveRate).toLocaleString('zh-CN')}`);
    resultSpan.textContent = parts.join('  │  ');
  };

  input.addEventListener('input', updatePreview);
  updatePreview();
  bar.append(label, input, resultSpan);
  host.appendChild(bar);
}

function renderLockStatusBadge(row) {
  if (row.isBase) {
    return Object.assign(document.createElement('span'), {
      className: 'adm-badge',
      textContent: '基准币种',
    });
  }
  return Object.assign(document.createElement('span'), {
    className: row.locked ? 'adm-badge adm-badge--stale' : 'adm-badge adm-badge--reviewed',
    textContent: row.locked ? '已手动锁定' : '未锁定（实时）',
  });
}

function renderSourceAndNoteCell(row) {
  const wrap = document.createElement('div');
  wrap.appendChild(Object.assign(document.createElement('div'), { textContent: row.sourceLabel }));
  if (row.note || row.updatedBy) {
    const subParts = [];
    if (row.note) subParts.push(`备注：${row.note}`);
    if (row.updatedBy) subParts.push(`操作人：${row.updatedBy}`);
    wrap.appendChild(
      Object.assign(document.createElement('div'), {
        className: 'adm-muted',
        textContent: subParts.join(' · '),
      }),
    );
  }
  return wrap;
}

function createClearOverrideButton(row, canWrite, reloadAll) {
  const clearBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--ghost adm-btn--sm',
    textContent: '恢复实时',
    disabled: !canWrite,
  });
  bindAsyncButton(
    clearBtn,
    async () => {
      const ok = await confirmAction({
        title: `恢复 ${row.currency} 实时汇率`,
        message: `确认清除 ${row.currency} 的手动覆盖配置并恢复采用 data/rates.json 实时汇率吗？`,
        confirmLabel: '确认恢复并提交 Git',
      });
      if (!ok) return;
      await adminApi.del(`/rates/overrides/${row.currency}`);
      showToast(`已清除 ${row.currency} 手动覆盖配置`, 'success');
      await reloadAll();
    },
    { onError: (err) => showToast(err.message || '清除覆盖失败', 'error') },
  );
  return clearBtn;
}

function renderRowActions(row, canWrite, reloadAll) {
  if (row.isBase) {
    return Object.assign(document.createElement('span'), { className: 'adm-muted', textContent: '固定基准' });
  }
  const wrap = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const editBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--outline adm-btn--sm',
    textContent: '设置固定汇率',
    disabled: !canWrite,
    title: canWrite ? '' : '当前账号缺少 rates:write 权限',
  });
  editBtn.addEventListener('click', () => openOverrideEditorDialog(row, { onSaved: reloadAll }));

  const toggleBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--outline adm-btn--sm',
    textContent: row.locked ? '解锁' : '锁定',
    disabled: !canWrite,
    title: canWrite ? '' : '当前账号缺少 rates:write 权限',
  });
  bindAsyncButton(
    toggleBtn,
    async () => {
      const res = await adminApi.put(`/rates/overrides/${row.currency}`, {
        rate: row.overrideRate ?? row.baseRate,
        locked: !row.locked,
        note: row.note || '',
      });
      showToast(`${row.currency} 已${res.override.locked ? '锁定' : '解锁'}（提交 ${res.commitHash.slice(0, 8)}）`, 'success');
      await reloadAll();
    },
    { onError: (err) => showToast(err.message || '切换锁定状态失败', 'error') },
  );
  wrap.append(editBtn, toggleBtn);
  if (row.hasOverride) wrap.appendChild(createClearOverrideButton(row, canWrite, reloadAll));
  return wrap;
}

function buildRatesTableColumns(canWrite, reloadAll) {
  return [
    {
      key: 'currency',
      label: '币种',
      render: (r) => `${r.currency} · ${r.label} (${r.symbol})`,
    },
    { key: 'baseRate', label: '实时基准汇率' },
    {
      key: 'effectiveRate',
      label: '前台生效汇率',
      render: (r) => (r.locked ? `${r.effectiveRate}（覆盖生效）` : String(r.effectiveRate)),
    },
    { key: 'locked', label: '锁定状态', render: renderLockStatusBadge },
    { key: 'sourceLabel', label: '数据来源与备注', render: renderSourceAndNoteCell },
    { key: 'updatedAt', label: '更新时间', render: (r) => formatTimestampZh(r.updatedAt) },
    {
      key: 'actions',
      label: '操作',
      sortable: false,
      render: (r) => renderRowActions(r, canWrite, reloadAll),
    },
  ];
}

function createSyncRatesButton(canWrite, reloadAll) {
  const syncBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--primary',
    textContent: '一键更新汇率',
    disabled: !canWrite,
    title: canWrite ? '拉取远程实时汇率（自动跳过已锁定币种）' : '当前账号缺少 rates:write 权限',
  });
  bindAsyncButton(
    syncBtn,
    async () => {
      const res = await adminApi.post('/rates/update', {});
      showToast(`已提交汇率更新任务 #${res.job.id.slice(0, 8)}`, 'info');
      openRatesJobProgressDialog(res.job.id, { onFinished: reloadAll });
    },
    {
      loadingLabel: '提交任务中…',
      onError: (err) => showToast(err.message || '提交更新汇率任务失败', 'error'),
    },
  );
  return syncBtn;
}

function createHeaderToolbar(canWrite, reloadAll) {
  const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  const title = Object.assign(document.createElement('h2'), { textContent: '汇率管理与手动锁定覆盖' });
  const actions = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });

  const historyBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--ghost',
    textContent: 'Git 变更历史',
  });
  bindAsyncButton(historyBtn, () => openRatesHistoryDialog(), {
    onError: (err) => showToast(err.message || '加载历史失败', 'error'),
  });

  const refreshBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--outline',
    textContent: '刷新列表',
  });
  bindAsyncButton(refreshBtn, reloadAll, {
    onError: (err) => showToast(err.message || '刷新失败', 'error'),
  });

  actions.append(historyBtn, refreshBtn, createSyncRatesButton(canWrite, reloadAll));
  head.append(title, actions);
  return head;
}

export async function mount(container, shellCtx) {
  container.innerHTML = '';
  const canWrite = Boolean(
    shellCtx.user?.roles?.includes('admin') ||
      shellCtx.user?.permissions?.includes('rates:write'),
  );
  const summaryHost = document.createElement('div');
  const previewHost = document.createElement('div');
  const tableHost = document.createElement('div');

  async function reloadAll() {
    const overview = await adminApi.get('/rates');
    renderSummaryBanner(summaryHost, overview);
    renderPreviewCalculator(previewHost, overview.items || []);
    renderDataTable(tableHost, {
      rows: overview.items || [],
      searchable: false,
      pageSize: 10,
      columns: buildRatesTableColumns(canWrite, reloadAll),
    });
    if (typeof shellCtx.refreshShell === 'function') {
      const me = await adminApi.get(`/auth/me?siteId=${encodeURIComponent(shellCtx.siteId)}`);
      const pendingNode = document.getElementById('admPendingCount');
      if (pendingNode && me?.pendingChanges) {
        pendingNode.textContent = String(me.pendingChanges.count ?? 0);
      }
    }
  }

  const head = createHeaderToolbar(canWrite, reloadAll);
  container.append(head, summaryHost, previewHost, tableHost);
  await reloadAll();
}
