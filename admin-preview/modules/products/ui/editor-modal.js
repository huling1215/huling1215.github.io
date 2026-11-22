import { adminApi, bindAsyncButton, showToast } from '/ui/kit/index.js';
import { fieldBox, h } from './dom-helpers.js';
import { renderPackageFormFields } from './package-fields.js';
import { renderStayFormFields } from './stay-fields.js';

function drawPromotionBox(boxEl, promo, canPublish, promoteBtn) {
  boxEl.innerHTML = '';
  const eligible = Boolean(promo?.eligible);
  boxEl.className = `prd-promo-box ${eligible ? 'is-ready' : ''}`;

  const statusText = eligible
    ? canPublish
      ? '✓ 已满足全部转正条件，可点击下方「转正并上线」设为正式上线产品'
      : '✓ 已满足转正条件（当前账号为编辑角色，保存后请交由审核或管理员上线）'
    : '⚠ 当前为示例/草稿要求核验：尚未满足全部转正条件，“转正并上线”已锁定';
  boxEl.appendChild(h('strong', { textContent: `转正上线检查面板 · ${statusText}` }));

  const ul = h('ul', { className: 'prd-promo-list' });
  for (const chk of promo?.checks || []) {
    const icon = h('span', {
      className: `adm-badge ${chk.passed ? 'adm-badge--reviewed' : 'adm-badge--missing'}`,
      textContent: chk.passed ? '✓ 已满足' : '✕ 待完善',
    });
    ul.appendChild(h('li', { className: 'prd-promo-item' }, [icon, h('strong', { textContent: `${chk.label}：` }), h('span', { textContent: chk.hint })]));
  }
  boxEl.appendChild(ul);

  if (!eligible && promo?.missingRequirements?.length) {
    boxEl.appendChild(h('p', { className: 'adm-field__error', style: 'margin-top:8px', textContent: `阻断原因：${promo.missingRequirements.join('；')}` }));
  }
  promoteBtn.disabled = !(eligible && canPublish);
  promoteBtn.title = !canPublish
    ? '当前账号缺少 products:publish 权限'
    : !eligible
      ? '请先补齐上方转正检查缺失项'
      : '满足全部转正条件，点击设为正式上线';
}

async function triggerReleaseAfterSave(saved, shellCtx) {
  await shellCtx.refreshShell();
  try {
    await adminApi.post('/release/run', { siteId: shellCtx.siteId });
    showToast(`已保存提交 ${saved.commitHash.slice(0, 8)} 并触发整站发布任务`, 'success');
    shellCtx.navigate('release');
  } catch (err) {
    const shortSha = saved.commitHash.slice(0, 8);
    if (err?.statusCode === 404 || err?.code === 'ROUTE_NOT_FOUND') {
      window.location.hash = '#release';
      showToast(`已生成 Git 提交 ${shortSha}；发布中心合并后可一键触发整站发布`, 'info');
    } else if (err?.statusCode === 403) {
      window.location.hash = '#release';
      showToast(`已生成 Git 提交 ${shortSha}；当前账号无发布权限，请由发布角色执行上线`, 'info');
    } else {
      throw err;
    }
  }
}

function createModeSwitcher(formHost, advHost, jsonArea, getDraft) {
  const basicBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm is-active', textContent: '结构化表单模式' });
  const jsonBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '高级模式（JSON）' });
  basicBtn.addEventListener('click', () => {
    formHost.hidden = false;
    advHost.hidden = true;
    basicBtn.classList.add('is-active');
    jsonBtn.classList.remove('is-active');
  });
  jsonBtn.addEventListener('click', () => {
    jsonArea.value = JSON.stringify(getDraft(), null, 2);
    formHost.hidden = true;
    advHost.hidden = false;
    jsonBtn.classList.add('is-active');
    basicBtn.classList.remove('is-active');
  });
  return h('div', { className: 'adm-inline-actions' }, [basicBtn, jsonBtn]);
}

function buildSaveExecutor(st, shellCtx, noteInp) {
  return async (promoteFlag) => {
    const payload = st.advHost.hidden ? st.draft : JSON.parse(st.jsonArea.value);
    const slug = String(payload.slug || '').trim();
    if (!slug) throw new Error('请先填写合法的产品标识 Slug');
    const path = st.isCreate
      ? `/products/entries/${st.collection}`
      : `/products/entries/${st.collection}/${encodeURIComponent(slug)}`;
    const method = st.isCreate ? 'post' : 'put';
    return adminApi[method](path, {
      siteId: shellCtx.siteId,
      slug,
      data: payload,
      promote: promoteFlag,
      message: noteInp.value.trim(),
    });
  };
}

