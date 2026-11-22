const HEX6_RE = /^#[0-9a-fA-F]{6}$/;

function parseHexChannel(hex, offset) {
  return Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
}

function toLinearSrgb(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function isValidHex6(raw) {
  return HEX6_RE.test(String(raw || '').trim());
}

export function computeClientLuminance(hex) {
  const clean = String(hex || '').trim();
  if (!HEX6_RE.test(clean)) return null;
  const r = toLinearSrgb(parseHexChannel(clean, 1));
  const g = toLinearSrgb(parseHexChannel(clean, 3));
  const b = toLinearSrgb(parseHexChannel(clean, 5));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function computeClientContrast(fgHex, bgHex) {
  const l1 = computeClientLuminance(fgHex);
  const l2 = computeClientLuminance(bgHex);
  if (l1 === null || l2 === null) return null;
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

export function evaluateClientTheme(theme = {}) {
  const spec = [
    { id: 'ink-on-surface', label: '正文文字 / 卡片表面', fg: theme.ink, bg: theme.surface },
    { id: 'white-on-primary', label: '深色主色背景 / 反白文字', fg: '#ffffff', bg: theme.primary },
    { id: 'white-on-accent', label: '强调色按钮 / 反白文字', fg: '#ffffff', bg: theme.accent },
  ];
  const pairs = spec.map((p) => {
    const ratio = computeClientContrast(p.fg, p.bg);
    const passesAa = ratio !== null && ratio >= 4.5;
    return { ...p, ratio, passesAa };
  });
  const warnings = pairs
    .filter((p) => !p.passesAa)
    .map((p) =>
      p.ratio === null
        ? `${p.label} 颜色格式需为 #RRGGBB`
        : `${p.label} 当前对比度 ${p.ratio}:1，低于 WCAG AA 标准（4.5:1），建议加深底色或文字色`,
    );
  return { passesAa: warnings.length === 0, pairs, warnings };
}

const WIZARD_STYLE_CSS = `
.wz-bar { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:14px; background:#fff; border:1px solid var(--adm-border); padding:10px 14px; border-radius:var(--adm-radius); }
.wz-steps { display:grid; grid-template-columns:repeat(7, minmax(0, 1fr)); gap:6px; margin-bottom:16px; }
.wz-step-btn { border:1px solid var(--adm-border); background:#fff; border-radius:var(--adm-radius); padding:8px 6px; font-size:12px; cursor:pointer; text-align:center; color:var(--adm-muted); }
.wz-step-btn.is-active { background:var(--adm-primary); color:#fff; border-color:var(--adm-primary); font-weight:600; }
.wz-step-btn.is-done { border-color:var(--adm-ok); color:var(--adm-ok); }
.wz-card { background:#fff; border:1px solid var(--adm-border); border-radius:var(--adm-radius); padding:18px; margin-bottom:14px; }
.wz-grid-2 { display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px; }
.wz-vcard { border:1px solid var(--adm-border); border-radius:var(--adm-radius); padding:12px; cursor:pointer; background:#fafbfe; }
.wz-vcard.is-selected { border:2px solid var(--adm-primary); background:#eef2ff; }
.wz-check-group { display:flex; gap:12px; flex-wrap:wrap; padding:6px 0; }
.wz-color-row { display:flex; align-items:center; gap:8px; }
.wz-color-picker { width:42px; height:36px; padding:2px; border:1px solid var(--adm-border); border-radius:4px; background:#fff; cursor:pointer; }
.wz-preview { border-radius:var(--adm-radius); overflow:hidden; border:1px solid var(--adm-border); margin-top:12px; }
.wz-foot { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:14px; flex-wrap:wrap; }
.wz-brief-card { border:1px solid var(--adm-border); border-radius:var(--adm-radius); padding:14px; margin-bottom:12px; background:#fafbfd; }
.wz-pill-ok { color:#065f46; background:#d1fae5; padding:2px 8px; border-radius:999px; font-size:12px; font-weight:600; }
.wz-pill-warn { color:#991b1b; background:#fee2e2; padding:2px 8px; border-radius:999px; font-size:12px; font-weight:600; }
`;

export function ensureWizardStyles() {
  if (document.getElementById('ntsSiteWizardStyles')) return;
  const styleEl = document.createElement('style');
  styleEl.id = 'ntsSiteWizardStyles';
  styleEl.textContent = WIZARD_STYLE_CSS;
  document.head.appendChild(styleEl);
}
