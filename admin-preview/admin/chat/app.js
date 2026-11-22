import {
  renderActiveMessages,
  renderConversationHeader,
  renderSessionList,
} from '/admin/chat/render.js';

const STORAGE_KEY = 'nts_admin_chat_auth_v1';
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];

const state = {
  agentId: '',
  agentName: '',
  token: '',
  ws: null,
  reconnectAttempt: 0,
  reconnectTimer: 0,
  manualLogout: false,
  onlineAgentsCount: 0,
  filter: 'all',
  sessions: new Map(),
  messagesBySession: new Map(),
  activeSessionId: '',
  typingStopTimer: 0,
  visitorTypingTimers: new Map(),
};

const byId = (id) => document.getElementById(id);
const el = {
  loginGate: byId('loginGate'),
  devAuthHint: byId('devAuthHint'),
  loginForm: byId('loginForm'),
  agentNameInput: byId('agentNameInput'),
  tokenInput: byId('tokenInput'),
  loginError: byId('loginError'),
  loginSubmitBtn: byId('loginSubmitBtn'),
  workbench: byId('workbench'),
  connPill: byId('connPill'),
  connText: byId('connText'),
  agentsOnlinePill: byId('agentsOnlinePill'),
  currentAgentPill: byId('currentAgentPill'),
  logoutBtn: byId('logoutBtn'),
  refreshBtn: byId('refreshBtn'),
  sessionList: byId('sessionList'),
  emptySessions: byId('emptySessions'),
  noActiveSession: byId('noActiveSession'),
  activeConversation: byId('activeConversation'),
  convOnlineDot: byId('convOnlineDot'),
  convTitle: byId('convTitle'),
  convLocaleTag: byId('convLocaleTag'),
  convClaimTag: byId('convClaimTag'),
  convPagePath: byId('convPagePath'),
  convSearchSummary: byId('convSearchSummary'),
  claimBtn: byId('claimBtn'),
  messageStream: byId('messageStream'),
  visitorTypingBar: byId('visitorTypingBar'),
  quickRepliesBar: byId('quickRepliesBar'),
  replyForm: byId('replyForm'),
  replyInput: byId('replyInput'),
};

function readSavedAuth() {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSavedAuth(auth) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  } catch {
    // 忽略隐私浏览限制
  }
}

function clearSavedAuth() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略隐私浏览限制
  }
}

async function fetchWithRetry(url, init, timeoutMs = 6000, retries = 1) {
  let lastErr = null;
  for (let i = 0; i <= retries; i += 1) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      window.clearTimeout(timer);
      return res;
    } catch (err) {
      window.clearTimeout(timer);
      lastErr = err;
    }
  }
  throw lastErr || new Error('网络请求超时');
}

function sendWs(payload) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(payload));
  }
}

function selectSession(sessionId) {
  state.activeSessionId = sessionId;
  el.noActiveSession.hidden = true;
  el.activeConversation.hidden = false;
  el.visitorTypingBar.hidden = true;
  renderSessionList(state, el, selectSession);
  renderConversationHeader(state, el);
  renderActiveMessages(state, el);
  sendWs({ type: 'agent:open', sessionId });
  el.replyInput.focus();
}

function upsertSessionMessage(sessionId, msg) {
  const list = state.messagesBySession.get(sessionId) || [];
  const idx = list.findIndex(
    (m) => m.id === msg.id || (msg.clientMsgId && m.clientMsgId === msg.clientMsgId),
  );
  if (idx >= 0) list[idx] = msg;
  else list.push(msg);
  state.messagesBySession.set(sessionId, list);
  if (sessionId === state.activeSessionId) {
    el.visitorTypingBar.hidden = true;
    renderActiveMessages(state, el);
  }
}

