import { adminApi, bindAsyncButton, openDialog, showToast } from '../../../ui/kit/index.js';
import { installMediaPickerProvider } from './picker.js';
import { ensureMediaStyles } from './styles.js';
import { MEDIA_COLLECTION_LABELS, openMediaUploadDialog } from './upload-dialog.js';

installMediaPickerProvider();

function hasMediaWrite(shellCtx) {
  const perms = shellCtx.user?.permissions || [];
  return shellCtx.user?.roles?.includes('admin') || perms.includes('media:write');
}

function openOriginalPreviewDialog(item) {
  openDialog({
    title: `图片详情 · ${item.collection}/${item.slug}/${item.filename}`,
    cancelLabel: '关闭窗口',
    renderBody: (body) => {
      const img = Object.assign(document.createElement('img'), {
        src: item.rawUrl,
        alt: item.relativeAssetPath,
        style: 'max-width:100%;max-height:58vh;object-fit:contain;border-radius:6px;background:#141622;',
      });
      const lic = item.meta?.license || '未登记授权信息';
      const src = item.meta?.sourceUrl || '未记录来源';
      const author = item.meta?.author ? ` · 作者：${item.meta.author}` : '';
      const detail = Object.assign(document.createElement('div'), {
        className: 'adm-muted',
        textContent: `路径：${item.relativeAssetPath} ｜ 尺寸：${item.width}×${item.height}px ｜ 授权：${lic}${author} ｜ 来源：${src}`,
      });
      body.append(img, detail);
    },
  });
}

function renderAiProgressPanel(hostEl, aiProgress, canWrite, onPickRemaining) {
  hostEl.innerHTML = '';
  const p = aiProgress || { total: 0, replaced: 0, remaining: 0, percent: 100, draftAiRemaining: 0, remainingItems: [] };
  const top = Object.assign(document.createElement('div'), { className: 'adm-media-progress__top' });
  const title = Object.assign(document.createElement('strong'), {
    textContent: `AI 图替换进度：共 ${p.total} 张 · 已替换 ${p.replaced} 张 / 剩余 ${p.remaining} 张（${p.percent}%）`,
  });
  const sub = Object.assign(document.createElement('span'), {
    className: 'adm-muted',
    textContent: p.draftAiRemaining > 0
      ? `点击下方剩余项可直接上传实拍图替换（另含 ${p.draftAiRemaining} 张草稿产品图）`
      : p.remaining > 0 ? '点击下方任意剩余项可直接打开上传替换弹窗' : '当前站点正式页面 AI 示例图已全部替换完毕',
  });
  top.append(title, sub);

  const bar = Object.assign(document.createElement('div'), { className: 'adm-media-progress__bar' });
  const fill = Object.assign(document.createElement('div'), { className: 'adm-media-progress__fill' });
  fill.style.width = `${Math.min(100, Math.max(0, p.percent))}%`;
  bar.appendChild(fill);
  hostEl.append(top, bar);

  if (!p.remainingItems?.length) return;
  const chips = Object.assign(document.createElement('div'), { className: 'adm-media-ai-chips' });
  for (const rem of p.remainingItems) {
    const btn = Object.assign(document.createElement('button'), {
      type: 'button', className: 'adm-media-ai-chip', disabled: !canWrite,
      title: canWrite ? '点击立即上传实拍图替换此 AI 示例图' : '当前账号无 media:write 权限',
      textContent: `${rem.collection}/${rem.slug}/${rem.filename}`,
    });
    btn.addEventListener('click', () => onPickRemaining({ ...rem, isAiSample: true }));
    chips.appendChild(btn);
  }
  hostEl.appendChild(chips);
}

