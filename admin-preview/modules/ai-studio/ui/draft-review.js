import {
  adminApi,
  bindAsyncButton,
  confirmAction,
  createI18nEditor,
  openDialog,
  renderDataTable,
  showToast,
} from '/ui/kit/index.js';

function appendI18nField(container, labelText, currentObj, fieldKey, translations, multiline = false, rows = 3) {
  const block = Object.assign(document.createElement('div'), { className: 'adm-field' });
  block.appendChild(Object.assign(document.createElement('label'), { className: 'adm-label', textContent: labelText }));
  const ed = createI18nEditor({
    value: currentObj[fieldKey] || {},
    translations,
    multiline,
    rows,
    onChange: (nextVal) => { currentObj[fieldKey] = nextVal; },
  });
  block.appendChild(ed.el);
  container.appendChild(block);
}

function renderSectionsI18nBlocks(container, dataCopy, translations) {
  if (!Array.isArray(dataCopy.sections) || dataCopy.sections.length === 0) return;
  const wrap = Object.assign(document.createElement('div'), { className: 'adm-ai-sublist' });
  wrap.appendChild(Object.assign(document.createElement('h4'), { textContent: `正文小节（${dataCopy.sections.length} 节）` }));
  dataCopy.sections.forEach((sec, idx) => {
    const box = Object.assign(document.createElement('div'), { className: 'adm-ai-box' });
    appendI18nField(box, `第 ${idx + 1} 节 · 小标题`, sec, 'heading', translations, false);
    appendI18nField(box, `第 ${idx + 1} 节 · 正文`, sec, 'body', translations, true, 5);
    if (Array.isArray(sec.bullets)) {
      sec.bullets.forEach((_, bIdx) => {
        const proxy = { item: sec.bullets[bIdx] };
        const row = Object.assign(document.createElement('div'), { className: 'adm-field' });
        row.appendChild(Object.assign(document.createElement('label'), { className: 'adm-label', textContent: `要点 ${bIdx + 1}` }));
        const ed = createI18nEditor({
          value: proxy.item || {},
          translations,
          onChange: (v) => { sec.bullets[bIdx] = v; },
        });
        row.appendChild(ed.el);
        box.appendChild(row);
      });
    }
    wrap.appendChild(box);
  });
  container.appendChild(wrap);
}

function renderHighlightsAndFaqBlocks(container, dataCopy, translations) {
  if (Array.isArray(dataCopy.highlights) && dataCopy.highlights.length > 0) {
    const hlWrap = Object.assign(document.createElement('div'), { className: 'adm-ai-sublist' });
    hlWrap.appendChild(Object.assign(document.createElement('h4'), { textContent: '核心亮点（highlights）' }));
    dataCopy.highlights.forEach((hl, idx) => {
      const box = Object.assign(document.createElement('div'), { className: 'adm-field' });
      box.appendChild(Object.assign(document.createElement('label'), { className: 'adm-label', textContent: `亮点 ${idx + 1}` }));
      const ed = createI18nEditor({ value: hl || {}, translations, onChange: (v) => { dataCopy.highlights[idx] = v; } });
      box.appendChild(ed.el);
      hlWrap.appendChild(box);
    });
    container.appendChild(hlWrap);
  }
  if (Array.isArray(dataCopy.faq) && dataCopy.faq.length > 0) {
    const faqWrap = Object.assign(document.createElement('div'), { className: 'adm-ai-sublist' });
    faqWrap.appendChild(Object.assign(document.createElement('h4'), { textContent: `常见问答 FAQ（${dataCopy.faq.length} 组）` }));
    dataCopy.faq.forEach((item, idx) => {
      const box = Object.assign(document.createElement('div'), { className: 'adm-ai-box' });
      appendI18nField(box, `问答 ${idx + 1} · 问题 (Q)`, item, 'q', translations, false);
      appendI18nField(box, `问答 ${idx + 1} · 回答 (A)`, item, 'a', translations, true, 3);
      faqWrap.appendChild(box);
    });
    container.appendChild(faqWrap);
  }
}

