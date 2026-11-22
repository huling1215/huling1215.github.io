import { renderDataTable } from '/ui/kit/index.js';
import { createSectionCard } from './controls.js';

function createStatusBadge(status, labelText) {
  const variant = status === 'configured'
    ? 'adm-badge--reviewed'
    : status === 'invalid'
      ? 'adm-badge--missing'
      : '';
  const style = status === 'unconfigured' ? 'background:#fff8eb;color:#854d0e;' : '';
  return Object.assign(document.createElement('span'), {
    className: `adm-badge ${variant}`.trim(),
    textContent: labelText || (status === 'configured' ? '已配置' : status === 'invalid' ? '格式错误' : '未配置'),
    style,
  });
}

function createAnchorTag(docAnchor) {
  const code = Object.assign(document.createElement('code'), {
    textContent: docAnchor || 'docs/INTEGRATIONS.md',
    style: 'font-size:12px;background:#f4f5f8;padding:2px 6px;border-radius:4px;color:var(--adm-primary);',
  });
  return code;
}

function buildSummaryPills(integrations) {
  const bar = Object.assign(document.createElement('div'), { className: 'adm-inline-actions', style: 'margin-bottom:14px;' });
  const stats = [
    [`已配置 ${integrations?.configuredCount ?? 0} 项`, 'background:#d1fae5;color:#065f46;'],
    [`未配置 ${integrations?.unconfiguredCount ?? 0} 项`, 'background:#fff8eb;color:#854d0e;'],
    [`格式错误 ${integrations?.invalidCount ?? 0} 项`, 'background:#fee2e2;color:#991b1b;'],
  ];
  for (const [text, style] of stats) {
    bar.appendChild(Object.assign(document.createElement('span'), {
      className: 'adm-badge',
      textContent: text,
      style: `${style}padding:4px 10px;font-size:12px;font-weight:600;`,
    }));
  }
  return bar;
}

export function renderEnvSecretStatusPanel(hostEl, integrations, envVars) {
  hostEl.innerHTML = '';
  const alertEl = Object.assign(document.createElement('div'), {
    className: 'adm-alert adm-alert--warn',
    textContent: '安全说明：任何 API Key、Secret、Token 均只保存在服务器环境变量中；后台仅只读展示「已配置 / 未配置 / 格式错误」状态，不提供密钥输入框，也不回传任何密钥明文。',
  });

  const modSec = createSectionCard('外部集成模块自检总览', '与命令行 npm run integrations:check 实时同源核验。');
  modSec.body.appendChild(buildSummaryPills(integrations));
  const modTableHost = document.createElement('div');
  renderDataTable(modTableHost, {
    rows: integrations?.items || [],
    pageSize: 20,
    columns: [
      { key: 'name', label: '集成模块' },
      { key: 'statusLabel', label: '当前状态', render: (r) => createStatusBadge(r.status, r.statusLabel) },
      { key: 'detail', label: '检查说明' },
      { key: 'docAnchor', label: '配置指南章节', sortable: false, render: (r) => createAnchorTag(r.docAnchor) },
    ],
  });
  modSec.body.appendChild(modTableHost);

  const envSec = createSectionCard('服务器环境变量逐项状态（只读）', '如需修改密钥，请由运维在服务器 .env 或部署平台加密环境变量中更新并重启进程。');
  const envTableHost = document.createElement('div');
  renderDataTable(envTableHost, {
    rows: envVars || [],
    pageSize: 25,
    columns: [
      { key: 'group', label: '所属分组' },
      { key: 'key', label: '环境变量名', render: (r) => Object.assign(document.createElement('code'), { textContent: r.key }) },
      { key: 'label', label: '用途' },
      { key: 'statusLabel', label: '状态', render: (r) => createStatusBadge(r.status, r.statusLabel) },
      { key: 'detail', label: '诊断结果' },
      { key: 'docAnchor', label: '文档位置', sortable: false, render: (r) => createAnchorTag(r.docAnchor) },
    ],
  });
  envSec.body.appendChild(envTableHost);
  hostEl.append(alertEl, modSec.card, envSec.card);
}

export function renderSettingsHistoryPanel(hostEl, history, relPath) {
  hostEl.innerHTML = '';
  const { card, body } = createSectionCard(`配置文件 Git 提交历史（${relPath}）`, '每次在后台保存站点设置均自动生成一次 Git 提交，记录操作人与时间。');
  if (!Array.isArray(history) || history.length === 0) {
    body.appendChild(Object.assign(document.createElement('p'), { className: 'adm-muted', textContent: '当前站点配置文件暂无历史提交记录。' }));
    hostEl.appendChild(card);
    return;
  }
  const tableHost = document.createElement('div');
  renderDataTable(tableHost, {
    rows: history,
    pageSize: 15,
    columns: [
      { key: 'commit', label: '提交号', render: (r) => Object.assign(document.createElement('code'), { textContent: String(r.commit || '').slice(0, 8) }) },
      { key: 'authorName', label: '提交人' },
      { key: 'date', label: '提交时间', render: (r) => String(r.date || '').slice(0, 19).replace('T', ' ') },
      { key: 'subject', label: '提交摘要' },
    ],
  });
  body.appendChild(tableHost);
  hostEl.appendChild(card);
}
