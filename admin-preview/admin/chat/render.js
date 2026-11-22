export function formatTime(ts) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(ts));
  } catch {
    return '';
  }
}

export function formatSearchSummary(search) {
  if (!search) return '';
  const parts = [];
  if (search.dest) parts.push(`目的地: ${search.dest}`);
  if (search.from || search.to) parts.push(`日期: ${search.from || '?'} ~ ${search.to || '?'}`);
  if (search.cat) parts.push(`品类: ${search.cat}`);
  if (typeof search.pax === 'number') parts.push(`${search.pax}人`);
  return parts.join(' · ');
}

function getFilteredSessions(state) {
  const arr = Array.from(state.sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  if (state.filter === 'unread') return arr.filter((s) => s.unreadCount > 0);
  if (state.filter === 'mine') return arr.filter((s) => s.claimedByAgentId === state.agentId);
  return arr;
}

export function renderSessionList(state, el, onSelectSession) {
  const items = getFilteredSessions(state);
  el.sessionList.replaceChildren();
  el.emptySessions.hidden = items.length > 0;

  for (const s of items) {
    const li = document.createElement('li');
    li.className = `session-item${s.id === state.activeSessionId ? ' is-active' : ''}`;
    li.addEventListener('click', () => onSelectSession(s.id));

    const topRow = document.createElement('div');
    topRow.className = 'session-row-top';

    const idWrap = document.createElement('div');
    idWrap.className = 'session-id-wrap';

    const dot = document.createElement('span');
    dot.className = `visitor-dot${s.visitorOnline ? ' is-online' : ''}`;
    dot.title = s.visitorOnline ? '访客在线' : '访客已离线';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = `访客 #${s.id.slice(-6)}`;
    idWrap.append(dot, titleSpan);
    topRow.appendChild(idWrap);

    if (s.unreadCount > 0) {
      const badge = document.createElement('span');
      badge.className = 'unread-badge';
      badge.textContent = String(s.unreadCount);
      topRow.appendChild(badge);
    }

    const badgesRow = document.createElement('div');
    badgesRow.className = 'session-badges';

    const localeTag = document.createElement('span');
    localeTag.className = 'tag tag-locale';
    localeTag.textContent = s.context.locale;

    const claimTag = document.createElement('span');
    claimTag.className = s.claimedByAgentName ? 'tag tag-claim' : 'tag tag-unclaimed';
    claimTag.textContent = s.claimedByAgentName ? `已认领: ${s.claimedByAgentName}` : '待认领';
    badgesRow.append(localeTag, claimTag);

    const pathDiv = document.createElement('div');
    pathDiv.className = 'session-path';
    pathDiv.textContent = s.context.pagePath || '/';

    li.append(topRow, badgesRow, pathDiv);

    const searchText = formatSearchSummary(s.context.search);
    if (searchText) {
      const searchDiv = document.createElement('div');
      searchDiv.className = 'session-search';
      searchDiv.textContent = searchText;
      li.appendChild(searchDiv);
    }

    if (s.lastMessage) {
      const preview = document.createElement('div');
      preview.className = 'session-preview';
      preview.textContent = `${formatTime(s.lastMessage.createdAt)} · ${s.lastMessage.text}`;
      li.appendChild(preview);
    }

    el.sessionList.appendChild(li);
  }
}

export function renderConversationHeader(state, el) {
  const s = state.sessions.get(state.activeSessionId);
  if (!s) return;
  el.convOnlineDot.className = `visitor-dot${s.visitorOnline ? ' is-online' : ''}`;
  el.convTitle.textContent = `访客 #${s.id.slice(-6)}${s.context.pageTitle ? ` · ${s.context.pageTitle}` : ''}`;
  el.convLocaleTag.textContent = s.context.locale;
  el.convClaimTag.className = s.claimedByAgentName ? 'tag tag-claim' : 'tag tag-unclaimed';
  el.convClaimTag.textContent = s.claimedByAgentName
    ? `认领顾问: ${s.claimedByAgentName}`
    : '尚未认领';
  el.convPagePath.textContent = `来源: ${s.context.url || s.context.pagePath}`;
  el.convSearchSummary.textContent = formatSearchSummary(s.context.search);
  const claimedByMe = s.claimedByAgentId === state.agentId;
  el.claimBtn.disabled = claimedByMe;
  el.claimBtn.textContent = claimedByMe ? '已由我认领' : '认领会话';
}

export function renderActiveMessages(state, el) {
  const list = state.messagesBySession.get(state.activeSessionId) || [];
  el.messageStream.replaceChildren();

  for (const msg of list) {
    const row = document.createElement('div');
    row.className = `msg-row msg-row--${msg.role}`;

    if (msg.role === 'system') {
      const pill = document.createElement('span');
      pill.className = 'msg-system-pill';
      pill.textContent = msg.text;
      row.appendChild(pill);
    } else {
      const meta = document.createElement('span');
      meta.className = 'msg-meta';
      const who = msg.role === 'agent' ? msg.senderName || '顾问' : '访客';
      meta.textContent = `${who} · ${formatTime(msg.createdAt)}`;

      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble';
      bubble.textContent = msg.text;
      row.append(meta, bubble);
    }
    el.messageStream.appendChild(row);
  }
  el.messageStream.scrollTop = el.messageStream.scrollHeight;
}
