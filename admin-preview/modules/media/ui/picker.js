import {
  adminApi,
  bindAsyncButton,
  openDialog,
  registerMediaPickerProvider,
  showToast,
} from '../../../ui/kit/index.js';
import { ensureMediaStyles } from './styles.js';
import { MEDIA_COLLECTION_LABELS, openMediaUploadDialog } from './upload-dialog.js';

export function formatPickedMediaValue(item, returnFormat = 'catalog') {
  if (!item) return '';
  if (returnFormat === 'repo') return item.relativeAssetPath;
  if (returnFormat === 'subpath') return item.assetSubpath;
  return item.catalogRefPath;
}

function resolveCurrentSiteId(explicitSiteId) {
  if (typeof explicitSiteId === 'string' && explicitSiteId.trim()) return explicitSiteId.trim();
  if (typeof document !== 'undefined') {
    const sel = document.getElementById('admSiteSelect');
    if (sel && sel.value) return sel.value;
  }
  return 'powderclub';
}

function createPickerCard(item, selectedVal, returnFormat, onPick) {
  const value = formatPickedMediaValue(item, returnFormat);
  const card = Object.assign(document.createElement('div'), {
    className: `adm-media-card ${selectedVal === value ? 'is-selected' : ''}`,
  });
  card.style.cursor = 'pointer';
  const thumb = Object.assign(document.createElement('div'), { className: 'adm-media-card__thumb' });
  const img = Object.assign(document.createElement('img'), { src: item.previewUrl, alt: item.slug, loading: 'lazy' });
  const badges = Object.assign(document.createElement('div'), { className: 'adm-media-card__badges' });
  badges.appendChild(Object.assign(document.createElement('span'), {
    className: `adm-badge ${item.isAiSample ? 'adm-badge--stale' : 'adm-badge--reviewed'}`,
    textContent: item.isAiSample ? '待换 AI 图' : '实拍已授权',
  }));
  thumb.append(img, badges);

  const info = Object.assign(document.createElement('div'), { className: 'adm-media-card__body' });
  info.append(
    Object.assign(document.createElement('div'), { className: 'adm-media-card__title', textContent: `${item.collection}/${item.slug}/${item.filename}` }),
    Object.assign(document.createElement('div'), { className: 'adm-media-card__meta', textContent: `${item.width}×${item.height}px · ${item.meta?.license || '未登记授权'}` }),
  );
  card.append(thumb, info);
  card.addEventListener('click', () => onPick(item, value));
  return card;
}

function renderPickerGrid(gridEl, items, selectedInput, returnFormat) {
  gridEl.innerHTML = '';
  if (!items.length) {
    gridEl.appendChild(Object.assign(document.createElement('p'), {
      className: 'adm-muted',
      textContent: '当前筛选条件下暂无可选图片，可点击右上角「上传新图片」立即添加。',
    }));
    return;
  }
  const rerenderSelection = (val) => {
    selectedInput.value = val;
    for (const el of gridEl.querySelectorAll('.adm-media-card')) {
      el.classList.toggle('is-selected', el.dataset.pickValue === val);
    }
  };
  for (const item of items) {
    const val = formatPickedMediaValue(item, returnFormat);
    const card = createPickerCard(item, selectedInput.value, returnFormat, (_it, picked) => rerenderSelection(picked));
    card.dataset.pickValue = val;
    gridEl.appendChild(card);
  }
}