function handleServerEvent(event) {
  if (!event || typeof event !== 'object') return;
  if (event.type === 'agent:snapshot') {
    state.agentId = event.agentId;
    state.agentName = event.agentName;
    state.onlineAgentsCount = event.onlineAgentsCount;
    writeSavedAuth({ agentId: state.agentId, agentName: state.agentName, token: state.token });
    el.currentAgentPill.textContent = `当前顾问: ${state.agentName}`;
    el.agentsOnlinePill.textContent = `在线顾问: ${state.onlineAgentsCount}`;
    state.sessions.clear();
    for (const s of event.sessions || []) state.sessions.set(s.id, s);
    renderSessionList(state, el, selectSession);
    if (state.activeSessionId && state.sessions.has(state.activeSessionId)) {
      renderConversationHeader(state, el);
    }
    return;
  }
  if (event.type === 'presence') {
    state.onlineAgentsCount = event.onlineAgentsCount;
    el.agentsOnlinePill.textContent = `在线顾问: ${state.onlineAgentsCount}`;
    return;
  }
  if (event.type === 'session:updated' && event.session) {
    state.sessions.set(event.session.id, event.session);
    renderSessionList(state, el, selectSession);
    if (event.session.id === state.activeSessionId) renderConversationHeader(state, el);
    return;
  }
  if (event.type === 'session:detail' && event.session) {
    const s = event.session;
    state.messagesBySession.set(s.id, Array.isArray(s.messages) ? s.messages : []);
    if (s.id === state.activeSessionId) {
      renderConversationHeader(state, el);
      renderActiveMessages(state, el);
    }
    return;
  }
  if (event.type === 'session:claimed') {
    const existing = state.sessions.get(event.sessionId);
    if (existing) {
      existing.claimedByAgentId = event.agentId;
      existing.claimedByAgentName = event.agentName;
      state.sessions.set(event.sessionId, existing);
    }
    upsertSessionMessage(event.sessionId, {
      id: `sys_${event.sessionId}_${event.agentId}_${Date.now()}`,
      sessionId: event.sessionId,
      role: 'system',
      text: `会话已由顾问「${event.agentName}」认领`,
      createdAt: Date.now(),
    });
    renderSessionList(state, el, selectSession);
    if (event.sessionId === state.activeSessionId) renderConversationHeader(state, el);
    return;
  }
  if (event.type === 'message:ack' && event.message) {
    upsertSessionMessage(event.message.sessionId, event.message);
    return;
  }
  if (event.type === 'message:new' && event.message) {
    upsertSessionMessage(event.sessionId, event.message);
    if (event.sessionId === state.activeSessionId && event.message.role === 'visitor') {
      sendWs({ type: 'agent:read', sessionId: event.sessionId });
    }
    return;
  }
  if (event.type === 'typing' && event.role === 'visitor') {
    if (event.sessionId === state.activeSessionId) el.visitorTypingBar.hidden = !event.isTyping;
    window.clearTimeout(state.visitorTypingTimers.get(event.sessionId));
    if (event.isTyping) {
      const t = window.setTimeout(() => {
        if (event.sessionId === state.activeSessionId) el.visitorTypingBar.hidden = true;
      }, 3500);
      state.visitorTypingTimers.set(event.sessionId, t);
    }
  }
}

