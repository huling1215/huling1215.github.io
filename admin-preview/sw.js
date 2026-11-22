// 后台静态预览：用 Service Worker 回放录制好的接口数据，所有写操作一律拒绝
const PREFIX = '/admin-preview';
const READONLY_MSG = '预览模式：只能浏览体验，保存、修改和发布都不会生效';
let indexPromise = null;
let loggedIn = false;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

function loadIndex() {
  if (!indexPromise) indexPromise = fetch(`${PREFIX}/data/index.json`).then((r) => r.json());
  return indexPromise;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

async function readLoginFlag() {
  const cache = await caches.open('adm-preview-state');
  return Boolean(await cache.match('/login-flag'));
}

async function writeLoginFlag(on) {
  const cache = await caches.open('adm-preview-state');
  if (on) await cache.put('/login-flag', new Response('1'));
  else await cache.delete('/login-flag');
  loggedIn = on;
}

function normalizedKeys(url) {
  const params = [...url.searchParams.entries()].filter(([k, v]) => !(k === 't' && v));
  const exact = url.pathname + url.search;
  const noTs = `${url.pathname}?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
  return [exact, noTs, `${url.pathname}?${new URLSearchParams(params).toString()}`];
}

async function replay(url) {
  const index = await loadIndex();
  let hit = normalizedKeys(url).map((k) => index.records[k]).find(Boolean);
  if (!hit) {
    const sameSite = url.searchParams.get('siteId');
    const candidates = Object.keys(index.records).filter((k) => k.split('?')[0] === url.pathname);
    const pick = candidates.find((k) => !sameSite || k.includes(`siteId=${sameSite}`)) || candidates[0];
    hit = pick ? index.records[pick] : null;
  }
  if (!hit) return json({ success: false, error: '预览模式：这个页面的数据没有录制，正式后台可正常使用' }, 404);
  const res = await fetch(`${PREFIX}/data/${hit.file}`);
  return new Response(res.body, { status: hit.status, headers: { 'Content-Type': hit.type || 'application/octet-stream' } });
}

async function handleApi(request, url) {
  const p = url.pathname;
  if (p === '/api/admin/auth/login' && request.method === 'POST') {
    await writeLoginFlag(true);
    const index = await loadIndex();
    return json({ success: true, data: { user: index.demoUser, csrfToken: 'preview' } });
  }
  if (p === '/api/admin/auth/logout') {
    await writeLoginFlag(false);
    return json({ success: true, data: { ok: true } });
  }
  if (p === '/api/admin/auth/me') {
    if (!(loggedIn || (await readLoginFlag()))) return json({ success: true, data: { authenticated: false, hasUsers: true } });
    return replay(url);
  }
  if (p.endsWith('/stream')) return new Response('', { status: 404 });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return json({ success: false, error: READONLY_MSG, code: 'PREVIEW_READONLY' }, 403);
  }
  return replay(url);
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApi(event.request, url));
    return;
  }
  if (url.pathname.startsWith('/ui/') || url.pathname.startsWith('/modules/') || url.pathname.startsWith('/admin/chat')) {
    event.respondWith(fetch(`${PREFIX}${url.pathname}${url.search}`));
  }
});