function buildDraftEditorColumn(dataCopy) {
  const col = Object.assign(document.createElement('div'), { className: 'adm-ai-editor-col' });
  const tr = dataCopy.translations || {};
  const titleKey = dataCopy.title ? 'title' : 'name';
  appendI18nField(col, titleKey === 'title' ? '多语言标题 (title)' : '多语言名称 (name)', dataCopy, titleKey, tr, false);
  if (dataCopy.regionName) appendI18nField(col, '区域显示名 (regionName)', dataCopy, 'regionName', tr, false);

  const summaryKey = dataCopy.directAnswer ? 'directAnswer' : 'summary';
  if (dataCopy[summaryKey]) {
    appendI18nField(col, summaryKey === 'directAnswer' ? '首段直答摘要 (directAnswer)' : '目的地概述 (summary)', dataCopy, summaryKey, tr, true, 3);
  }
  if (dataCopy.intro) appendI18nField(col, '区域导览介绍 (intro)', dataCopy, 'intro', tr, true, 4);
  if (dataCopy.familyNote) appendI18nField(col, '亲子说明 (familyNote)', dataCopy, 'familyNote', tr, true, 2);
  if (dataCopy.beginnerNote) appendI18nField(col, '新手说明 (beginnerNote)', dataCopy, 'beginnerNote', tr, true, 2);

  renderSectionsI18nBlocks(col, dataCopy, tr);
  renderHighlightsAndFaqBlocks(col, dataCopy, tr);
  return col;
}

function appendFactsKeyValueList(aside, requiredFacts) {
  const entries = Object.entries(requiredFacts || {});
  aside.appendChild(Object.assign(document.createElement('h4'), { textContent: '必引客观事实（requiredFacts）' }));
  if (entries.length === 0) {
    aside.appendChild(Object.assign(document.createElement('p'), { className: 'adm-muted', textContent: 'Brief 未额外指定键值事实。' }));
    return;
  }
  const dl = Object.assign(document.createElement('div'), { className: 'adm-ai-fact-table' });
  for (const [k, v] of entries) {
    const item = Object.assign(document.createElement('div'), { className: 'adm-ai-fact-item' });
    item.append(
      Object.assign(document.createElement('code'), { textContent: k }),
      Object.assign(document.createElement('span'), { textContent: Array.isArray(v) ? v.join('、') : String(v) }),
    );
    dl.appendChild(item);
  }
  aside.appendChild(dl);
}

function buildFactsComparisonSidebar(detail) {
  const aside = Object.assign(document.createElement('aside'), { className: 'adm-ai-facts-aside' });
  aside.appendChild(Object.assign(document.createElement('h3'), { textContent: '事实依据对照（Brief）' }));

  if (!detail.brief?.found) {
    aside.appendChild(Object.assign(document.createElement('p'), { className: 'adm-muted', textContent: '未找到同名 Brief 文件；退回重写时将自动生成对应 Brief 文件。' }));
  } else {
    const b = detail.brief.data;
    aside.appendChild(Object.assign(document.createElement('p'), { className: 'adm-muted', textContent: `来源文件：${detail.brief.relPath}` }));
    aside.appendChild(Object.assign(document.createElement('div'), { className: 'adm-ai-topic-pill', textContent: `选题：${b.topic}` }));
    aside.appendChild(Object.assign(document.createElement('h4'), { textContent: '待回答问题（questions）' }));
    const ol = document.createElement('ol');
    for (const q of b.questions || []) ol.appendChild(Object.assign(document.createElement('li'), { textContent: q }));
    aside.appendChild(ol);
    appendFactsKeyValueList(aside, b.requiredFacts);
  }

  if (detail.relatedResorts?.length) {
    aside.appendChild(Object.assign(document.createElement('h4'), { textContent: '关联目的地已核验参数' }));
    const ul = document.createElement('ul');
    for (const r of detail.relatedResorts) {
      const specs = [r.topM ? `山顶${r.topM}m` : '', r.verticalM ? `落差${r.verticalM}m` : '', r.runs ? `雪道${r.runs}条` : ''].filter(Boolean).join(' · ');
      ul.appendChild(Object.assign(document.createElement('li'), { textContent: `${r.name} (${r.slug})：${specs || r.country}` }));
    }
    aside.appendChild(ul);
  }

  if (detail.brief?.revisionNotes?.length) {
    aside.appendChild(Object.assign(document.createElement('h4'), { textContent: '历次退回修改说明' }));
    const revUl = document.createElement('ul');
    for (const note of detail.brief.revisionNotes) revUl.appendChild(Object.assign(document.createElement('li'), { textContent: note }));
    aside.appendChild(revUl);
  }
  return aside;
}

