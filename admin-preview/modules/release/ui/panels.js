import { html } from '/ui/kit/escape.js';
import { adminApi, openDialog, renderDiffView, showToast } from '/ui/kit/index.js';

const CHANGE_LABELS = {
  added: '新增',
  modified: '修改',
  deleted: '删除',
  renamed: '重命名',
};

const ROOT_BUILD_REMINDER =
  '如有新增或变更子路径站点，请重新生成共用域名根目录文件（npm run build:root）';

function bindModuleJumpLink(anchorEl, fixHref, shellCtx) {
  anchorEl.addEventListener('click', (evt) => {
    if (!fixHref || !fixHref.startsWith('#')) return;
    evt.preventDefault();
    const targetMod = fixHref.slice(1);
    if (typeof shellCtx?.navigate === 'function') shellCtx.navigate(targetMod);
    else window.location.hash = fixHref;
  });
}

export function renderDeployInfoBanner(host, deploy, latestRecord) {
  const mode = deploy?.mode === 'path' ? 'path' : 'domain';
  const basePath = deploy?.basePath || '/';
  const modeLabel = deploy?.label || (mode === 'path' ? `共用域名（${basePath}）` : '独立域名');
  const publicUrl = deploy?.publicUrl || '';
  const safeHref = /^https?:\/\//i.test(publicUrl) ? publicUrl : '';
  const notice =
    latestRecord?.result === 'succeeded' && latestRecord?.postReleaseNotice
      ? latestRecord.postReleaseNotice
      : mode === 'path'
        ? deploy?.rootBuildHint || ROOT_BUILD_REMINDER
        : '';

  host.innerHTML = html`
    <div class="adm-alert" style="margin-bottom: 12px;">
      <div>
        <strong>当前部署方式：</strong><span class="adm-badge">${modeLabel}</span>
        <span style="margin-left: 16px;"><strong>线上访问地址：</strong></span>
        ${safeHref
          ? html`<a href="${safeHref}" target="_blank" rel="noopener noreferrer"><code>${publicUrl}</code></a>`
          : html`<code>${publicUrl || '（待配置正式源地址）'}</code>`}
      </div>
      ${notice
        ? html`<div class="adm-alert adm-alert--warn" style="margin-top: 8px;">⚠️ ${notice}</div>`
        : ''}
    </div>
  `;
}

function createIssueRow(issue, shellCtx) {
  const row = Object.assign(document.createElement('div'), { className: 'adm-history-row' });
  const isBlocker = issue.severity === 'blocker';
  const badgeClass = isBlocker ? 'adm-badge adm-badge--missing' : 'adm-badge';
  const badgeLabel = isBlocker ? '阻断' : '警告';
  const detailText = issue.docPath ? `${issue.detail}（参考文档：${issue.docPath}）` : issue.detail;

  const left = document.createElement('div');
  left.innerHTML = html`
    <div><span class="${badgeClass}">${badgeLabel}</span> <strong>${issue.title}</strong></div>
    <div class="adm-muted">${detailText}</div>
  `;

  const link = Object.assign(document.createElement('a'), {
    href: issue.fixHref || '#settings',
    className: 'adm-btn adm-btn--outline adm-btn--sm',
    textContent: issue.fixLabel || '前往修复',
  });
  bindModuleJumpLink(link, issue.fixHref || '#settings', shellCtx);
  row.append(left, link);
  return row;
}

export function renderReadinessPanel(host, readiness, shellCtx) {
  host.replaceChildren();
  const summaryBar = Object.assign(document.createElement('div'), {
    className: `adm-alert ${readiness.ready ? '' : 'adm-alert--warn'}`,
  });
  const deployText = readiness.deployStatus?.target
    ? `部署目标：${readiness.deployStatus.target}`
    : '部署目标：未配置 DEPLOY_TARGET';
  summaryBar.innerHTML = readiness.ready
    ? html`✅ 上线就绪检查通过（正式条目 ${readiness.summary.totalPublished} 条，隐藏草稿 ${readiness.summary.totalDrafts} 条，${deployText}）`
    : html`⚠️ 存在 ${readiness.blockers.length} 项上线阻断问题、${readiness.warnings.length} 项警告（${deployText}）`;
  host.appendChild(summaryBar);

  const listWrap = Object.assign(document.createElement('div'), { className: 'adm-table-wrap' });
  listWrap.style.padding = '8px 16px';
  const allIssues = [...(readiness.blockers || []), ...(readiness.warnings || [])];
  if (allIssues.length === 0) {
    listWrap.appendChild(Object.assign(document.createElement('p'), { className: 'adm-muted', textContent: '当前站点无任何阻断项或警告项，可随时执行正式发布。' }));
  } else {
    for (const issue of allIssues) listWrap.appendChild(createIssueRow(issue, shellCtx));
  }
  host.appendChild(listWrap);
}

