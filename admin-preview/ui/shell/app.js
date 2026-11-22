import '/modules/media/ui/picker.js';
import {
  adminApi,
  bindAsyncButton,
  onAdminUnauthorized,
  openDialog,
  renderForm,
  setCsrfToken,
  showToast,
  html,
} from '/ui/kit/index.js';

const shellState = {
  user: null,
  modules: [],
  sites: [],
  siteId: 'powderclub',
  activeModuleId: '',
  aiStatus: { configured: false, reason: '' },
};

function renderSidebarNav(navEl, modules, activeId, onSelect) {
  navEl.innerHTML = '';
  const groups = new Map();
  for (const mod of modules) {
    const g = mod.navGroup || '日常运营';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(mod);
  }
  for (const [groupName, items] of groups.entries()) {
    const sec = Object.assign(document.createElement('div'), { className: 'adm-nav-group' });
    sec.appendChild(Object.assign(document.createElement('div'), { className: 'adm-nav-group__title', textContent: groupName }));
    for (const item of items) {
      const btn = Object.assign(document.createElement('button'), {
        type: 'button',
        className: `adm-nav-link ${item.id === activeId ? 'is-active' : ''}`,
        textContent: item.title,
      });
      btn.dataset.moduleId = item.id;
      btn.addEventListener('click', () => onSelect(item.id));
      sec.appendChild(btn);
    }
    navEl.appendChild(sec);
  }
}

function syncAiQuickButtons() {
  const genBtn = document.getElementById('btnGenerate');
  const trBtn = document.getElementById('btnTranslate');
  const stBtn = document.getElementById('btnTransStatus');
  const aiOk = Boolean(shellState.aiStatus?.configured);
  const reason = shellState.aiStatus?.reason || '未配置 AI 环境变量';

  if (genBtn) {
    genBtn.disabled = !aiOk;
    genBtn.title = reason;
    genBtn.onclick = () => navigateToModule(shellState.modules.some((m) => m.id === 'ai-studio') ? 'ai-studio' : 'content');
  }
  if (trBtn) {
    trBtn.disabled = !aiOk;
    trBtn.title = reason;
    trBtn.onclick = () => navigateToModule(shellState.modules.some((m) => m.id === 'translations') ? 'translations' : 'content');
  }
  if (stBtn) {
    stBtn.onclick = () => navigateToModule(shellState.modules.some((m) => m.id === 'translations') ? 'translations' : 'content');
  }
}

async function navigateToModule(moduleId) {
  const viewport = document.getElementById('admModuleViewport');
  const target = shellState.modules.find((m) => m.id === moduleId) || shellState.modules[0];
  if (!target) {
    viewport.innerHTML = '<p class="adm-muted">当前账号暂无可用后台模块。</p>';
    return;
  }
  shellState.activeModuleId = target.id;
  window.location.hash = `#${target.id}`;
  renderSidebarNav(document.getElementById('admNavList'), shellState.modules, target.id, navigateToModule);

  if (!target.uiEntry) {
    viewport.innerHTML = html`<div class="adm-alert adm-alert--warn">模块「${target.title}」前端视图尚未加载。</div>`;
    return;
  }
  try {
    const mod = await import(target.uiEntry);
    const mountFn = mod.mount || mod.default;
    await mountFn(viewport, {
      siteId: shellState.siteId,
      user: shellState.user,
      aiStatus: shellState.aiStatus,
      refreshShell: refreshSessionState,
      navigate: navigateToModule,
    });
  } catch (err) {
    viewport.innerHTML = html`<p class="adm-field__error">加载模块失败：${err.message || '未知错误'}</p>`;
  }
}

function populateTopbar(meData) {
  const siteSel = document.getElementById('admSiteSelect');
  siteSel.innerHTML = '';
  for (const s of meData.sites || []) {
    siteSel.appendChild(Object.assign(document.createElement('option'), {
      value: s.siteId,
      textContent: `${s.brandNameZh} (${s.siteId})`,
      selected: s.siteId === shellState.siteId,
    }));
  }
  document.getElementById('admPendingCount').textContent = String(meData.pendingChanges?.count ?? 0);
  document.getElementById('admCurrentUser').textContent = `${meData.user.displayName} [${meData.user.roles.join(',')}]`;
  syncAiQuickButtons();
}

async function refreshSessionState() {
  const gate = document.getElementById('admLoginGate');
  const shell = document.getElementById('admAppShell');
  const me = await adminApi.get(`/auth/me?siteId=${encodeURIComponent(shellState.siteId)}`);

  if (!me.authenticated) {
    gate.hidden = false;
    shell.hidden = true;
    document.getElementById('admInitHint').hidden = Boolean(me.hasUsers);
    return;
  }

  setCsrfToken(me.csrfToken);
  shellState.user = me.user;
  shellState.modules = me.modules || [];
  shellState.sites = me.sites || [];
  shellState.aiStatus = me.aiStatus || { configured: false, reason: '' };
  if (shellState.sites.length > 0 && !shellState.sites.some((s) => s.siteId === shellState.siteId)) {
    shellState.siteId = shellState.sites[0].siteId;
  }

  gate.hidden = true;
  shell.hidden = false;
  populateTopbar(me);

  const hashId = window.location.hash.replace(/^#/, '');
  await navigateToModule(hashId || shellState.activeModuleId || shellState.modules[0]?.id || '');
}

function bindAccountControls() {
  document.getElementById('admChangePwdBtn').addEventListener('click', () => {
    openDialog({
      title: '修改个人登录密码',
      renderBody: (body) =>
        renderForm(body, {
          submitLabel: '确认修改密码',
          fields: [
            { name: 'currentPassword', label: '当前密码', type: 'password', required: true },
            { name: 'newPassword', label: '新密码（至少 8 位）', type: 'password', required: true },
          ],
          onSubmit: async (vals) => {
            await adminApi.post('/auth/password', vals);
            showToast('密码修改成功', 'success');
            body.closest('.adm-dialog-backdrop')?.remove();
          },
        }),
    });
  });

  bindAsyncButton(document.getElementById('admLogoutBtn'), async () => {
    await adminApi.post('/auth/logout', {});
    setCsrfToken('');
    await refreshSessionState();
  });

  onAdminUnauthorized(() => {
    setCsrfToken('');
    document.getElementById('admLoginGate').hidden = false;
    document.getElementById('admAppShell').hidden = true;
  });
}

function bindShellControls() {
  const errEl = document.getElementById('admLoginError');
  bindAsyncButton(
    document.getElementById('admLoginSubmit'),
    async () => {
      errEl.hidden = true;
      const username = document.getElementById('admLoginUser').value.trim();
      const password = document.getElementById('admLoginPass').value;
      const data = await adminApi.post('/auth/login', { username, password });
      setCsrfToken(data.csrfToken);
      document.getElementById('admLoginPass').value = '';
      await refreshSessionState();
    },
    {
      loadingLabel: '正在验证…',
      onError: (err) => { errEl.textContent = err.message; errEl.hidden = false; },
    },
  );

  document.getElementById('admSiteSelect').addEventListener('change', async (e) => {
    shellState.siteId = e.target.value;
    await refreshSessionState();
  });

  document.getElementById('admPendingBanner').addEventListener('click', () => {
    if (shellState.modules.some((m) => m.id === 'release')) navigateToModule('release');
    else showToast('发布中心模块（A1）接入后在此一键发布上线', 'info');
  });

  bindAccountControls();
}

bindShellControls();
refreshSessionState().catch((err) => showToast(err.message || '初始化失败', 'error'));
