import {
  adminApi,
  bindAsyncButton,
  confirmAction,
  showToast,
} from '/ui/kit/index.js';
import { ensureWizardStyles } from './contrast.js';
import { renderStep4, renderStep5 } from './steps-advanced.js';
import { renderStep1, renderStep2, renderStep3 } from './steps-basic.js';
import { renderStep6, renderStep7 } from './steps-launch.js';

const STEP_TITLES = [
  '1. 品牌与ID',
  '2. 品类与语种',
  '3. 站点主题色',
  '4. 模板与部署',
  '5. 批量选题',
  '6. 一键初始化',
  '7. 上线待办',
];

function buildFreshDraftClient(meta) {
  return {
    draftId: '',
    currentStep: 1,
    status: 'draft',
    step1: {
      siteId: '',
      brandName: { 'zh-CN': '', en: '', 'zh-Hant': '', ja: '', ko: '' },
      url: '',
      deployMode: 'domain',
      basePath: '',
    },
    logo: null,
    step2: {
      vertical: 'ski',
      locales: [...(meta.locales || ['zh-CN', 'en', 'zh-Hant', 'ja', 'ko'])],
      defaultLocale: 'zh-CN',
      currencies: [...(meta.currencies || ['CNY', 'USD', 'HKD', 'TWD', 'JPY', 'KRW'])],
    },
    step3: { ...(meta.defaultTheme || { primary: '#1d1e33', accent: '#db1212', ink: '#2a2b3d', surface: '#ffffff', fontPreset: 'editorial' }) },
    step4: { templateMode: 'copy', templateSiteId: 'powderclub', deploy: null },
    step5: { briefs: [] },
    scaffoldCommitHash: null,
    bootstrapJobId: null,
  };
}

function buildDeleteDraftButton(state, reloadAll) {
  const delBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--ghost adm-btn--sm',
    textContent: '删除当前草稿',
    disabled: !state.draft.draftId,
  });
  delBtn.addEventListener('click', () => {
    if (!state.draft.draftId) return;
    confirmAction('确定删除当前未完成的向导草稿吗？（不影响已提交到 Git 的站点）', async () => {
      await adminApi.del(`/site-wizard/drafts/${encodeURIComponent(state.draft.draftId)}`);
      state.draft = buildFreshDraftClient(state.meta);
      showToast('已删除向导草稿', 'info');
      await reloadAll();
    });
  });
  return delBtn;
}

function renderDraftBar(barEl, state, reloadAll) {
  barEl.innerHTML = '';
  barEl.appendChild(Object.assign(document.createElement('strong'), { textContent: '向导草稿箱：' }));
  const sel = Object.assign(document.createElement('select'), { className: 'adm-input' });
  sel.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: '— 未保存的新向导会话 —', selected: !state.draft.draftId }));
  for (const d of state.draftList) {
    sel.appendChild(Object.assign(document.createElement('option'), {
      value: d.draftId,
      textContent: `${d.brandNameZh || d.siteId || d.draftId} [第${d.currentStep}步 · ${d.vertical}]`,
      selected: d.draftId === state.draft.draftId,
    }));
  }
  sel.addEventListener('change', async () => {
    state.draft = sel.value
      ? (await adminApi.get(`/site-wizard/drafts/${encodeURIComponent(sel.value)}`)).draft
      : buildFreshDraftClient(state.meta);
    await state.paintCurrent();
  });

  const newBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '+ 新建向导' });
  newBtn.addEventListener('click', async () => {
    state.draft = buildFreshDraftClient(state.meta);
    await state.paintCurrent();
  });
  barEl.append(sel, newBtn, buildDeleteDraftButton(state, reloadAll));
}

function renderStepperBar(stepEl, state) {
  stepEl.innerHTML = '';
  STEP_TITLES.forEach((label, idx) => {
    const stepNo = idx + 1;
    const cls = state.draft.currentStep === stepNo ? 'is-active' : stepNo < state.draft.currentStep ? 'is-done' : '';
    const btn = Object.assign(document.createElement('button'), { type: 'button', className: `wz-step-btn ${cls}`, textContent: label });
    btn.addEventListener('click', async () => {
      state.draft.currentStep = stepNo;
      await state.paintCurrent();
    });
    stepEl.appendChild(btn);
  });
}

