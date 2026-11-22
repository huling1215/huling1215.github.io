// HTML 转义工具：所有拼接进 innerHTML 的动态内容都必须经过这里，
// 防止提交说明、显示名、条目名等用户可控文本被当作 HTML 执行（存储型 XSS）。

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

class SafeHtml {
  constructor(value) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

function renderInterpolation(value) {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(renderInterpolation).join('');
  if (value === false || value === null || value === undefined) return '';
  return escapeHtml(value);
}

/**
 * 标签模板：插值默认全部转义；嵌套的 html`` 片段或其数组按原样拼接。
 * 用法：el.innerHTML = html`<strong>${name}</strong>${items.map((i) => html`<li>${i}</li>`)}`;
 */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) {
    out += renderInterpolation(values[i]) + strings[i + 1];
  }
  return new SafeHtml(out);
}

/** 仅用于代码内写死的可信 HTML 常量，禁止传入任何用户或接口数据。 */
export function trustedHtml(value) {
  return new SafeHtml(String(value ?? ''));
}
