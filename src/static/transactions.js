function setupTransactionForms() {
  document.querySelectorAll('[data-transaction-form]').forEach(form => {
    const kind = form.querySelector('[name="kind"]');
    function updateCategories(clear) {
      form.querySelectorAll('.category-option[data-kind]').forEach(option => {
        const radio = option.querySelector('input');
        const active = option.dataset.kind === kind.value;
        option.hidden = !active;
        radio.disabled = !active;
        if (clear || !active) radio.checked = false;
      });
    }
    kind.addEventListener('change', () => updateCategories(true));
    updateCategories(false);
  });
  const panel = document.getElementById('add-panel');
  if (!panel) return;
  const summary = panel.querySelector('summary');
  document.getElementById('cancel-add').addEventListener('click', () => {
    panel.open = false;
    summary.focus();
  });
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      panel.open = false;
      summary.focus();
    }
  });
  const form = panel.querySelector('form');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    if (submit.disabled) return;
    const data = new FormData(form);
    submit.disabled = true;
    const status = document.getElementById('save-status');
    status.textContent = '保存しています…';
    try {
      const response = await fetch(form.action, {method: 'POST', body: data});
      const page = new DOMParser().parseFromString(await response.text(), 'text/html');
      const main = page.querySelector('main');
      if (!response.ok || !main?.querySelector('#add-panel')) {
        throw new Error('save failed');
      }
      document.querySelector('main').replaceWith(main);
      setupTransactionForms();
      const nextPanel = document.getElementById('add-panel');
      document.getElementById('save-status').textContent = nextPanel.open ? '入力内容を確認してください。' : '収支を追加しました。';
      if (nextPanel.open) nextPanel.querySelector('[name="kind"]').focus();
      else nextPanel.querySelector('summary').focus();
    } catch (error) {
      status.textContent = '保存結果を確認できません。一覧を確認してから再度操作してください。ログイン期限が切れた場合は再ログインしてください。';
      submit.disabled = false;
    }
  });
}
setupTransactionForms();
