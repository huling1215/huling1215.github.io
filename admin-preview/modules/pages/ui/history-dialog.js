import {
  adminApi,
  bindAsyncButton,
  openDialog,
  renderDiffView,
  showToast,
} from '/ui/kit/index.js';

function promptRevertWithReason(siteId, pageId, isLegal, commitHash, onReverted) {
  let reasonInput = null;
  openDialog({
    title: `确认恢复历史版本 · ${commitHash.slice(0, 8)}`,
    confirmLabel: '确认恢复并生成提交',
    renderBody: (body) => {
      body.appendChild(
        Object.assign(document.createElement('p'), {
          textContent: `即将把页面「${pageId}」恢复至历史提交 ${commitHash.slice(0, 8)}，并生成一次新的 Git 提交记录。`,
        }),
      );
      const wrap = Object.assign(document.createElement('div'), { className: 'adm-field' });
      wrap.appendChild(
        Object.assign(document.createElement('label'), {
          className: 'adm-label',
          textContent: isLegal ? '法务回滚说明（必填）' : '恢复备注（选填）',
        }),
      );
      reasonInput = Object.assign(document.createElement('input'), {
        type: 'text',
        className: 'adm-input',
        placeholder: isLegal ? '请说明回滚该法务版本的原因…' : '例如：回退误改段落',
      });
      wrap.appendChild(reasonInput);
      body.appendChild(wrap);
    },
    onConfirm: async () => {
      const reason = reasonInput ? reasonInput.value.trim() : '';
      if (isLegal && !reason) {
        throw new Error('回滚法务页面（隐私政策、服务条款）时必须填写修改说明');
      }
      const res = await adminApi.post(`/pages/${encodeURIComponent(pageId)}/revert`, {
        siteId,
        commit: commitHash,
        changeReason: reason,
      });
      showToast(`已恢复历史版本并生成提交 ${res.commitHash.slice(0, 8)}`, 'success');
      await onReverted();
    },
  });
}

export async function openPageHistoryDialog({ siteId, pageId, label, isLegal, onReverted }) {
  const res = await adminApi.get(
    `/pages/${encodeURIComponent(pageId)}/history?siteId=${encodeURIComponent(siteId)}`,
  );
  openDialog({
    title: `修改记录 · ${label} (${pageId})`,
    cancelLabel: '关闭窗口',
    renderBody: (body) => {
      const commits = res.commits || [];
      if (commits.length === 0) {
        body.appendChild(
          Object.assign(document.createElement('p'), {
            className: 'adm-muted',
            textContent: '当前页面暂无 Git 历史提交记录。',
          }),
        );
        return;
      }
      for (const c of commits) {
        const row = Object.assign(document.createElement('div'), { className: 'adm-history-row' });
        const meta = document.createElement('div');
        const headLine = document.createElement('div');
        headLine.append(
          Object.assign(document.createElement('strong'), { textContent: c.commit.slice(0, 8) }),
          document.createTextNode(` · ${c.authorName} · `),
          Object.assign(document.createElement('span'), {
            className: 'adm-muted',
            textContent: String(c.date || '').slice(0, 19).replace('T', ' '),
          }),
        );
        const subj = Object.assign(document.createElement('div'), { textContent: c.subject });
        meta.append(headLine, subj);

        const actions = Object.assign(document.createElement('div'), { className: 'adm-inline-actions' });
        const diffBtn = Object.assign(document.createElement('button'), {
          type: 'button',
          className: 'adm-btn adm-btn--outline adm-btn--sm',
          textContent: '对比当前版本',
        });
        const revBtn = Object.assign(document.createElement('button'), {
          type: 'button',
          className: 'adm-btn adm-btn--outline adm-btn--sm',
          textContent: '恢复此版本',
        });

        bindAsyncButton(diffBtn, async () => {
          const d = await adminApi.get(
            `/pages/${encodeURIComponent(pageId)}/diff?siteId=${encodeURIComponent(siteId)}&from=${encodeURIComponent(c.commit)}&to=HEAD`,
          );
          openDialog({
            title: `版本差异对比 · ${c.commit.slice(0, 8)} → HEAD`,
            cancelLabel: '关闭',
            renderBody: (diffHost) => renderDiffView(diffHost, d.diff),
          });
        });

        revBtn.addEventListener('click', () => {
          body.closest('.adm-dialog-backdrop')?.remove();
          promptRevertWithReason(siteId, pageId, isLegal, c.commit, onReverted);
        });

        actions.append(diffBtn, revBtn);
        row.append(meta, actions);
        body.appendChild(row);
      }
    },
  });
}