function openRejectRewriteDialog({ siteId, collection, slug, onDone }) {
  const noteInput = Object.assign(document.createElement('textarea'), {
    className: 'adm-textarea',
    rows: 4,
    placeholder: '请填写具体修改意见（如：补充夜场接驳末班车时刻与雪镜透光率建议）…',
  });
  openDialog({
    title: `退回重写 · ${collection}/${slug}`,
    confirmLabel: '写入 Brief 并提交重写',
    renderBody: (body) => {
      body.append(
        Object.assign(document.createElement('p'), { className: 'adm-muted', textContent: '修改意见将追加至 sites/<siteId>/briefs/<slug>.yaml 并提交 Git；若已配置 AI 将自动触发重新生成任务。' }),
        noteInput,
      );
    },
    onConfirm: async () => {
      const revisionNote = noteInput.value.trim();
      if (revisionNote.length < 2) throw new Error('请填写至少 2 个字符的修改意见');
      const res = await adminApi.post(`/ai-studio/drafts/${collection}/${slug}/reject`, { siteId, revisionNote });
      const suffix = res.regenerated ? `，已提交重写任务 #${res.job.id.slice(0, 8)}` : '（当前未配置 AI，仅保存退回说明）';
      showToast(`已退回并记录修改意见${suffix}`, 'success');
      await onDone();
    },
  });
}

function bindApproveRejectDeleteButtons({ approveBtn, rejectBtn, delBtn, siteId, collection, slug, dataCopy, shellCtx, onClose, onReload }) {
  bindAsyncButton(approveBtn, async () => {
    const res = await adminApi.post(`/ai-studio/drafts/${collection}/${slug}/approve`, { siteId, data: dataCopy });
    showToast(`已审核通过并设为上线（提交 ${res.commitHash.slice(0, 8)}）`, 'success');
    await shellCtx.refreshShell();
    onClose();
    await onReload();
  }, { onError: (e) => showToast(e.message, 'error') });

  rejectBtn.addEventListener('click', () => {
    if (rejectBtn.disabled) return;
    openRejectRewriteDialog({ siteId, collection, slug, onDone: async () => { await shellCtx.refreshShell(); onClose(); await onReload(); } });
  });

  bindAsyncButton(delBtn, async () => {
    const ok = await confirmAction({
      title: '确认删除 AI 草稿',
      message: `即将从仓库删除草稿 ${collection}/${slug}.yaml 并生成一次 Git 提交，是否继续？`,
      confirmLabel: '确认永久删除',
      danger: true,
    });
    if (!ok) return;
    const res = await adminApi.del(`/ai-studio/drafts/${collection}/${slug}`, { siteId, confirmDelete: true });
    showToast(`草稿已删除（提交 ${res.commitHash.slice(0, 8)}）`, 'success');
    await shellCtx.refreshShell();
    onClose();
    await onReload();
  }, { onError: (e) => showToast(e.message, 'error') });
}

