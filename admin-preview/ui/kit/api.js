let csrfTokenState = '';
let onUnauthorizedCallback = null;

export function setCsrfToken(token) {
  csrfTokenState = typeof token === 'string' ? token : '';
}

export function getCsrfToken() {
  return csrfTokenState;
}

export function onAdminUnauthorized(fn) {
  onUnauthorizedCallback = fn;
}

export async function adminRequest(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };
  let body = options.body;

  if (method !== 'GET' && method !== 'HEAD' && csrfTokenState) {
    headers['X-CSRF-Token'] = csrfTokenState;
  }
  if (body !== undefined && !(body instanceof FormData) && typeof body !== 'string') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const url = path.startsWith('/api/') ? path : `/api/admin${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers,
    body,
    credentials: 'same-origin',
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok || !payload || payload.success === false) {
    if (res.status === 401 && onUnauthorizedCallback && !path.includes('/auth/login')) {
      onUnauthorizedCallback();
    }
    const message = payload?.error || `请求失败（HTTP ${res.status}）`;
    const err = new Error(message);
    err.statusCode = res.status;
    err.code = payload?.code || 'API_ERROR';
    throw err;
  }

  return payload.data;
}

export const adminApi = {
  get: (path) => adminRequest(path, { method: 'GET' }),
  post: (path, body) => adminRequest(path, { method: 'POST', body }),
  put: (path, body) => adminRequest(path, { method: 'PUT', body }),
  patch: (path, body) => adminRequest(path, { method: 'PATCH', body }),
  del: (path, body) => adminRequest(path, { method: 'DELETE', body }),
};

export function bindAsyncButton(buttonEl, asyncAction, options = {}) {
  if (!buttonEl) return;
  const idleText = options.idleLabel || buttonEl.textContent || '提交';
  const loadingText = options.loadingLabel || '处理中…';
  const retryPrefix = options.retryLabel || '失败，点击重试';

  buttonEl.addEventListener('click', async (event) => {
    if (buttonEl.disabled) return;
    buttonEl.disabled = true;
    buttonEl.dataset.state = 'loading';
    buttonEl.textContent = loadingText;
    try {
      await asyncAction(event);
      buttonEl.dataset.state = 'idle';
      buttonEl.textContent = idleText;
    } catch (err) {
      buttonEl.dataset.state = 'error';
      buttonEl.textContent = retryPrefix;
      buttonEl.title = err instanceof Error ? err.message : '操作失败';
      if (typeof options.onError === 'function') options.onError(err);
    } finally {
      buttonEl.disabled = false;
    }
  });
}
