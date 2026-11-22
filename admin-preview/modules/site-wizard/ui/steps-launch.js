import { adminApi, bindAsyncButton, html, showToast } from '/ui/kit/index.js';

function attachSseStream(jobId, logPre, statusSpan, finish) {
  const es = new EventSource(`/api/admin/jobs/${encodeURIComponent(jobId)}/stream`);
  es.addEventListener('init', (e) => {
    const snap = JSON.parse(e.data);
    logPre.textContent = (snap.logs || []).join('\n');
    if (snap.status === 'succeeded' || snap.status === 'failed') finish(snap, es);
  });
  es.addEventListener('log', (e) => {
    const { line } = JSON.parse(e.data);
    logPre.textContent += `${logPre.textContent ? '\n' : ''}${line}`;
    logPre.scrollTop = logPre.scrollHeight;
  });
  es.addEventListener('status', (e) => {
    const snap = JSON.parse(e.data);
    statusSpan.textContent = `状态：${snap.status}`;
    if (snap.status === 'succeeded' || snap.status === 'failed') finish(snap, es);
  });
}

function streamOrPollJob(jobId, logPre, statusSpan, onFinished) {
  let closed = false;
  const finish = (jobSnap, es) => {
    if (closed) return;
    closed = true;
    if (es) es.close();
    statusSpan.className = jobSnap.status === 'succeeded' ? 'wz-pill-ok' : 'wz-pill-warn';
    statusSpan.textContent = jobSnap.status === 'succeeded' ? '流水线全部完成' : `执行失败：${jobSnap.error || '请查看下方日志'}`;
    if (typeof onFinished === 'function') onFinished(jobSnap);
  };

  if (typeof window.EventSource === 'function') {
    attachSseStream(jobId, logPre, statusSpan, finish);
    return;
  }
  const timer = window.setInterval(async () => {
    try {
      const res = await adminApi.get(`/jobs/${encodeURIComponent(jobId)}`);
      logPre.textContent = (res.job.logs || []).join('\n');
      if (res.job.status === 'succeeded' || res.job.status === 'failed') {
        window.clearInterval(timer);
        finish(res.job, null);
      }
    } catch {
      window.clearInterval(timer);
    }
  }, 1000);
}

function buildStep6SummaryHtml(draft) {
  const s1 = draft.step1 || {};
  const s2 = draft.step2 || {};
  const s3 = draft.step3 || {};
  const s4 = draft.step4 || {};
  const briefCount = draft.step5?.briefs?.length || 0;
  const isPath = s1.deployMode === 'path';
  const origin = String(s1.url || '').trim().replace(/\/+$/, '') || `https://${s1.siteId || 'new-site'}.example.com`;
  const bp = isPath ? (s1.basePath || `/${s1.siteId || 'new-site'}/`) : '/';
  const modeDesc = isPath ? `共用域名（${origin}${bp}）` : `独立域名（${origin}/）`;
  return html`
    <div class="wz-grid-2">
      <div><strong>站点标识：</strong>${s1.siteId || '（未填）'} · <strong>品牌名：</strong>${s1.brandName?.['zh-CN'] || '（未填）'} / ${s1.brandName?.en || ''}</div>
      <div><strong>部署方式：</strong>${modeDesc}</div>
      <div><strong>业务品类：</strong>${s2.vertical || 'ski'} · <strong>默认语言：</strong>${s2.defaultLocale || 'zh-CN'}（共 ${(s2.locales || []).length} 语种）</div>
      <div><strong>主题配色：</strong>主色 ${s3.primary} / 强调色 ${s3.accent} · <strong>起始配置：</strong>${s4.templateMode === 'blank' ? '空白起始' : `复制自 ${s4.templateSiteId || 'powderclub'}`} · <strong>选题：</strong>${briefCount} 条</div>
    </div>`;
}

