const STYLE_TAG_ID = 'nts-admin-translations-styles';

const CSS_RULES = `
.tr-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(185px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.tr-stat-card {
  background: var(--adm-surface);
  border: 1px solid var(--adm-border);
  border-radius: var(--adm-radius);
  padding: 12px 14px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.tr-stat-card:hover, .tr-stat-card.is-active {
  border-color: var(--adm-primary);
  box-shadow: 0 4px 14px rgba(24, 26, 40, 0.08);
}
.tr-stat-card__label { font-size: 12px; color: var(--adm-muted); font-weight: 600; }
.tr-stat-card__num { font-size: 24px; font-weight: 700; margin: 4px 0; color: var(--adm-ink); }
.tr-mini-pills { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
.tr-pill-btn {
  border: 1px solid var(--adm-border);
  background: #f8f9fc;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
}
.tr-pill-btn:hover { border-color: var(--adm-primary); }
.tr-section-sub { font-size: 13px; font-weight: 700; margin: 14px 0 8px; color: var(--adm-primary); }
.tr-lint-box {
  background: #fff8eb;
  border: 1px solid #f2cf8d;
  border-radius: var(--adm-radius);
  padding: 12px;
  margin-bottom: 16px;
}
.tr-lint-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-bottom: 1px solid rgba(180, 83, 9, 0.15);
}
.tr-lint-item:last-child { border-bottom: 0; }
.tr-field-card {
  background: var(--adm-surface);
  border: 1px solid var(--adm-border);
  border-radius: var(--adm-radius);
  padding: 14px;
  margin-bottom: 12px;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}
.tr-field-card.is-focused {
  border-color: var(--adm-accent);
  box-shadow: 0 0 0 3px rgba(201, 24, 24, 0.18);
}
.tr-field-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.tr-side-by-side {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
}
.tr-source-pane {
  background: #f8f9fc;
  border: 1px solid var(--adm-border);
  border-radius: var(--adm-radius);
  padding: 10px 12px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
}
.tr-en-ref {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--adm-border);
  font-size: 12px;
  color: var(--adm-muted);
}
@media (max-width: 860px) {
  .tr-side-by-side { grid-template-columns: 1fr; }
}
`;

export function ensureTranslationStyles() {
  if (document.getElementById(STYLE_TAG_ID)) return;
  const styleEl = document.createElement('style');
  styleEl.id = STYLE_TAG_ID;
  styleEl.textContent = CSS_RULES;
  document.head.appendChild(styleEl);
}

export const COLLECTION_LABELS = {
  resorts: '目的地 (resorts)',
  regions: '区域 (regions)',
  guides: '攻略 (guides)',
  collections: '合集 (collections)',
  stays: '酒店 (stays)',
  packages: '套餐 (packages)',
  authors: '作者 (authors)',
  pages: '静态页面 (pages)',
};

export const LOCALE_LABELS = {
  'zh-CN': '简体中文 (zh-CN)',
  en: 'English (en)',
  'zh-Hant': '繁體中文 (zh-Hant)',
  ja: '日本語 (ja)',
  ko: '한국어 (ko)',
};

export const STATE_LABELS = {
  missing: '缺失',
  stale: '过期',
  machine: '机器翻译',
  reviewed: '已审校',
  source: '源语言',
};