async function requestAgentWsTicket(agentName, token) {
  const res = await fetchWithRetry('/chat/agent/ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ agentName }),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: Boolean(res.ok && data?.ok && data?.ticket), data };
}

function scheduleAgentReconnect() {
  if (state.manualLogout) return;
  el.connPill.dataset.state = 'disconnected';
  el.connText.textContent = '连接中断 · 重连中';
  const delay = RECONNECT_DELAYS_MS[Math.min(state.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
  state.reconnectAttempt += 1;
  state.reconnectTimer = window.setTimeout(() => { void connectAgentWs(); }, delay);
}

async function connectAgentWs(prefetchedTicket = '') {
  window.clearTimeout(state.reconnectTimer);
  if (state.manualLogout) return;
  el.connPill.dataset.state = 'connecting';
  el.connText.textContent = '正在连接…';
  let ticket = prefetchedTicket;
  if (!ticket) {
    try {
      const ticketRes = await requestAgentWsTicket(state.agentName, state.token);
      if (ticketRes.status === 401) {
        state.manualLogout = true;
        clearSavedAuth();
        el.workbench.hidden = true;
        el.loginGate.hidden = false;
        el.loginError.textContent = ticketRes.data?.error || '管理令牌已失效，请重新登录';
        el.loginError.hidden = false;
        return;
      }
      if (!ticketRes.ok) { scheduleAgentReconnect(); return; }
      ticket = ticketRes.data.ticket;
    } catch {
      scheduleAgentReconnect();
      return;
    }
  }
  if (state.manualLogout) return;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${proto}//${window.location.host}/ws/chat?role=agent&ticket=${encodeURIComponent(ticket)}`);
  state.ws = ws;
  ws.addEventListener('open', () => {
    state.reconnectAttempt = 0;
    el.connPill.dataset.state = 'connected';
    el.connText.textContent = '实时已连接';
    sendWs({ type: 'agent:hello', ...(state.agentId ? { agentId: state.agentId } : {}), agentName: state.agentName });
    if (state.activeSessionId) sendWs({ type: 'agent:open', sessionId: state.activeSessionId });
  });
  ws.addEventListener('message', (evt) => {
    if (typeof evt.data !== 'string') return;
    try { handleServerEvent(JSON.parse(evt.data)); } catch (err) { console.warn('[admin/chat] 解析异常', err); }
  });
  ws.addEventListener('close', scheduleAgentReconnect);
}

function enterWorkbench(agentName, token, agentId = '', prefetchedTicket = '') {
  state.agentName = agentName;
  state.token = token;
  state.agentId = agentId;
  state.manualLogout = false;
  el.loginGate.hidden = true;
  el.workbench.hidden = false;
  void connectAgentWs(prefetchedTicket);
}

el.loginForm.addEventListener('submit', async (evt) => {
  evt.preventDefault();
  el.loginError.hidden = true;
  const agentName = el.agentNameInput.value.trim();
  const token = el.tokenInput.value.trim();
  if (!agentName || !token) {
    el.loginError.textContent = '请填写顾问名称与管理令牌';
    el.loginError.hidden = false;
    return;
  }
  el.loginSubmitBtn.disabled = true;
  try {
    const ticketRes = await requestAgentWsTicket(agentName, token);
    if (!ticketRes.ok) {
      el.loginError.textContent = ticketRes.data?.error || '管理令牌校验未通过';
      el.loginError.hidden = false;
      return;
    }
    writeSavedAuth({ agentName, token, agentId: state.agentId });
    enterWorkbench(agentName, token, state.agentId, ticketRes.data.ticket);
  } catch {
    el.loginError.textContent = '无法连接客服服务，请确认 dev:chat 正在运行';
    el.loginError.hidden = false;
  } finally {
    el.loginSubmitBtn.disabled = false;
  }
});

el.logoutBtn.addEventListener('click', () => {
  state.manualLogout = true;
  window.clearTimeout(state.reconnectTimer);
  state.ws?.close(1000, 'logout');
  clearSavedAuth();
  el.workbench.hidden = true;
  el.loginGate.hidden = false;
});

el.refreshBtn.addEventListener('click', () => sendWs({ type: 'agent:sync' }));

document.querySelectorAll('[data-filter]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.filter = btn.dataset.filter || 'all';
    document.querySelectorAll('[data-filter]').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    renderSessionList(state, el, selectSession);
  });
});

el.claimBtn.addEventListener('click', () => {
  if (state.activeSessionId) sendWs({ type: 'agent:claim', sessionId: state.activeSessionId });
});

el.quickRepliesBar.addEventListener('click', (evt) => {
  const chip = evt.target.closest('[data-quick]');
  if (!chip) return;
  el.replyInput.value = chip.dataset.quick || '';
  el.replyInput.focus();
});

function submitReply() {
  const text = el.replyInput.value.trim();
  if (!text || !state.activeSessionId) return;
  const clientMsgId = `ac_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  sendWs({ type: 'agent:message', sessionId: state.activeSessionId, clientMsgId, text });
  sendWs({ type: 'agent:typing', sessionId: state.activeSessionId, isTyping: false });
  el.replyInput.value = '';
}

el.replyForm.addEventListener('submit', (evt) => {
  evt.preventDefault();
  submitReply();
});

el.replyInput.addEventListener('keydown', (evt) => {
  if (evt.key === 'Enter' && !evt.shiftKey && !evt.isComposing) {
    evt.preventDefault();
    submitReply();
  }
});

el.replyInput.addEventListener('input', () => {
  if (!state.activeSessionId) return;
  sendWs({ type: 'agent:typing', sessionId: state.activeSessionId, isTyping: true });
  window.clearTimeout(state.typingStopTimer);
  state.typingStopTimer = window.setTimeout(() => {
    if (state.activeSessionId) sendWs({ type: 'agent:typing', sessionId: state.activeSessionId, isTyping: false });
  }, 1800);
});

const saved = readSavedAuth();
if (saved?.agentName && saved?.token) {
  el.agentNameInput.value = saved.agentName;
  enterWorkbench(saved.agentName, saved.token, saved.agentId || '');
} else {
  fetchWithRetry('/api/chat/health', { method: 'GET' }, 4000, 0)
    .then((r) => r.json())
    .then((d) => {
      if (d?.localDevAuthHint) el.devAuthHint.hidden = false;
    })
    .catch(() => {});
}
