import { adminApi, adminRequest, openDialog, showToast } from '../../../ui/kit/index.js';
import { createThreeByTwoCropper } from './cropper.js';
import { ensureMediaStyles } from './styles.js';

export const MEDIA_COLLECTION_LABELS = [
  { value: 'resorts', label: '目的地（resorts）' },
  { value: 'stays', label: '酒店（stays）' },
  { value: 'packages', label: '套餐（packages）' },
  { value: 'guides', label: '攻略（guides）' },
  { value: 'collections', label: '合集（collections）' },
  { value: 'regions', label: '区域（regions）' },
  { value: 'authors', label: '作者（authors）' },
  { value: 'brand', label: '品牌与主视觉（brand）' },
];

function makeFieldWrap(labelText, controlEl) {
  const wrap = Object.assign(document.createElement('div'), { className: 'adm-field' });
  const lbl = Object.assign(document.createElement('label'), { className: 'adm-label', textContent: labelText });
  wrap.append(lbl, controlEl);
  return wrap;
}

function createTargetInputs(preset = {}) {
  const colSel = Object.assign(document.createElement('select'), { className: 'adm-input' });
  for (const opt of MEDIA_COLLECTION_LABELS) {
    colSel.appendChild(Object.assign(document.createElement('option'), {
      value: opt.value,
      textContent: opt.label,
      selected: (preset.collection || 'resorts') === opt.value,
    }));
  }
  const slugIn = Object.assign(document.createElement('input'), {
    type: 'text',
    className: 'adm-input',
    value: preset.slug || '',
    placeholder: '例如：beidahu 或 niseko-united',
  });
  const slotSel = Object.assign(document.createElement('select'), { className: 'adm-input' });
  const slotChoices = [
    { v: 'cover', l: '封面图（cover.jpg）' },
    { v: 'gallery', l: '图集（gallery-<序号>.jpg）' },
    ...(preset.slot === 'hero' ? [{ v: 'hero', l: '站点主视觉（hero.jpg）' }] : []),
    ...(preset.slot === 'brand' ? [{ v: 'brand', l: `品牌配图（${preset.slug}.jpg）` }] : []),
  ];
  for (const sc of slotChoices) {
    slotSel.appendChild(Object.assign(document.createElement('option'), {
      value: sc.v,
      textContent: sc.l,
      selected: (preset.slot || 'cover') === sc.v,
    }));
  }
  const idxIn = Object.assign(document.createElement('input'), {
    type: 'number', min: '1', max: '99', className: 'adm-input', value: String(preset.galleryIndex || 1),
  });
  return { colSel, slugIn, slotSel, idxIn };
}

function createLicenseMetaInputs(presetMeta = {}) {
  const licenseIn = Object.assign(document.createElement('input'), {
    type: 'text', className: 'adm-input', value: presetMeta?.license || '',
    placeholder: '必填，例如：自有实拍授权 / CC-BY-4.0 / 合作伙伴书面授权',
  });
  const authorIn = Object.assign(document.createElement('input'), {
    type: 'text', className: 'adm-input', value: presetMeta?.author || '', placeholder: '例如：雪迹摄影组 / 官方旅游局',
  });
  const dateIn = Object.assign(document.createElement('input'), {
    type: 'date', className: 'adm-input', value: presetMeta?.capturedAt || '',
  });
  const notesIn = Object.assign(document.createElement('input'), {
    type: 'text', className: 'adm-input', value: presetMeta?.notes || '', placeholder: '可选：合同编号或补充说明',
  });
  return { licenseIn, authorIn, dateIn, notesIn };
}

function createSourceModeSection(cropper, presetMeta = {}) {
  let mode = 'upload';
  const bar = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const upBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--primary adm-btn--sm', textContent: '本地上传 + 3:2 裁剪' });
  const urlBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: 'HTTPS URL 远程导入' });
  bar.append(upBtn, urlBtn);

  const fileIn = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/avif', className: 'adm-input' });
  const srcUrlIn = Object.assign(document.createElement('input'), {
    type: 'url', className: 'adm-input', placeholder: '可选：原图来源链接（https://...）',
    value: presetMeta?.sourceUrl?.startsWith('http') ? presetMeta.sourceUrl : '',
  });
  const uploadPane = document.createElement('div');
  uploadPane.append(makeFieldWrap('选择本地图片（JPEG / PNG / WebP / AVIF） *', fileIn), cropper.el, makeFieldWrap('来源链接（可选）', srcUrlIn));

  const remoteUrlIn = Object.assign(document.createElement('input'), { type: 'url', className: 'adm-input', placeholder: 'https://...（自动校验尺寸并裁剪为 3:2）' });
  const urlPane = Object.assign(document.createElement('div'), { hidden: true });
  urlPane.appendChild(makeFieldWrap('远程图片 HTTPS URL *', remoteUrlIn));

  fileIn.addEventListener('change', () => cropper.setFile(fileIn.files?.[0] || null));
  const syncTabs = (next) => {
    mode = next;
    uploadPane.hidden = mode !== 'upload';
    urlPane.hidden = mode !== 'url';
    upBtn.className = `adm-btn ${mode === 'upload' ? 'adm-btn--primary' : 'adm-btn--outline'} adm-btn--sm`;
    urlBtn.className = `adm-btn ${mode === 'url' ? 'adm-btn--primary' : 'adm-btn--outline'} adm-btn--sm`;
  };
  upBtn.addEventListener('click', () => syncTabs('upload'));
  urlBtn.addEventListener('click', () => syncTabs('url'));
  return { bar, uploadPane, urlPane, fileIn, srcUrlIn, remoteUrlIn, getMode: () => mode };
}

