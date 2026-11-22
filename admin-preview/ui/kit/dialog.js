import { bindAsyncButton } from './api.js';
import { showToast } from './toast.js';

function buildDialogBodyAndFoot(options, close) {
  const body = document.createElement('div');
  body.className = 'adm-dialog__body';
  if (typeof options.renderBody === 'function') options.renderBody(body);
  else if (options.message) {
    const p = document.createElement('p');
    p.textContent = options.message;
    body.appendChild(p);
  }

  const footer = document.createElement('div');
  footer.className = 'adm-dialog__foot';
  const cancelBtn = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'adm-btn adm-btn--outline',
    textContent: options.cancelLabel || '取消',
  });
  cancelBtn.addEventListener('click', close);
  footer.appendChild(cancelBtn);

  if (typeof options.onConfirm === 'function') {
    const okBtn = Object.assign(document.createElement('button'), {
      type: 'button',
      className: `adm-btn ${options.danger ? 'adm-btn--danger' : 'adm-btn--primary'}`,
      textContent: options.confirmLabel || '确认',
    });
    bindAsyncButton(
      okBtn,
      async () => {
        await options.onConfirm({ close, body });
        close();
      },
      { onError: (err) => showToast(err.message || '操作失败', 'error') },
    );
    footer.appendChild(okBtn);
  }
  return { body, footer };
}

export function openDialog(options = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'adm-dialog-backdrop';
  const close = () => backdrop.remove();

  const card = document.createElement('div');
  card.className = 'adm-dialog';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'adm-dialog__head';
  const titleEl = Object.assign(document.createElement('h3'), { textContent: options.title || '操作窗口' });
  const closeBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--ghost', textContent: '关闭' });
  closeBtn.addEventListener('click', close);
  header.append(titleEl, closeBtn);

  const { body, footer } = buildDialogBodyAndFoot(options, close);
  card.append(header, body, footer);
  backdrop.appendChild(card);
  document.body.appendChild(backdrop);
  return { close, body };
}

export function confirmAction({ title = '请确认操作', message, confirmLabel = '确认执行', danger = false }) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (val) => { if (!settled) { settled = true; resolve(val); } };
    const dlg = openDialog({ title, message, confirmLabel, danger, onConfirm: async () => finish(true) });
    dlg.body.closest('.adm-dialog')?.addEventListener('click', (e) => {
      if (e.target.textContent === '取消' || e.target.textContent === '关闭') finish(false);
    });
  });
}
