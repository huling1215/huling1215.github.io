import { openDialog } from './dialog.js';

let customMediaPickerProvider = null;

export function registerMediaPickerProvider(providerFn) {
  customMediaPickerProvider = typeof providerFn === 'function' ? providerFn : null;
}

export function openMediaPicker(options = {}) {
  if (customMediaPickerProvider) {
    return customMediaPickerProvider(options);
  }

  return new Promise((resolve) => {
    let inputEl;
    openDialog({
      title: options.title || '选择或输入图片路径',
      confirmLabel: '确认选用',
      renderBody: (body) => {
        const hint = document.createElement('p');
        hint.className = 'adm-muted';
        hint.textContent = '请输入相对图片路径（媒体库模块接入后可直接可视化点选图片）：';
        inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.className = 'adm-input';
        inputEl.value = options.currentValue || '';
        inputEl.placeholder = '例如：./cover.jpg';
        body.append(hint, inputEl);
      },
      onConfirm: async () => {
        resolve(inputEl.value.trim() || null);
      },
    });
  });
}