function bindExecuteWizardButton(runBtn, state, logPre, statusSpan) {
  bindAsyncButton(
    runBtn,
    async () => {
      const res = await adminApi.post('/site-wizard/execute', { draftId: state.draft.draftId, draft: state.draft });
      state.draft = res.draft;
      statusSpan.textContent = `已入队执行（提交 ${res.scaffoldCommitHash.slice(0, 8)}）`;
      logPre.textContent = '';
      showToast(`站点配置已提交 Git，任务 #${res.job.id.slice(0, 8)} 开始运行`, 'success');
      streamOrPollJob(res.job.id, logPre, statusSpan, async (doneJob) => {
        if (doneJob.status === 'succeeded') {
          await state.shellCtx.refreshShell();
          showToast('新站初始化流水线执行成功！可进入第 7 步查看上线待办清单', 'success');
        }
      });
    },
    { loadingLabel: '正在落盘并提交任务…', onError: (err) => showToast(err.message, 'error') },
  );
}

export function renderStep6(host, state) {
  const card = Object.assign(document.createElement('div'), { className: 'wz-card adm-form' });
  card.appendChild(Object.assign(document.createElement('h3'), { textContent: '第 6 步：落盘配置提交 Git 并执行一键初始化 (site:bootstrap)' }));

  const summaryDiv = document.createElement('div');
  summaryDiv.innerHTML = buildStep6SummaryHtml(state.draft);

  const briefCount = state.draft.step5?.briefs?.length || 0;
  const aiBlocked = briefCount > 0 && !state.meta.aiStatus?.configured;
  if (aiBlocked) {
    card.appendChild(Object.assign(document.createElement('div'), {
      className: 'adm-alert adm-alert--warn',
      textContent: `AI 引擎尚未就绪（${state.meta.aiStatus?.reason || '未配置 AI_PROVIDER'}）：您填写了 ${briefCount} 条选题，需配置 AI 环境变量后才能生成草稿，或返回第 5 步清空选题仅初始化骨架。`,
    }));
  }

  const runBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--primary',
    textContent: state.draft.scaffoldCommitHash ? '重新保存配置并执行初始化流水线' : '落盘站点配置并一键启动 site:bootstrap',
    disabled: aiBlocked,
    title: aiBlocked ? state.meta.aiStatus?.reason || '' : '',
  });
  const statusSpan = Object.assign(document.createElement('span'), { className: 'adm-muted', textContent: '等待启动' });
  const logPre = Object.assign(document.createElement('pre'), {
    className: 'adm-code',
    textContent: '点击上方按钮后，此处实时显示 site:new → content:generate → content:translate → content:lint-i18n → build → seo:audit 每一步进度日志…',
  });

  bindExecuteWizardButton(runBtn, state, logPre, statusSpan);
  if (state.draft.bootstrapJobId) streamOrPollJob(state.draft.bootstrapJobId, logPre, statusSpan, null);

  const actionRow = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  actionRow.append(runBtn, statusSpan);
  card.append(summaryDiv, actionRow, logPre);
  host.appendChild(card);
}

function renderEnvChecklistTable(envChecklist) {
  const wrap = Object.assign(document.createElement('div'), { className: 'adm-table-wrap' });
  const table = Object.assign(document.createElement('table'), { className: 'adm-table' });
  table.innerHTML = html`
    <thead>
      <tr><th>变量名（站点专属 / 全局回退）</th><th>范围</th><th>级别</th><th>当前状态</th><th>用途说明</th></tr>
    </thead>
    <tbody>
      ${envChecklist.map((item) => html`
        <tr>
          <td><code>${item.key}</code>${item.fallbackKey ? html`<div class="adm-muted">回退: <code>${item.fallbackKey}</code></div>` : ''}</td>
          <td>${item.scope === 'site' ? '站点级' : '全局'}</td>
          <td>${item.required ? '上线必填' : '可选'}</td>
          <td><span class="${item.status === 'configured' ? 'wz-pill-ok' : 'wz-pill-warn'}">${item.status === 'configured' ? `已配置 (${item.configuredVia})` : '缺失'}</span></td>
          <td><div>${item.label}</div><div class="adm-muted">${item.hint}</div></td>
        </tr>`)}
    </tbody>`;
  wrap.appendChild(table);
  return wrap;
}