function buildMultipartFormData(siteId, targetCtl, metaCtl, sourceCtl, cropper) {
  const file = sourceCtl.fileIn.files?.[0];
  if (!file) throw new Error('请先选择本地图片文件');
  const { focusX, focusY } = cropper.getFocus();
  const slot = targetCtl.slotSel.value;
  const fd = new FormData();
  fd.set('siteId', siteId);
  fd.set('collection', targetCtl.colSel.value.trim());
  fd.set('slug', targetCtl.slugIn.value.trim());
  fd.set('slot', slot);
  if (slot === 'gallery') fd.set('galleryIndex', String(Number(targetCtl.idxIn.value) || 1));
  fd.set('license', metaCtl.licenseIn.value.trim());
  fd.set('author', metaCtl.authorIn.value.trim());
  fd.set('capturedAt', metaCtl.dateIn.value.trim());
  fd.set('sourceUrl', sourceCtl.srcUrlIn.value.trim());
  fd.set('notes', metaCtl.notesIn.value.trim());
  fd.set('focusX', String(focusX));
  fd.set('focusY', String(focusY));
  fd.set('file', file, file.name);
  return fd;
}

async function submitUploadOrIngest(siteId, targetCtl, metaCtl, sourceCtl, cropper) {
  const slug = targetCtl.slugIn.value.trim();
  const license = metaCtl.licenseIn.value.trim();
  if (!slug) throw new Error('请填写条目标识（slug）');
  if (!license) throw new Error('授权信息（license）为必填项，请填写后再保存');

  if (sourceCtl.getMode() === 'url') {
    const url = sourceCtl.remoteUrlIn.value.trim();
    if (!url.startsWith('https://')) throw new Error('远程导入必须填写以 https:// 开头的安全图片地址');
    const slot = targetCtl.slotSel.value;
    return adminApi.post('/media/ingest-url', {
      siteId,
      collection: targetCtl.colSel.value.trim(),
      slug,
      slot,
      galleryIndex: slot === 'gallery' ? Number(targetCtl.idxIn.value) || 1 : undefined,
      url,
      license,
      author: metaCtl.authorIn.value.trim(),
      capturedAt: metaCtl.dateIn.value.trim(),
      notes: metaCtl.notesIn.value.trim(),
    });
  }
  const fd = buildMultipartFormData(siteId, targetCtl, metaCtl, sourceCtl, cropper);
  return adminRequest('/media/upload', { method: 'POST', body: fd });
}

function populateUploadDialogBody(body, targetCtl, idxWrap, metaCtl, sourceCtl, errBanner) {
  const row1 = Object.assign(document.createElement('div'), { className: 'adm-form-row-2' });
  row1.append(makeFieldWrap('所属集合 *', targetCtl.colSel), makeFieldWrap('条目标识（slug） *', targetCtl.slugIn));
  const row2 = Object.assign(document.createElement('div'), { className: 'adm-form-row-2' });
  row2.append(makeFieldWrap('保存槽位（自动规范化文件名）', targetCtl.slotSel), idxWrap);
  const row3 = Object.assign(document.createElement('div'), { className: 'adm-form-row-2' });
  row3.append(makeFieldWrap('摄影师 / 来源机构', metaCtl.authorIn), makeFieldWrap('拍摄日期', metaCtl.dateIn));
  body.append(
    sourceCtl.bar, row1, row2, sourceCtl.uploadPane, sourceCtl.urlPane,
    makeFieldWrap('版权与授权说明（license，必填） *', metaCtl.licenseIn),
    row3, makeFieldWrap('授权备注', metaCtl.notesIn), errBanner,
  );
}

export function openMediaUploadDialog({ siteId, preset = {}, onSaved }) {
  ensureMediaStyles();
  const cropper = createThreeByTwoCropper({ focusX: preset.meta?.focusX ?? 0.5, focusY: preset.meta?.focusY ?? 0.5 });
  const targetCtl = createTargetInputs(preset);
  const metaCtl = createLicenseMetaInputs(preset.meta);
  const sourceCtl = createSourceModeSection(cropper, preset.meta);
  const errBanner = Object.assign(document.createElement('p'), { className: 'adm-field__error', hidden: true });
  const idxWrap = makeFieldWrap('图集序号（1–99）', targetCtl.idxIn);
  idxWrap.hidden = targetCtl.slotSel.value !== 'gallery';
  targetCtl.slotSel.addEventListener('change', () => { idxWrap.hidden = targetCtl.slotSel.value !== 'gallery'; });

  return openDialog({
    title: preset.isAiSample ? `替换 AI 示例图 · ${preset.collection}/${preset.slug}` : '上传或导入实拍图片',
    confirmLabel: '裁剪保存并提交 Git',
    renderBody: (body) => populateUploadDialogBody(body, targetCtl, idxWrap, metaCtl, sourceCtl, errBanner),
    onConfirm: async () => {
      errBanner.hidden = true;
      try {
        const res = await submitUploadOrIngest(siteId, targetCtl, metaCtl, sourceCtl, cropper);
        cropper.destroy();
        showToast(res.removedFromAiManifest ? `已替换 AI 图并移出清单（${res.commitHash.slice(0, 8)}）` : `已保存图片（${res.commitHash.slice(0, 8)}）`, 'success');
        if (typeof onSaved === 'function') await onSaved(res);
      } catch (err) {
        errBanner.textContent = err.message || '上传保存失败';
        errBanner.hidden = false;
        throw err;
      }
    },
  });
}