function mountEditorActions({ st, meta, shellCtx, noteInp, promoBtn, saveBtn, savePubBtn, onBack }) {
  const canPublish = Boolean(meta.permissions?.canPublish);
  const executeSave = buildSaveExecutor(st, shellCtx, noteInp);

  bindAsyncButton(saveBtn, async () => {
    const saved = await executeSave(false);
    showToast(`已保存并生成 Git 提交 ${saved.commitHash.slice(0, 8)}`, 'success');
    await shellCtx.refreshShell();
    await onBack();
  }, { onError: (e) => showToast(e.message, 'error') });

  bindAsyncButton(promoBtn, async () => {
    const saved = await executeSave(true);
    showToast(`已转正上线并生成提交 ${saved.commitHash.slice(0, 8)}`, 'success');
    await shellCtx.refreshShell();
    await onBack();
  }, {
    onError: (e) => {
      showToast(e.message, 'error');
      window.setTimeout(() => st.refreshPromo(), 50);
    },
  });

  bindAsyncButton(savePubBtn, async () => {
    const saved = await executeSave(st.draft.sample === false && canPublish);
    await triggerReleaseAfterSave(saved, shellCtx);
    await onBack();
  }, { onError: (e) => showToast(e.message, 'error') });
}

function createEditorFooterCard(noteInp, saveBtn, promoBtn, savePubBtn, onBack) {
  return h('div', { className: 'prd-card' }, [
    fieldBox('本次提交备注（Git Commit 说明）', noteInp),
    h('div', { className: 'adm-inline-actions', style: 'justify-content:flex-end; margin-top:10px' }, [
      h('button', { type: 'button', className: 'adm-btn adm-btn--ghost', textContent: '取消', onClick: onBack }),
      saveBtn,
      promoBtn,
      savePubBtn,
    ]),
  ]);
}

export async function renderProductEditorView(container, { collection, initialData, initialPromo, isCreate, meta, shellCtx, onBack }) {
  container.innerHTML = '';
  const canPublish = Boolean(meta.permissions?.canPublish);
  const draft = structuredClone(initialData);
  const colLabel = collection === 'stays' ? '酒店（stays）' : '套餐（packages）';

  const backBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '← 返回产品列表', onClick: onBack });
  const promoBox = h('div', { className: 'prd-promo-box' });
  const formHost = h('div');
  const jsonArea = h('textarea', { className: 'adm-textarea adm-code', rows: 20 });
  const advHost = h('div', { className: 'prd-card', hidden: true }, [fieldBox('完整 JSON 数据（高级模式）', jsonArea)]);
  const noteInp = h('input', { type: 'text', className: 'adm-input', placeholder: '选填：写入本次 Git 提交说明' });
  const saveBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--outline', textContent: canPublish ? '保存修改（Git 提交）' : '保存草稿（Git 提交）' });
  const promoBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--primary', textContent: '转正并上线', disabled: true });
  const savePubBtn = h('button', { type: 'button', className: 'adm-btn adm-btn--primary', textContent: '保存并发布' });

  let debounceTimer = null;
  const refreshPromo = async () => {
    try { drawPromotionBox(promoBox, await adminApi.post('/products/promotion-check', { siteId: shellCtx.siteId, collection, data: draft }), canPublish, promoBtn); } catch { /* ignore */ }
  };
  const onDraftChange = (recheckNow = false) => {
    if (!advHost.hidden) jsonArea.value = JSON.stringify(draft, null, 2);
    if (debounceTimer) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(refreshPromo, recheckNow ? 120 : 380);
  };

  if (collection === 'stays') renderStayFormFields(formHost, { draft, meta, isCreate, onDraftChange });
  else renderPackageFormFields(formHost, { draft, meta, isCreate, onDraftChange });
  drawPromotionBox(promoBox, initialPromo || { eligible: false, checks: [] }, canPublish, promoBtn);
  if (!initialPromo) await refreshPromo();

  mountEditorActions({ st: { collection, draft, isCreate, advHost, jsonArea, refreshPromo }, meta, shellCtx, noteInp, promoBtn, saveBtn, savePubBtn, onBack });
  const topHead = h('div', { className: 'adm-section-head' }, [
    h('div', { className: 'adm-inline-actions' }, [backBtn, h('h2', { textContent: `${isCreate ? '新建' : '编辑'}${colLabel} · ${draft.slug || '新条目'}` })]),
    createModeSwitcher(formHost, advHost, jsonArea, () => draft),
  ]);
  container.append(topHead, promoBox, formHost, advHost, createEditorFooterCard(noteInp, saveBtn, promoBtn, savePubBtn, onBack));
}