function populateStep7Card(card, data, state) {
  const previewBox = Object.assign(document.createElement('div'), { className: 'wz-brief-card' });
  const modeLabel = data.preview.deployMode === 'path' ? `共用域名 (${data.preview.basePath})` : '独立域名 (/)';
  previewBox.innerHTML = html`
    <strong>本地预览与产物状态（${data.brandName?.['zh-CN'] || data.siteId}）</strong>
    <div class="adm-muted" style="margin-top:4px;">部署方式：<strong>${modeLabel}</strong> · 线上地址：<code>${data.preview.onlineUrl || ''}</code></div>
    <div class="adm-muted" style="margin-top:4px;">产物目录：<code>${data.preview.distDir}</code>（${data.preview.builtIndexExists ? '已生成静态首页 index.html' : '待执行构建'}） · 本地预览命令：<code>${data.preview.localPreviewCommand}</code></div>
    ${data.preview.buildRootCommand
      ? html`<div class="adm-muted" style="margin-top:4px;">共用域名根目录聚合命令：<code>${data.preview.buildRootCommand}</code></div>`
      : ''}`;

  const goReleaseBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--primary', textContent: '前往发布中心（A1）正式发布上线' });
  goReleaseBtn.addEventListener('click', () => state.shellCtx.navigate('release'));
  const btnWrap = Object.assign(document.createElement('div'), { className: 'adm-inline-actions', style: 'margin-top:10px;' });
  btnWrap.appendChild(goReleaseBtn);
  previewBox.appendChild(btnWrap);

  const extTitle = Object.assign(document.createElement('h4'), { textContent: `系统外上线待办事项（待处理 ${data.summary.pendingExternalTaskCount} 项）`, style: 'margin:8px 0 4px;' });
  const extGrid = Object.assign(document.createElement('div'), { className: 'wz-grid-2' });
  for (const task of data.externalTasks) {
    const item = Object.assign(document.createElement('div'), { className: 'wz-brief-card' });
    item.innerHTML = html`<div style="display:flex;justify-content:space-between;align-items:center;"><strong>${task.title}</strong><span class="${task.status === 'done' ? 'wz-pill-ok' : 'wz-pill-warn'}">${task.status === 'done' ? '已就绪' : '待办理'}</span></div><p class="adm-muted" style="margin:6px 0 0;">${task.detail}</p>`;
    extGrid.appendChild(item);
  }
  const envTitle = Object.assign(document.createElement('h4'), {
    textContent: `服务器环境变量核查清单（已配置 ${data.summary.configuredEnvCount} 项 · 缺少必填 ${data.summary.missingRequiredEnvCount} 项 · 零密钥明文）`,
    style: 'margin:8px 0 4px;',
  });
  card.append(previewBox, extTitle, extGrid, envTitle, renderEnvChecklistTable(data.envChecklist));
}

export async function renderStep7(host, state) {
  const card = Object.assign(document.createElement('div'), { className: 'wz-card adm-form' });
  card.appendChild(Object.assign(document.createElement('h3'), { textContent: '第 7 步：新站预览入口与上线待办清单' }));
  host.appendChild(card);

  const siteId = state.draft.step1?.siteId || '';
  if (!siteId) {
    card.appendChild(Object.assign(document.createElement('p'), { className: 'adm-field__error', textContent: '请先完成第 1–6 步创建站点后再查看上线待办清单。' }));
    return;
  }
  try {
    const data = await adminApi.get(`/site-wizard/checklist/${encodeURIComponent(siteId)}`);
    populateStep7Card(card, data, state);
  } catch (err) {
    card.appendChild(Object.assign(document.createElement('p'), { className: 'adm-field__error', textContent: `无法读取站点 "${siteId}" 清单：${err.message}（请先在第 6 步落盘站点配置）` }));
  }
}