function buildReviewActionBar({ detail, dataCopy, shellCtx, onClose, onReload }) {
  const { siteId, collection, slug } = detail.entry;
  const canEdit = Boolean(shellCtx.user?.permissions?.includes('ai:generate'));
  const canApprove = Boolean(shellCtx.user?.permissions?.includes('ai:approve'));
  const denyTip = '需要审核员（reviewer）或管理员（admin）的 ai:approve 权限';

  const bar = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const backBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--ghost', textContent: '← 返回草稿列表' });
  const saveBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline', textContent: '保存草稿修改', disabled: !canEdit });
  const approveBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--primary', textContent: '通过并上线', disabled: !canApprove, title: canApprove ? '' : denyTip });
  const rejectBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline', textContent: '退回重写', disabled: !canApprove, title: canApprove ? '' : denyTip });
  const delBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--danger', textContent: '删除草稿', disabled: !canApprove, title: canApprove ? '' : denyTip });

  backBtn.addEventListener('click', onClose);
  bindAsyncButton(saveBtn, async () => {
    const res = await adminApi.put(`/ai-studio/drafts/${collection}/${slug}`, { siteId, data: dataCopy });
    showToast(`草稿已保存（提交 ${res.commitHash.slice(0, 8)}）`, 'success');
    await shellCtx.refreshShell();
    await onReload();
  }, { onError: (e) => showToast(e.message, 'error') });

  bindApproveRejectDeleteButtons({ approveBtn, rejectBtn, delBtn, siteId, collection, slug, dataCopy, shellCtx, onClose, onReload });
  bar.append(backBtn, saveBtn, approveBtn, rejectBtn, delBtn);
  return bar;
}

function renderSingleDraftWorkspace(workspaceHost, detail, shellCtx, onClose, onReload) {
  workspaceHost.innerHTML = '';
  const dataCopy = structuredClone(detail.entry.data || {});
  const card = Object.assign(document.createElement('section'), { className: 'adm-ai-card' });
  const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  head.append(
    Object.assign(document.createElement('h3'), { textContent: `审校 AI 草稿 · ${detail.entry.collection}/${detail.entry.slug}` }),
    buildReviewActionBar({ detail, dataCopy, shellCtx, onClose, onReload }),
  );
  const split = Object.assign(document.createElement('div'), { className: 'adm-ai-review-split' });
  split.append(buildDraftEditorColumn(dataCopy), buildFactsComparisonSidebar(detail));
  card.append(head, split);
  workspaceHost.appendChild(card);
}

export function renderDraftReviewPanel(host, { overview, shellCtx, onReload }) {
  host.innerHTML = '';
  const listWrap = Object.assign(document.createElement('section'), { className: 'adm-ai-card' });
  const workspaceWrap = document.createElement('div');
  listWrap.appendChild(Object.assign(document.createElement('h3'), { textContent: `待审 AI 草稿队列（${overview.drafts.length}）` }));
  const tableHost = document.createElement('div');
  listWrap.appendChild(tableHost);

  renderDataTable(tableHost, {
    rows: overview.drafts || [],
    filterPlaceholder: '按草稿 slug、中文标题或集合筛选…',
    columns: [
      { key: 'collection', label: '集合' },
      { key: 'slug', label: 'Slug' },
      { key: 'titleZh', label: '中文标题' },
      { key: 'briefTopic', label: '关联选题', render: (r) => r.briefTopic || '-' },
      { key: 'revisionCount', label: '退回次数', render: (r) => (r.revisionCount > 0 ? `${r.revisionCount} 次` : '首次生成') },
      { key: 'updatedAt', label: '更新日期' },
      {
        key: 'actions',
        label: '操作',
        sortable: false,
        render: (r) => {
          const openBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--primary adm-btn--sm', textContent: '打开审校' });
          bindAsyncButton(openBtn, async () => {
            const detail = await adminApi.get(`/ai-studio/drafts/${r.collection}/${r.slug}?siteId=${encodeURIComponent(overview.siteId)}`);
            listWrap.hidden = true;
            renderSingleDraftWorkspace(workspaceWrap, detail, shellCtx, () => { workspaceWrap.innerHTML = ''; listWrap.hidden = false; }, onReload);
          }, { onError: (e) => showToast(e.message, 'error') });
          return openBtn;
        },
      },
    ],
  });
  host.append(listWrap, workspaceWrap);
}
