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
    form.addEventListener('keydown', event => {
      if (event.key === 'Enter' && event.target.name === 'new_category_name') {
        event.preventDefault();
        form.requestSubmit(form.querySelector('[name="category_action"]'));
      }
    });
    form.addEventListener('change', event => {
      if (event.target.name === 'category' && ['other_expense', 'other_income'].includes(event.target.value)) {
        const creator = form.querySelector('[data-category-creator]');
        if (creator) creator.open = true;
      }
    });
    // Category actions share the transaction form, so partially entered values
    // survive both AJAX updates and ordinary HTML form submissions.
    form.addEventListener('submit', async event => {
      const button = event.submitter;
      if (!button || !['category_action', 'delete_category'].includes(button.name)) return;
      event.preventDefault();
      if (form.dataset.categoryBusy === 'true' || form.querySelector('[type="submit"][name="submit"]').disabled) return;
      if (button.name === 'delete_category' && !window.confirm('このカテゴリを選択肢から削除しますか？ 過去の収支と集計は残ります。')) return;
      const data = new FormData(form);
      data.append(button.name, button.value);
      form.dataset.categoryBusy = 'true';
      button.disabled = true;
      const status = form.querySelector('[data-category-status]');
      status.textContent = 'カテゴリを保存しています…';
      try {
        const response = await fetch(form.action, {method: 'POST', body: data});
        const page = new DOMParser().parseFromString(await response.text(), 'text/html');
        const main = page.querySelector('main');
        if (!response.ok || !main?.querySelector('[data-transaction-form]')) throw new Error('category save failed');
        document.querySelector('main').replaceWith(main);
        setupTransactionForms();
        const nextForm = document.querySelector('[data-transaction-form]');
        const nextStatus = nextForm.querySelector('[data-category-status]');
        const error = nextForm.querySelector('[role="alert"]');
        (error ? nextForm.querySelector('[name="new_category_name"]') : nextForm.querySelector('[name="category"]:checked') || nextStatus).focus();
      } catch (error) {
        status.textContent = 'カテゴリの保存結果を確認できません。画面を再読み込みして確認してください。';
        form.dataset.categoryBusy = 'false';
        button.disabled = false;
      }
    });
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
    if (event.defaultPrevented) return;
    event.preventDefault();
    if (form.dataset?.categoryBusy === 'true') return;
    const submit = form.querySelector('[type="submit"][name="submit"]');
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
