(async () => {
  const loadApp = () => { const s = document.createElement('script'); s.type = 'module'; s.src = '/ui/shell/app.js'; document.body.appendChild(s); };
  if (!('serviceWorker' in navigator)) { document.body.insertAdjacentText('afterbegin', '当前浏览器不支持后台预览，请使用新版 Chrome / Edge / Safari 打开。'); return; }
  await navigator.serviceWorker.register('/admin-preview/sw.js', { scope: '/admin-preview/' });
  if (navigator.serviceWorker.controller) { loadApp(); return; }
  navigator.serviceWorker.addEventListener('controllerchange', loadApp, { once: true });
})();