function buildNextStepButton(step, state) {
  const nextBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--primary',
    textContent: '保存草稿并下一步 →',
  });
  bindAsyncButton(
    nextBtn,
    async () => {
      const checkStep = step <= 5 ? step : 0;
      state.draft.currentStep = step + 1;
      await state.ensureDraftSaved(checkStep);
      await state.paintCurrent();
    },
    {
      loadingLabel: '正在校验保存…',
      onError: (err) => {
        state.draft.currentStep = step;
        showToast(err.message, 'error');
      },
    },
  );
  return nextBtn;
}

function renderFooterBar(footEl, state) {
  footEl.innerHTML = '';
  const step = state.draft.currentStep;
  const prevBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--outline',
    textContent: '← 上一步',
    disabled: step <= 1,
  });
  prevBtn.addEventListener('click', async () => {
    state.draft.currentStep = Math.max(1, step - 1);
    await state.paintCurrent();
  });

  const right = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const saveDraftBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline', textContent: '随时保存草稿' });
  bindAsyncButton(
    saveDraftBtn,
    async () => {
      await state.ensureDraftSaved(0);
      showToast('向导草稿已保存，下次打开可随时继续', 'success');
    },
    { loadingLabel: '正在保存…', onError: (e) => showToast(e.message, 'error') },
  );
  right.appendChild(saveDraftBtn);
  if (step < 7) right.appendChild(buildNextStepButton(step, state));
  footEl.append(prevBtn, right);
}

async function dispatchStepRender(stepHost, state) {
  stepHost.innerHTML = '';
  const s = state.draft.currentStep;
  if (s === 1) renderStep1(stepHost, state);
  else if (s === 2) renderStep2(stepHost, state);
  else if (s === 3) renderStep3(stepHost, state);
  else if (s === 4) renderStep4(stepHost, state);
  else if (s === 5) renderStep5(stepHost, state);
  else if (s === 6) renderStep6(stepHost, state);
  else await renderStep7(stepHost, state);
}

function createWizardUiState(meta, shellCtx, draftList, initialDraft, uiRefs) {
  const reloadAll = async () => {
    state.draftList = (await adminApi.get('/site-wizard/drafts')).items || [];
    await state.paintCurrent();
  };
  const state = {
    meta,
    shellCtx,
    draftList,
    draft: initialDraft,
    ensureDraftSaved: async (validateStep = 0) => {
      const hasId = Boolean(state.draft.draftId);
      const path = hasId ? `/site-wizard/drafts/${encodeURIComponent(state.draft.draftId)}` : '/site-wizard/drafts';
      const res = await adminApi[hasId ? 'put' : 'post'](path, { draft: state.draft, validateStep });
      state.draft = res.draft;
      state.draftList = (await adminApi.get('/site-wizard/drafts')).items || [];
      renderDraftBar(uiRefs.draftBar, state, reloadAll);
      return state.draft;
    },
    paintCurrent: async () => {
      renderDraftBar(uiRefs.draftBar, state, reloadAll);
      renderStepperBar(uiRefs.stepperBar, state);
      await dispatchStepRender(uiRefs.stepHost, state);
      renderFooterBar(uiRefs.footerBar, state);
    },
  };
  return state;
}

export async function mount(container, shellCtx) {
  ensureWizardStyles();
  container.innerHTML = '';
  const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  head.appendChild(Object.assign(document.createElement('h2'), { textContent: '新站向导（自助开站与多品类主题配置）' }));

  const uiRefs = {
    draftBar: Object.assign(document.createElement('div'), { className: 'wz-bar' }),
    stepperBar: Object.assign(document.createElement('div'), { className: 'wz-steps' }),
    stepHost: document.createElement('div'),
    footerBar: Object.assign(document.createElement('div'), { className: 'wz-foot' }),
  };
  container.append(head, uiRefs.draftBar, uiRefs.stepperBar, uiRefs.stepHost, uiRefs.footerBar);

  const [meta, draftsRes] = await Promise.all([adminApi.get('/site-wizard/meta'), adminApi.get('/site-wizard/drafts')]);
  const firstId = draftsRes.items?.[0]?.draftId || '';
  const initialDraft = firstId
    ? (await adminApi.get(`/site-wizard/drafts/${encodeURIComponent(firstId)}`)).draft
    : buildFreshDraftClient(meta);

  const state = createWizardUiState(meta, shellCtx, draftsRes.items || [], initialDraft, uiRefs);
  await state.paintCurrent();
}