function buildCardThumbElement(item) {
  const thumb = Object.assign(document.createElement('div'), { className: 'adm-media-card__thumb' });
  const img = Object.assign(document.createElement('img'), {
    src: `${item.previewUrl}&t=${encodeURIComponent(item.meta?.ingestedAt || '')}`,
    alt: `${item.collection}/${item.slug}`,
    loading: 'lazy',
  });
  const badges = Object.assign(document.createElement('div'), { className: 'adm-media-card__badges' });
  badges.append(
    Object.assign(document.createElement('span'), {
      className: `adm-badge ${item.isAiSample ? 'adm-badge--stale' : 'adm-badge--reviewed'}`,
      textContent: item.isAiSample ? (item.isHiddenDraftEntity ? '草稿 AI 图' : '待替换 AI 图') : '实拍已授权',
    }),
    Object.assign(document.createElement('span'), {
      className: 'adm-badge', textContent: String(item.format || 'jpg').toUpperCase(),
    }),
  );
  thumb.append(img, badges);
  return thumb;
}

function createMediaCard(item, canWrite, onReplaceClick) {
  const card = Object.assign(document.createElement('div'), { className: 'adm-media-card' });
  const body = Object.assign(document.createElement('div'), { className: 'adm-media-card__body' });
  const licLabel = item.meta?.license ? `授权：${item.meta.license}` : '授权：未填写 .meta.json';
  const srcLabel = item.meta?.author ? `作者：${item.meta.author}` : item.meta?.sourceUrl ? `来源：${item.meta.sourceUrl}` : '来源：预置图';
  body.append(
    Object.assign(document.createElement('div'), { className: 'adm-media-card__title', textContent: `${item.collection} / ${item.slug} / ${item.filename}` }),
    Object.assign(document.createElement('div'), { className: 'adm-media-card__meta', textContent: `像素尺寸：${item.width} × ${item.height} px` }),
    Object.assign(document.createElement('div'), { className: 'adm-media-card__meta', textContent: `${licLabel} · ${srcLabel}` }),
  );

  const foot = Object.assign(document.createElement('div'), { className: 'adm-media-card__foot' });
  const viewBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '预览原图' });
  const repBtn = Object.assign(document.createElement('button'), {
    type: 'button', disabled: !canWrite,
    className: `adm-btn ${item.isAiSample ? 'adm-btn--primary' : 'adm-btn--outline'} adm-btn--sm`,
    textContent: item.isAiSample ? '上传替换 AI 图' : '重新上传',
  });
  viewBtn.addEventListener('click', () => openOriginalPreviewDialog(item));
  repBtn.addEventListener('click', () => onReplaceClick(item));
  foot.append(viewBtn, repBtn);
  card.append(buildCardThumbElement(item), body, foot);
  return card;
}

function renderMediaCardsGrid(gridEl, items, canWrite, onReplaceClick) {
  gridEl.innerHTML = '';
  if (!items.length) {
    gridEl.appendChild(Object.assign(document.createElement('p'), {
      className: 'adm-muted', textContent: '当前筛选条件下没有匹配的图片文件。',
    }));
    return;
  }
  for (const item of items) {
    gridEl.appendChild(createMediaCard(item, canWrite, onReplaceClick));
  }
}

function syncSlugFilterOptions(slugSel, items, currentSlug) {
  const slugs = Array.from(new Set(items.map((it) => it.slug))).sort((a, b) => a.localeCompare(b, 'en'));
  slugSel.innerHTML = '';
  slugSel.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: `全部条目（${slugs.length}）` }));
  for (const s of slugs) {
    slugSel.appendChild(Object.assign(document.createElement('option'), { value: s, textContent: s, selected: s === currentSlug }));
  }
}