function appendCommitListSection(body, commits, direction) {
  const heading = Object.assign(document.createElement('h4'), {
    textContent: direction === 'rollback' ? `回滚撤回的提交（${commits.length}）` : `包含的提交记录（${commits.length}）`,
  });
  body.appendChild(heading);
  if (commits.length === 0) {
    body.appendChild(Object.assign(document.createElement('p'), { className: 'adm-muted', textContent: '无新增 Git 提交记录。' }));
    return;
  }
  for (const c of commits) {
    const item = Object.assign(document.createElement('div'), { className: 'adm-history-row' });
    item.innerHTML = html`<code>${c.commit.slice(0, 8)}</code> · ${c.authorName} · <span class="adm-muted">${c.date.slice(0, 19).replace('T', ' ')}</span> — ${c.subject}`;
    body.appendChild(item);
  }
}

function appendChangedEntriesSection(body, entries) {
  body.appendChild(Object.assign(document.createElement('h4'), { textContent: `改动的内容与配置条目（${entries.length}）` }));
  if (entries.length === 0) {
    body.appendChild(Object.assign(document.createElement('p'), { className: 'adm-muted', textContent: '未涉及 catalog 内容条目或 site.yaml 变更。' }));
    return;
  }
  const wrap = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  wrap.innerHTML = html`${entries.map(
    (e) => html`<span class="adm-badge">[${CHANGE_LABELS[e.changeType] || e.changeType}] ${e.collection}/${e.slug}</span>`,
  )}`;
  body.appendChild(wrap);
}

export async function openReleaseDiffDialog({ siteId, tag, prevTag, title }) {
  const qs = new URLSearchParams({ siteId, tag: tag || 'HEAD' });
  if (prevTag) qs.set('prevTag', prevTag);
  const diffData = await adminApi.get(`/release/diff?${qs.toString()}`);

  openDialog({
    title: title || `相比上次发布改了什么 · ${prevTag || '初始'} -> ${tag || 'HEAD'}`,
    renderBody: (body) => {
      appendCommitListSection(body, diffData.commits || [], diffData.direction);
      appendChangedEntriesSection(body, diffData.changedEntries || []);
      body.appendChild(Object.assign(document.createElement('h4'), { textContent: '代码与内容统一差异（Git Diff）' }));
      const diffHost = document.createElement('div');
      renderDiffView(diffHost, diffData.diffText || '');
      body.appendChild(diffHost);
    },
  });
}

export function openLiveJobDialog(job, onFinished) {
  openDialog({
    title: `${job.title} · 实时流水线日志`,
    renderBody: (body) => {
      const statusBanner = Object.assign(document.createElement('div'), {
        className: 'adm-alert',
        textContent: '任务正在串行队列中执行，请稍候…',
      });
      const rootHintBox = document.createElement('div');
      const pre = Object.assign(document.createElement('pre'), {
        className: 'adm-code',
        textContent: `${(job.logs || []).join('\n')}\n`,
      });
      body.append(statusBanner, rootHintBox, pre);

      const es = new EventSource(`/api/admin/jobs/${encodeURIComponent(job.id)}/stream`);
      es.addEventListener('log', (evt) => {
        const { line } = JSON.parse(evt.data);
        pre.textContent += `${line}\n`;
        pre.scrollTop = pre.scrollHeight;
      });
      es.addEventListener('status', async (evt) => {
        const snap = JSON.parse(evt.data);
        if (snap.status !== 'succeeded' && snap.status !== 'failed') return;
        es.close();
        const ok = snap.status === 'succeeded';
        statusBanner.className = `adm-alert ${ok ? '' : 'adm-alert--warn'}`;
        statusBanner.innerHTML = ok ? html`✅ 任务执行成功！` : html`❌ ${snap.error || '任务执行失败'}`;
        const postNotice = ok && snap.result?.postReleaseNotice ? snap.result.postReleaseNotice : '';
        rootHintBox.innerHTML = postNotice
          ? html`<div class="adm-alert adm-alert--warn" style="margin-top: 8px;">⚠️ ${postNotice}</div>`
          : html``;
        showToast(ok ? `${job.title}已完成` : (snap.error || '发布流水线中止'), ok ? 'success' : 'error');
        if (typeof onFinished === 'function') await onFinished(snap);
      });
      es.onerror = () => es.close();
    },
  });
}
