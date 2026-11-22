function ensureToastHost() {
  let host = document.getElementById('ntsAdminToastHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'ntsAdminToastHost';
    host.className = 'adm-toast-host';
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  return host;
}

export function showToast(message, variant = 'info', durationMs = 3600) {
  const host = ensureToastHost();
  const item = document.createElement('div');
  item.className = `adm-toast adm-toast--${variant}`;
  item.textContent = String(message || '');
  host.appendChild(item);

  window.setTimeout(() => {
    item.classList.add('is-leaving');
    window.setTimeout(() => item.remove(), 220);
  }, durationMs);
}
