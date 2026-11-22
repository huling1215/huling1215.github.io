export function renderDiffView(container, diffText) {
  container.innerHTML = '';
  const wrap = document.createElement('pre');
  wrap.className = 'adm-diff';
  const raw = String(diffText || '').trim();
  if (!raw) {
    wrap.textContent = '（两个版本内容完全一致，无差异）';
    container.appendChild(wrap);
    return;
  }

  for (const line of raw.split('\n')) {
    const row = document.createElement('div');
    row.className = 'adm-diff__line';
    if (line.startsWith('+') && !line.startsWith('+++')) row.classList.add('is-add');
    else if (line.startsWith('-') && !line.startsWith('---')) row.classList.add('is-del');
    else if (line.startsWith('@@')) row.classList.add('is-hunk');
    row.textContent = line;
    wrap.appendChild(row);
  }
  container.appendChild(wrap);
}
