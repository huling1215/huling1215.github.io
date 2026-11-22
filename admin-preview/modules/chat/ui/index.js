import { adminApi } from '/ui/kit/index.js';

export async function mount(container) {
  container.innerHTML = '';
  const info = await adminApi.get('/chat/info');

  const head = Object.assign(document.createElement('div'), { className: 'adm-section-head' });
  const title = Object.assign(document.createElement('h2'), { textContent: '实时在线客服顾问工作台' });
  const openTab = Object.assign(document.createElement('a'), {
    href: info.chatUrl,
    target: '_blank',
    rel: 'noopener noreferrer',
    className: 'adm-btn adm-btn--outline',
    textContent: '在新窗口独立打开工作台 ↗',
  });
  head.append(title, openTab);

  const frame = Object.assign(document.createElement('iframe'), {
    src: info.chatUrl,
    title: '在线客服顾问工作台',
    className: 'adm-chat-iframe',
  });
  container.append(head, frame);
}
