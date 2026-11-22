export const MODULE_META = {
  upcomingDepartures: {
    label: '近期团期日历',
    hint: '对应首页近期出发团期卡片（最多展示 3 张，按套餐 slug 置顶）',
  },
  hotResorts: {
    label: '热门雪场卡片网格',
    hint: '对应首页 4 张带封面雪场商品卡（按雪场 slug 置顶）',
  },
  featuredResorts: {
    label: '精选雪场参数速查表',
    hint: '对应首页精选雪场对比速查表（最多 6 行，可置顶任意雪场）',
  },
  featuredGuides: {
    label: '近期实测攻略',
    hint: '对应首页 3 篇精选攻略卡片（按攻略 slug 置顶）',
  },
  collections: {
    label: '主题合集推荐',
    hint: '对应首页 3 个主题合集卡片（按合集 slug 置顶）',
  },
};

function renderPinnedChips(rule, candidateMap, canWrite, onMutate) {
  const wrap = Object.assign(document.createElement('div'), { className: 'cur-pin-chips' });
  const slugs = rule.pinnedSlugs || [];
  if (slugs.length === 0) {
    wrap.appendChild(Object.assign(document.createElement('span'), { className: 'adm-muted', textContent: '当前未设置手动置顶，按默认规则自动排序。' }));
    return wrap;
  }
  slugs.forEach((slug, idx) => {
    const title = candidateMap.get(slug) || slug;
    const chip = Object.assign(document.createElement('span'), { className: 'cur-pin-chip' });
    chip.appendChild(Object.assign(document.createElement('span'), { textContent: `${idx + 1}. ${title} (${slug})` }));
    if (canWrite) {
      const upBtn = Object.assign(document.createElement('button'), { type: 'button', textContent: '←', title: '前移', disabled: idx === 0 });
      const rmBtn = Object.assign(document.createElement('button'), { type: 'button', textContent: '×', title: '移除置顶' });
      upBtn.addEventListener('click', () => {
        [slugs[idx - 1], slugs[idx]] = [slugs[idx], slugs[idx - 1]];
        onMutate();
      });
      rmBtn.addEventListener('click', () => {
        rule.pinnedSlugs = slugs.filter((s) => s !== slug);
        onMutate();
      });
      chip.append(upBtn, rmBtn);
    }
    wrap.appendChild(chip);
  });
  return wrap;
}

function renderPinPicker(rule, candidates, canWrite, onMutate) {
  const row = Object.assign(document.createElement('div'), { className: 'cur-pin-picker' });
  const select = Object.assign(document.createElement('select'), { className: 'adm-input', disabled: !canWrite });
  select.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: '挑选要置顶到最前的条目…' }));
  const pinnedSet = new Set(rule.pinnedSlugs || []);
  for (const item of candidates) {
    if (pinnedSet.has(item.slug)) continue;
    const suffix = item.status === 'offline' ? ' [草稿]' : '';
    select.appendChild(Object.assign(document.createElement('option'), { value: item.slug, textContent: `${item.titleZh} (${item.slug})${suffix}` }));
  }
  const addBtn = Object.assign(document.createElement('button'), {
    type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '+ 添加置顶', disabled: !canWrite,
  });
  addBtn.addEventListener('click', () => {
    const val = select.value.trim();
    if (!val) return;
    rule.pinnedSlugs = [...(rule.pinnedSlugs || []), val];
    onMutate();
  });
  row.append(select, addBtn);
  return row;
}

function buildModuleCardHeader(modId, idx, total, rule, canWrite, state, rerender) {
  const meta = MODULE_META[modId] || { label: modId };
  const head = Object.assign(document.createElement('div'), { className: 'cur-mod-head' });
  const left = Object.assign(document.createElement('div'), { className: 'cur-mod-handle' });
  left.append(
    Object.assign(document.createElement('span'), { className: 'cur-mod-order-badge', textContent: String(idx + 1) }),
    Object.assign(document.createElement('span'), { textContent: `☰ ${meta.label}` }),
    Object.assign(document.createElement('small'), { className: 'adm-muted', textContent: `(${modId})` }),
  );
  const controls = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
  const hideLabel = Object.assign(document.createElement('label'), { className: 'adm-inline-actions adm-muted' });
  const hideCheck = Object.assign(document.createElement('input'), { type: 'checkbox', checked: Boolean(rule.hidden), disabled: !canWrite });
  hideCheck.addEventListener('change', () => { rule.hidden = hideCheck.checked; rerender(); });
  hideLabel.append(hideCheck, document.createTextNode('隐藏模块'));

  const upBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '↑', disabled: !canWrite || idx === 0 });
  const downBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '↓', disabled: !canWrite || idx === total - 1 });
  upBtn.addEventListener('click', () => { [state.moduleOrder[idx - 1], state.moduleOrder[idx]] = [state.moduleOrder[idx], state.moduleOrder[idx - 1]]; rerender(); });
  downBtn.addEventListener('click', () => { [state.moduleOrder[idx + 1], state.moduleOrder[idx]] = [state.moduleOrder[idx], state.moduleOrder[idx + 1]]; rerender(); });
  controls.append(hideLabel, upBtn, downBtn);
  head.append(left, controls);
  return head;
}

export function renderModuleList(hostEl, state, candidatesByMod, canWrite) {
  hostEl.innerHTML = '';
  const dragBox = { fromIdx: -1 };
  const rerender = () => renderModuleList(hostEl, state, candidatesByMod, canWrite);

  state.moduleOrder.forEach((modId, idx) => {
    const meta = MODULE_META[modId] || { label: modId, hint: '' };
    if (!state.modules[modId]) state.modules[modId] = { hidden: false, pinnedSlugs: [] };
    const rule = state.modules[modId];
    const candidates = candidatesByMod[modId] || [];
    const candidateMap = new Map(candidates.map((c) => [c.slug, c.titleZh]));

    const card = Object.assign(document.createElement('div'), {
      className: `cur-mod-card ${rule.hidden ? 'is-hidden' : ''}`,
      draggable: canWrite,
    });
    card.dataset.moduleId = modId;
    if (canWrite) {
      card.addEventListener('dragstart', () => { dragBox.fromIdx = idx; });
      card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('is-drag-over'); });
      card.addEventListener('dragleave', () => card.classList.remove('is-drag-over'));
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('is-drag-over');
        if (dragBox.fromIdx < 0 || dragBox.fromIdx === idx) return;
        const [moved] = state.moduleOrder.splice(dragBox.fromIdx, 1);
        state.moduleOrder.splice(idx, 0, moved);
        dragBox.fromIdx = -1;
        rerender();
      });
    }
    card.append(
      buildModuleCardHeader(modId, idx, state.moduleOrder.length, rule, canWrite, state, rerender),
      Object.assign(document.createElement('div'), { className: 'adm-muted', textContent: meta.hint }),
      renderPinnedChips(rule, candidateMap, canWrite, rerender),
      renderPinPicker(rule, candidates, canWrite, rerender),
    );
    hostEl.appendChild(card);
  });
}
