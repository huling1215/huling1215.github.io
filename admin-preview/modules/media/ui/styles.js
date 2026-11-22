const STYLE_ID = 'adm-media-module-styles';

const MEDIA_CSS = `
.adm-media-progress {
  background: var(--adm-surface);
  border: 1px solid var(--adm-border);
  border-left: 4px solid var(--adm-primary);
  border-radius: var(--adm-radius);
  padding: 16px 18px;
  margin-bottom: 16px;
}
.adm-media-progress__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.adm-media-progress__bar {
  height: 10px;
  background: #e9ecf5;
  border-radius: 999px;
  overflow: hidden;
}
.adm-media-progress__fill {
  height: 100%;
  background: var(--adm-ok);
  transition: width 0.25s ease;
}
.adm-media-ai-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
  max-height: 132px;
  overflow-y: auto;
  padding-top: 4px;
}
.adm-media-ai-chip {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid #f2cf8d;
  background: #fff8eb;
  color: #854d0e;
  cursor: pointer;
}
.adm-media-ai-chip:hover { background: #fef0c7; border-color: #d97706; }

.adm-media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}
.adm-media-card {
  background: var(--adm-surface);
  border: 1px solid var(--adm-border);
  border-radius: var(--adm-radius);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.adm-media-card.is-selected {
  border-color: var(--adm-primary);
  box-shadow: 0 0 0 2px rgba(29, 30, 51, 0.2);
}
.adm-media-card__thumb {
  position: relative;
  aspect-ratio: 3 / 2;
  background: #ebedf5;
  overflow: hidden;
}
.adm-media-card__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.adm-media-card__badges {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.adm-media-card__body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.adm-media-card__title {
  font-weight: 600;
  font-size: 13px;
  word-break: break-all;
}
.adm-media-card__meta {
  font-size: 12px;
  color: var(--adm-muted);
}
.adm-media-card__foot {
  padding: 8px 12px 12px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.adm-crop-stage {
  position: relative;
  display: inline-block;
  max-width: 100%;
  max-height: 320px;
  overflow: hidden;
  border-radius: var(--adm-radius);
  border: 1px solid var(--adm-border);
  cursor: crosshair;
  user-select: none;
  touch-action: none;
  background: #141622;
}
.adm-crop-stage img {
  display: block;
  max-width: 100%;
  max-height: 320px;
  width: auto;
  height: auto;
  pointer-events: none;
}
.adm-crop-box {
  position: absolute;
  border: 2px solid #ffffff;
  box-shadow: 0 0 0 9999px rgba(15, 18, 30, 0.56);
  pointer-events: none;
}
.adm-crop-dot {
  position: absolute;
  width: 16px;
  height: 16px;
  margin-left: -8px;
  margin-top: -8px;
  border-radius: 50%;
  background: var(--adm-accent);
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  pointer-events: none;
}
.adm-form-row-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
`;

export function ensureMediaStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const styleEl = document.createElement('style');
  styleEl.id = STYLE_ID;
  styleEl.textContent = MEDIA_CSS;
  document.head.appendChild(styleEl);
}
