let dismissTimer;

export function showEditorFeedback(message, { kind = 'success', detail = '' } = {}) {
  if (typeof document === 'undefined') return;
  if (kind === 'success') {
    if (/已载入/.test(message)) message = '已载入';
    else if (/已应用$/.test(message)) message = '已应用';
    else if (/已保存/.test(message)) message = '已保存';
    else if (/调整/.test(message)) message = '已调整';
    else if (/已创建/.test(message)) message = '已创建';
    else if (/恢复/.test(message)) message = '已恢复';
    else if (/回收站/.test(message)) message = '已移除';
    else if (/已更新/.test(message)) message = '已更新';
    detail = '';
  }
  let box = document.getElementById('admin-action-feedback');
  if (!box) {
    box = document.createElement('span');
    box.id = 'admin-action-feedback';
    box.className = 'admin-action-feedback';
  }
  const toolbar = document.getElementById('canvas-toolbar');
  if (toolbar && box.parentElement !== toolbar) toolbar.prepend(box);
  else if (!box.parentElement) document.querySelector('.admin-actions')?.prepend(box);
  box.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  box.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
  box.dataset.kind = kind;
  // Success feedback is a single short line; errors retain actionable details.
  box.textContent = kind === 'error' && detail && !message.includes(detail) ? `${message}：${detail}` : message;
  box.title = box.textContent;
  box.hidden = false;
  clearTimeout(dismissTimer);
  dismissTimer = setTimeout(() => { box.hidden = true; }, kind === 'error' ? 7000 : 3000);
}

export function installEditorFeedback() {
  const initialValues = new WeakMap();
  const immediate = element => element instanceof Element && element.matches('[data-path], [data-edit-path], [contenteditable="true"], .puck-work-heading-fields input, .puck-work-heading-fields select, .puck-text-style-inline input, .puck-text-style-inline select');
  const read = element => element.matches('[contenteditable="true"]') ? element.textContent : element.type === 'checkbox' ? String(element.checked) : element.value;
  document.addEventListener('focusin', event => {
    if (immediate(event.target)) initialValues.set(event.target, read(event.target));
  });
  document.addEventListener('focusout', event => {
    const element = event.target;
    if (!immediate(element) || !initialValues.has(element) || initialValues.get(element) === read(element)) return;
    if (element.checkValidity && !element.checkValidity()) return;
    // Validation and the editor's commit handlers run before reporting success.
    requestAnimationFrame(() => {
      const feedback = document.querySelector('#admin-action-feedback');
      if (!feedback || feedback.hidden || feedback.dataset.kind !== 'error') showEditorFeedback('已更新草稿');
    });
  });
  document.addEventListener('change', event => {
    const element = event.target;
    if (!immediate(element) || !element.matches('select,input[type=checkbox],input[type=radio]')) return;
    initialValues.set(element, read(element));
    requestAnimationFrame(() => {
      const feedback = document.querySelector('#admin-action-feedback');
      if (!feedback || feedback.hidden || feedback.dataset.kind !== 'error') showEditorFeedback('已更新草稿');
    });
  });
  document.addEventListener('invalid' , () => showEditorFeedback('请检查输入内容', { kind: 'error', detail: '标记的字段不符合要求，尚未应用。' }), true);
}
