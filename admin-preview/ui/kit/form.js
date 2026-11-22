import { bindAsyncButton } from './api.js';
import { showToast } from './toast.js';

function createControlElement(field, initialVal) {
  if (field.type === 'select') {
    const sel = Object.assign(document.createElement('select'), { className: 'adm-input' });
    for (const opt of field.options || []) {
      const o = Object.assign(document.createElement('option'), { value: String(opt.value), textContent: opt.label });
      if (String(initialVal ?? '') === o.value) o.selected = true;
      sel.appendChild(o);
    }
    return sel;
  }
  if (field.type === 'textarea') {
    return Object.assign(document.createElement('textarea'), {
      className: 'adm-textarea',
      rows: field.rows || 4,
      value: String(initialVal ?? ''),
      placeholder: field.placeholder || '',
    });
  }
  if (field.type === 'checkbox') {
    return Object.assign(document.createElement('input'), { type: 'checkbox', checked: Boolean(initialVal) });
  }
  return Object.assign(document.createElement('input'), {
    type: field.type || 'text',
    className: 'adm-input',
    value: String(initialVal ?? ''),
    placeholder: field.placeholder || '',
  });
}

function readControlValue(field, control) {
  if (field.type === 'checkbox') return Boolean(control.checked);
  if (field.type === 'number') return control.value === '' ? null : Number(control.value);
  return control.value.trim();
}

async function validateAndSubmitForm(controls, errorEls, onSubmit) {
  let hasErr = false;
  const values = {};
  for (const [name, { field, ctrl }] of controls.entries()) {
    const val = readControlValue(field, ctrl);
    values[name] = val;
    const errNode = errorEls.get(name);
    let msg = '';
    if (field.required && (val === '' || val === null || val === undefined)) {
      msg = `请填写「${field.label}」`;
    } else if (typeof field.validate === 'function') {
      msg = field.validate(val, values) || '';
    }
    errNode.textContent = msg;
    errNode.hidden = !msg;
    if (msg) hasErr = true;
  }
  if (hasErr) throw new Error('表单存在未通过校验的字段，请按红色提示修正');
  if (typeof onSubmit === 'function') await onSubmit(values);
}

export function renderForm(container, options = {}) {
  const fields = options.fields || [];
  const initialValues = options.initialValues || {};
  container.innerHTML = '';

  const form = Object.assign(document.createElement('form'), { className: 'adm-form', noValidate: true });
  const controls = new Map();
  const errorEls = new Map();

  for (const field of fields) {
    const row = Object.assign(document.createElement('div'), { className: 'adm-field' });
    const label = Object.assign(document.createElement('label'), { className: 'adm-label', textContent: `${field.label}${field.required ? ' *' : ''}` });
    const ctrl = createControlElement(field, initialValues[field.name]);
    ctrl.name = field.name;
    const err = Object.assign(document.createElement('p'), { className: 'adm-field__error', hidden: true });
    row.append(label, ctrl, err);
    if (field.hint) row.appendChild(Object.assign(document.createElement('small'), { className: 'adm-muted', textContent: field.hint }));
    form.appendChild(row);
    controls.set(field.name, { field, ctrl });
    errorEls.set(field.name, err);
  }

  const submitBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--primary', textContent: options.submitLabel || '保存更改' });
  form.appendChild(submitBtn);
  bindAsyncButton(submitBtn, () => validateAndSubmitForm(controls, errorEls, options.onSubmit), {
    onError: (err) => showToast(err.message || '保存失败', 'error'),
  });
  container.appendChild(form);
  return { form, submitBtn };
}
