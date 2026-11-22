import { adminApi, bindAsyncButton, renderDataTable, showToast } from '/ui/kit/index.js';

function canonicalNode(rawPath) {
  const clean = String(rawPath || '').split(/[?#]/)[0].trim() || '/';
  if (clean === '/') return '/';
  const noSlash = clean.replace(/\/+$/, '');
  return /\.[a-z0-9]+$/i.test(noSlash) ? noSlash : `${noSlash}/`;
}

function checkClientRedirectError(rules) {
  const map = new Map();
  for (const r of rules) {
    if (!r.from?.startsWith('/')) return `源路径必须以 / 开头：${r.from}`;
    if (!r.to?.startsWith('/') && !/^https?:\/\//i.test(r.to || '')) {
      return `目标路径必须以 / 或 http(s):// 开头：${r.to}`;
    }
    if (!String(r.reason || '').trim()) return `规则 ${r.from} 必须填写跳转原因`;
    const fromKey = canonicalNode(r.from);
    if (map.has(fromKey)) return `存在重复的源路径：${r.from}`;
    const toKey = r.to.startsWith('/') ? canonicalNode(r.to) : '';
    if (toKey && fromKey === toKey) return `禁止自跳转：${r.from} -> ${r.to}`;
    map.set(fromKey, toKey);
  }
  for (const start of map.keys()) {
    const seen = new Set([start]);
    let cur = map.get(start);
    while (cur && map.has(cur)) {
      if (seen.has(cur)) return `检测到循环跳转链路：${[...seen, cur].join(' -> ')}`;
      seen.add(cur);
      cur = map.get(cur);
    }
  }
  return '';
}

function buildAddRuleForm(rules, canWrite, onMutate) {
  const box = Object.assign(document.createElement('div'), { className: 'redir-add-box' });
  const makeField = (label, el) => {
    const f = Object.assign(document.createElement('div'), { className: 'adm-field' });
    f.append(Object.assign(document.createElement('label'), { className: 'adm-label', textContent: label }), el);
    return f;
  };
  const fromIn = Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', placeholder: '/guides/old-slug/', disabled: !canWrite });
  const toIn = Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', placeholder: '/guides/new-slug/', disabled: !canWrite });
  const codeSel = Object.assign(document.createElement('select'), { className: 'adm-input', disabled: !canWrite });
  codeSel.append(
    Object.assign(document.createElement('option'), { value: '301', textContent: '301 永久' }),
    Object.assign(document.createElement('option'), { value: '302', textContent: '302 临时' }),
  );
  const reasonIn = Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', placeholder: '例如：攻略合并改名保留权重', disabled: !canWrite });
  const addBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline', textContent: '+ 添加规则', disabled: !canWrite });

  addBtn.addEventListener('click', () => {
    const candidate = {
      from: fromIn.value.trim(),
      to: toIn.value.trim(),
      code: Number(codeSel.value) === 302 ? 302 : 301,
      createdAt: new Date().toISOString().slice(0, 10),
      reason: reasonIn.value.trim(),
    };
    const errMsg = checkClientRedirectError([...rules, candidate]);
    if (errMsg) { showToast(errMsg, 'error'); return; }
    rules.push(candidate);
    fromIn.value = ''; toIn.value = ''; reasonIn.value = '';
    onMutate();
  });

  box.append(makeField('源路径 (from)', fromIn), makeField('目标路径 (to)', toIn), makeField('状态码', codeSel), makeField('跳转原因 (必填)', reasonIn), addBtn);
  return box;
}

function renderRedirectTable(tableHost, rules, canWrite, redraw) {
  renderDataTable(tableHost, {
    rows: rules,
    emptyText: '当前暂无 301/302 跳转规则',
    filterPlaceholder: '按源路径、目标路径或原因筛选…',
    columns: [
      { key: 'from', label: '源路径 (from)' },
      { key: 'to', label: '目标路径 (to)' },
      { key: 'code', label: '状态码' },
      { key: 'reason', label: '跳转原因' },
      { key: 'createdAt', label: '创建日期' },
      {
        key: 'op',
        label: '操作',
        sortable: false,
        render: (row) => {
          const delBtn = Object.assign(document.createElement('button'), {
            type: 'button', className: 'adm-btn adm-btn--ghost adm-btn--sm', textContent: '移除', disabled: !canWrite,
          });
          delBtn.addEventListener('click', () => {
            const idx = rules.indexOf(row);
            if (idx >= 0) rules.splice(idx, 1);
            redraw();
          });
          return delBtn;
        },
      },
    ],
  });
}

export async function renderRedirectsPane(hostEl, shellCtx, canWrite) {
  hostEl.innerHTML = '<p class="adm-muted">正在读取 redirects.yaml…</p>';
  const data = await adminApi.get(`/seo/redirects?siteId=${encodeURIComponent(shellCtx.siteId)}`);
  const rules = Array.isArray(data.rules) ? structuredClone(data.rules) : [];

  const redraw = () => {
    hostEl.innerHTML = '';
    const bar = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
    bar.appendChild(Object.assign(document.createElement('span'), {
      className: 'adm-muted',
      textContent: `配置文件：${data.relPath}（共 ${rules.length} 条；修改条目 slug 时将自动通过 onSlugRename 追加 301）`,
    }));

    const saveGroup = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
    const noteIn = Object.assign(document.createElement('input'), { type: 'text', className: 'adm-input', placeholder: '提交说明（选填）', disabled: !canWrite });
    const saveBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--primary', textContent: '保存跳转规则并提交 Git', disabled: !canWrite });
    bindAsyncButton(saveBtn, async () => {
      const errMsg = checkClientRedirectError(rules);
      if (errMsg) throw new Error(errMsg);
      const saved = await adminApi.put('/seo/redirects', { siteId: shellCtx.siteId, rules, message: noteIn.value.trim() });
      showToast(`已保存 ${saved.rules.length} 条跳转规则（提交 ${saved.commitHash.slice(0, 8)}）`, 'success');
      await shellCtx.refreshShell();
    }, { onError: (err) => showToast(err.message || '保存失败', 'error') });
    saveGroup.append(noteIn, saveBtn);
    bar.appendChild(saveGroup);

    const tableHost = document.createElement('div');
    renderRedirectTable(tableHost, rules, canWrite, redraw);
    hostEl.append(bar, buildAddRuleForm(rules, canWrite, redraw), tableHost);
  };
  redraw();
}
