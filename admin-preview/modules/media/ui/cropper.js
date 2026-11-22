function clampZeroToOne(val) {
  if (!Number.isFinite(val)) return 0.5;
  return Math.min(1, Math.max(0, val));
}

function computeDisplayThreeByTwoBox(dispWidth, dispHeight, focusX, focusY) {
  if (dispWidth <= 0 || dispHeight <= 0) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  const unit = Math.min(dispWidth / 3, dispHeight / 2);
  const boxW = unit * 3;
  const boxH = unit * 2;
  const maxLeft = Math.max(0, dispWidth - boxW);
  const maxTop = Math.max(0, dispHeight - boxH);
  const left = Math.min(maxLeft, Math.max(0, focusX * dispWidth - boxW / 2));
  const top = Math.min(maxTop, Math.max(0, focusY * dispHeight - boxH / 2));
  return { left, top, width: boxW, height: boxH };
}

function bindStagePointerDrag(stageEl, updateFromPointer) {
  let dragging = false;
  stageEl.addEventListener('pointerdown', (e) => {
    dragging = true;
    if (stageEl.setPointerCapture) stageEl.setPointerCapture(e.pointerId);
    updateFromPointer(e);
  });
  stageEl.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    updateFromPointer(e);
  });
  const stop = () => {
    dragging = false;
  };
  stageEl.addEventListener('pointerup', stop);
  stageEl.addEventListener('pointercancel', stop);
}

function buildCropperDom() {
  const root = Object.assign(document.createElement('div'), { className: 'adm-field', hidden: true });
  const topRow = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  const label = Object.assign(document.createElement('span'), { className: 'adm-muted' });
  const resetBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--outline adm-btn--sm',
    textContent: '焦点居中重置',
  });
  topRow.append(label, resetBtn);

  const stage = Object.assign(document.createElement('div'), { className: 'adm-crop-stage' });
  const img = Object.assign(document.createElement('img'), { alt: '3:2 裁剪预览' });
  const cropBox = Object.assign(document.createElement('div'), { className: 'adm-crop-box' });
  const focusDot = Object.assign(document.createElement('div'), { className: 'adm-crop-dot' });
  stage.append(img, cropBox, focusDot);
  root.append(topRow, stage);
  return { root, label, resetBtn, stage, img, cropBox, focusDot };
}

function renderCropperOverlay(dom, state) {
  const w = dom.img.clientWidth;
  const h = dom.img.clientHeight;
  const rect = computeDisplayThreeByTwoBox(w, h, state.focusX, state.focusY);
  dom.cropBox.style.left = `${rect.left}px`;
  dom.cropBox.style.top = `${rect.top}px`;
  dom.cropBox.style.width = `${rect.width}px`;
  dom.cropBox.style.height = `${rect.height}px`;
  dom.focusDot.style.left = `${state.focusX * w}px`;
  dom.focusDot.style.top = `${state.focusY * h}px`;
  dom.label.textContent = `拖动调整 3:2 裁剪焦点 · X: ${Math.round(state.focusX * 100)}% / Y: ${Math.round(state.focusY * 100)}%`;
}

export function createThreeByTwoCropper(initialFocus = { focusX: 0.5, focusY: 0.5 }) {
  const state = {
    focusX: clampZeroToOne(initialFocus.focusX ?? 0.5),
    focusY: clampZeroToOne(initialFocus.focusY ?? 0.5),
    objectUrl: '',
  };
  const dom = buildCropperDom();
  const sync = () => renderCropperOverlay(dom, state);

  dom.img.addEventListener('load', sync);
  dom.resetBtn.addEventListener('click', () => {
    state.focusX = 0.5;
    state.focusY = 0.5;
    sync();
  });
  bindStagePointerDrag(dom.stage, (e) => {
    const b = dom.img.getBoundingClientRect();
    if (b.width <= 0 || b.height <= 0) return;
    state.focusX = clampZeroToOne((e.clientX - b.left) / b.width);
    state.focusY = clampZeroToOne((e.clientY - b.top) / b.height);
    sync();
  });

  return {
    el: dom.root,
    setFile(file) {
      if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
      if (!file) { dom.root.hidden = true; return; }
      state.objectUrl = URL.createObjectURL(file);
      dom.img.src = state.objectUrl;
      dom.root.hidden = false;
    },
    getFocus: () => ({ focusX: state.focusX, focusY: state.focusY }),
    destroy: () => { if (state.objectUrl) URL.revokeObjectURL(state.objectUrl); },
  };
}