function buildPickerFilterBar(initialCol, onChange, onUploadClick) {
  const bar = Object.assign(document.createElement('div'), { className: 'adm-filter-grid' });
  const colSel = Object.assign(document.createElement('select'), { className: 'adm-input' });
  colSel.appendChild(Object.assign(document.createElement('option'), { value: 'all', textContent: '全部集合' }));
  for (const c of MEDIA_COLLECTION_LABELS) {
    colSel.appendChild(Object.assign(document.createElement('option'), {
      value: c.value, textContent: c.label, selected: initialCol === c.value,
    }));
  }
  const qIn = Object.assign(document.createElement('input'), {
    type: 'search', className: 'adm-input', placeholder: '搜索 slug 或授权关键词…',
  });
  const aiSel = Object.assign(document.createElement('select'), { className: 'adm-input' });
  aiSel.append(
    Object.assign(document.createElement('option'), { value: 'all', textContent: '全部图片' }),
    Object.assign(document.createElement('option'), { value: 'real', textContent: '仅已授权实拍图' }),
    Object.assign(document.createElement('option'), { value: 'ai', textContent: '仅 AI 示例图' }),
  );
  const upBtn = Object.assign(document.createElement('button'), {
    type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '上传新图片',
  });
  colSel.addEventListener('change', onChange);
  aiSel.addEventListener('change', onChange);
  qIn.addEventListener('input', onChange);
  upBtn.addEventListener('click', onUploadClick);
  bar.append(colSel, aiSel, qIn, upBtn);
  return { bar, colSel, aiSel, qIn };
}

function createPickerSessionDom(siteId, options, returnFormat) {
  const selectedIn = Object.assign(document.createElement('input'), {
    type: 'text', className: 'adm-input', value: options.currentValue || '',
    placeholder: '点选上方缩略图，或手动确认图片路径',
  });
  const gridEl = Object.assign(document.createElement('div'), { className: 'adm-media-grid' });
  gridEl.style.maxHeight = '48vh';
  gridEl.style.overflowY = 'auto';

  let controls;
  const reload = async () => {
    const qs = new URLSearchParams({
      siteId,
      collection: controls.colSel.value,
      aiState: controls.aiSel.value,
      q: controls.qIn.value.trim(),
    });
    const data = await adminApi.get(`/media/items?${qs.toString()}`);
    renderPickerGrid(gridEl, data.items || [], selectedIn, returnFormat);
  };
  const onTriggerChange = () => reload().catch((err) => showToast(err.message || '加载失败', 'error'));
  const onOpenUpload = () => openMediaUploadDialog({
    siteId,
    preset: { collection: options.collection || 'stays', slug: options.slug || '' },
    onSaved: async (res) => {
      if (res.item) selectedIn.value = formatPickedMediaValue(res.item, returnFormat);
      await reload();
    },
  });
  controls = buildPickerFilterBar(options.collection || 'all', onTriggerChange, onOpenUpload);
  const refreshBtn = Object.assign(document.createElement('button'), {
    type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '刷新',
  });
  bindAsyncButton(refreshBtn, reload, { loadingLabel: '加载中…' });
  controls.bar.appendChild(refreshBtn);
  return { controls, gridEl, selectedIn, reload };
}

export function openVisualMediaPicker(options = {}) {
  ensureMediaStyles();
  const siteId = resolveCurrentSiteId(options.siteId);
  const returnFormat = options.returnFormat || 'catalog';
  const session = createPickerSessionDom(siteId, options, returnFormat);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (val) => { if (!settled) { settled = true; resolve(val); } };
    const dlg = openDialog({
      title: options.title || `从媒体库选择图片 · ${siteId}`,
      confirmLabel: '确认选用此图片',
      renderBody: (body) => {
        body.append(
          session.controls.bar,
          session.gridEl,
          Object.assign(document.createElement('label'), { className: 'adm-label', textContent: '当前已选图片路径' }),
          session.selectedIn,
        );
      },
      onConfirm: async () => finish(session.selectedIn.value.trim() || null),
    });
    dlg.body.closest('.adm-dialog')?.addEventListener('click', (e) => {
      if (e.target.textContent === '取消' || e.target.textContent === '关闭') finish(null);
    });
    session.reload().catch((err) => showToast(err.message || '加载媒体列表失败', 'error'));
  });
}

export function installMediaPickerProvider() {
  registerMediaPickerProvider(openVisualMediaPicker);
}

installMediaPickerProvider();