function buildFilterToolbar(onFilterChange) {
  const bar = Object.assign(document.createElement('div'), { className: 'adm-filter-grid' });
  const colSel = Object.assign(document.createElement('select'), { className: 'adm-input' });
  colSel.appendChild(Object.assign(document.createElement('option'), { value: 'all', textContent: '全部集合' }));
  for (const opt of MEDIA_COLLECTION_LABELS) {
    colSel.appendChild(Object.assign(document.createElement('option'), { value: opt.value, textContent: opt.label }));
  }
  const slugSel = Object.assign(document.createElement('select'), { className: 'adm-input' });
  slugSel.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: '全部条目' }));

  const aiSel = Object.assign(document.createElement('select'), { className: 'adm-input' });
  aiSel.append(
    Object.assign(document.createElement('option'), { value: 'all', textContent: '全部图片状态' }),
    Object.assign(document.createElement('option'), { value: 'active-ai', textContent: '待替换正式 AI 图' }),
    Object.assign(document.createElement('option'), { value: 'ai', textContent: '全部 AI 图（含草稿）' }),
    Object.assign(document.createElement('option'), { value: 'real', textContent: '已授权实拍图' }),
  );
  const qIn = Object.assign(document.createElement('input'), {
    type: 'search', className: 'adm-input', placeholder: '搜索条目 slug / 文件名 / 授权说明…',
  });
  colSel.addEventListener('change', () => { slugSel.value = ''; onFilterChange(); });
  slugSel.addEventListener('change', onFilterChange);
  aiSel.addEventListener('change', onFilterChange);
  qIn.addEventListener('input', onFilterChange);
  bar.append(colSel, slugSel, aiSel, qIn);
  return { bar, colSel, slugSel, aiSel, qIn };
}

function buildMediaSectionHeader(siteId, canWrite) {
  const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  const title = Object.assign(document.createElement('h2'), { textContent: `媒体库与 AI 图替换 · ${siteId}` });
  const actions = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const refreshBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline', textContent: '刷新列表' });
  const uploadBtn = Object.assign(document.createElement('button'), {
    type: 'button', className: 'adm-btn adm-btn--primary', textContent: '上传 / URL 导入图片', disabled: !canWrite,
  });
  actions.append(refreshBtn, uploadBtn);
  head.append(title, actions);
  return { head, refreshBtn, uploadBtn };
}

export async function mount(container, shellCtx) {
  ensureMediaStyles();
  container.innerHTML = '';
  const canWrite = hasMediaWrite(shellCtx);
  const { head, refreshBtn, uploadBtn } = buildMediaSectionHeader(shellCtx.siteId, canWrite);
  const progressBox = Object.assign(document.createElement('div'), { className: 'adm-media-progress' });
  const gridHost = Object.assign(document.createElement('div'), { className: 'adm-media-grid' });
  let filters;

  const openReplace = (preset) => openMediaUploadDialog({
    siteId: shellCtx.siteId,
    preset,
    onSaved: async () => {
      if (typeof shellCtx.refreshShell === 'function') await shellCtx.refreshShell();
      await loadView();
    },
  });
  const loadView = async () => {
    const baseRes = await adminApi.get(`/media/items?${new URLSearchParams({ siteId: shellCtx.siteId, collection: filters.colSel.value })}`);
    syncSlugFilterOptions(filters.slugSel, baseRes.items || [], filters.slugSel.value);
    const qs = new URLSearchParams({
      siteId: shellCtx.siteId, collection: filters.colSel.value, slug: filters.slugSel.value,
      aiState: filters.aiSel.value, q: filters.qIn.value.trim(),
    });
    const res = await adminApi.get(`/media/items?${qs}`);
    renderAiProgressPanel(progressBox, res.aiProgress, canWrite, openReplace);
    renderMediaCardsGrid(gridHost, res.items || [], canWrite, openReplace);
  };

  filters = buildFilterToolbar(() => loadView().catch((e) => showToast(e.message || '筛选失败', 'error')));
  bindAsyncButton(refreshBtn, loadView, { loadingLabel: '刷新中…' });
  uploadBtn.addEventListener('click', () => openReplace({ collection: filters.colSel.value === 'all' ? 'resorts' : filters.colSel.value }));
  container.append(head, progressBox, filters.bar, gridHost);
  await loadView();
}
