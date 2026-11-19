(() => {
  const form = document.getElementById('receipt-review-form');
  if (!form) return;
  const rows = document.getElementById('receipt-rows');
  const scan = document.getElementById('receipt-scan');
  const fileInput = document.getElementById('receipt-file');
  const cameraStart = document.getElementById('receipt-camera-start');
  const video = document.getElementById('receipt-video');
  const confirmed = document.getElementById('receipt-confirmed');
  const save = document.getElementById('receipt-save');
  const status = document.getElementById('receipt-status');
  const add = document.getElementById('receipt-add-row');
  let selectedImage = null;
  let previewUrl = null;
  let stream = null;
  let cameraGeneration = 0;
  let expectedTotal = null;
  let busy = false;
  let saving = false;
  const yen = value => value.toLocaleString('ja-JP');

  function updateSummary(resetConfirmation = true) {
    if (resetConfirmation) confirmed.checked = false;
    const amounts = [...rows.querySelectorAll('[name=amount]')];
    const valid = amounts.every(input => input.value !== '' && input.checkValidity());
    const total = amounts.reduce((sum, input) => sum + (Number(input.value) || 0), 0);
    document.getElementById('receipt-sum').textContent = valid ? yen(total) : '金額を確認';
    document.getElementById('receipt-count').textContent = `${amounts.length}件`;
    document.getElementById('receipt-empty').hidden = amounts.length > 0;
    const check = document.getElementById('receipt-total-check');
    check.className = '';
    check.textContent = '';
    if (expectedTotal !== null && valid) {
      const difference = total - expectedTotal;
      check.className = difference ? 'receipt-warning' : '';
      check.textContent = `読み取った支払合計：${yen(expectedTotal)} 円。` + (difference
        ? `表の合計との差：${difference > 0 ? '+' : ''}${yen(difference)} 円。税・値引き・読み落としを確認してください。`
        : '表の合計と一致しています。');
    }
    save.disabled = busy || saving || amounts.length === 0 || !valid;
    add.disabled = busy || amounts.length >= 100;
    scan.disabled = busy || !selectedImage;
  }

  function appendRow(item = {}) {
    if (rows.children.length >= 100) return;
    const row = document.getElementById('receipt-row-template').content.cloneNode(true);
    row.querySelector('[name=category]').value = item.category || 'other_expense';
    row.querySelector('[name=description]').value = item.description || '';
    row.querySelector('[name=amount]').value = item.amount ?? '';
    rows.append(row);
  }

  function stopCamera() {
    cameraGeneration++;
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
    document.getElementById('receipt-camera').hidden = true;
  }

  function selectImage(file) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      selectedImage = null;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      document.getElementById('receipt-preview-wrap').hidden = true;
      status.textContent = '8MB以下のJPEG・PNG・WebP画像を選んでください。';
      fileInput.value = '';
      updateSummary();
      return;
    }
    selectedImage = file;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    document.getElementById('receipt-preview').src = previewUrl;
    document.getElementById('receipt-preview-wrap').hidden = false;
    document.getElementById('receipt-filename').textContent = file.name;
    status.textContent = '画像を確認して「画像を読み取る」を押してください。';
    updateSummary();
  }

  fileInput.addEventListener('change', () => {
    if (busy || !fileInput.files[0]) return;
    stopCamera();
    selectImage(fileInput.files[0]);
  });
  cameraStart.addEventListener('click', async () => {
    if (busy) return;
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      status.textContent = 'この接続ではカメラを起動できません。HTTPS（自分のPCはlocalhost）で開くか、撮影済みの画像を選んでください。';
      return;
    }
    const generation = cameraGeneration;
    try {
      const captured = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}}, audio: false});
      if (generation !== cameraGeneration) {
        captured.getTracks().forEach(track => track.stop());
        return;
      }
      stream = captured;
      video.srcObject = stream;
      document.getElementById('receipt-camera').hidden = false;
      await video.play();
      status.textContent = 'レシート全体を写し、「この画像を撮影」を押してください。';
    } catch (error) {
      stopCamera();
      status.textContent = 'カメラを起動できませんでした。カメラの利用許可を確認するか、撮影済みの画像を選んでください。';
    }
  });
  document.getElementById('receipt-camera-stop').addEventListener('click', stopCamera);
  document.getElementById('receipt-capture').addEventListener('click', () => {
    if (!video.videoWidth || !video.videoHeight || busy) return;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 2400 / video.videoWidth, 6000 / video.videoHeight);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();
    canvas.toBlob(blob => {
      if (blob) selectImage(new File([blob], 'receipt-camera.jpg', {type: 'image/jpeg'}));
      else status.textContent = '撮影に失敗しました。もう一度お試しください。';
    }, 'image/jpeg', 0.92);
  });

  scan.addEventListener('click', async () => {
    if (!selectedImage || busy) return;
    stopCamera();
    busy = true;
    fileInput.disabled = cameraStart.disabled = true;
    form.querySelectorAll('select, input:not([type=hidden]), .receipt-remove').forEach(input => { input.disabled = true; });
    status.textContent = 'レシートを読み取っています…（最大1分程度）';
    form.setAttribute('aria-busy', 'true');
    updateSummary();
    const data = new FormData();
    data.append('image', selectedImage);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 75000);
    try {
      const response = await fetch(scan.dataset.url, {method: 'POST', body: data,
        headers: {'X-CSRFToken': form.querySelector('[name=csrf_token]').value}, signal: controller.signal});
      if (response.redirected) throw new Error('ログイン期限が切れています。再ログインしてください。');
      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error(response.status === 413 ? '画像が大きすぎます。8MB以下にしてください。' : '読み取れませんでした。ログイン状態を確認して画面を開き直してください。');
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '読み取りに失敗しました。');
      rows.replaceChildren();
      result.items.forEach(appendRow);
      expectedTotal = result.total;
      if (result.date) document.getElementById('receipt-date').value = result.date;
      const notes = document.getElementById('receipt-notes');
      notes.textContent = [result.notes, result.date ? '' : '購入日を読み取れませんでした。日付を確認してください。',
        result.total === null ? '支払合計を読み取れませんでした。画像の合計と照合してください。' : ''].filter(Boolean).join(' ');
      notes.hidden = !notes.textContent;
      status.textContent = `${result.items.length}件の候補を読み取りました。まだ登録されていません。表を確認・修正してください。`;
      document.getElementById('receipt-review-title').focus();
    } catch (error) {
      status.textContent = error.name === 'AbortError' ? '読み取りの応答を確認できませんでした。API料金が発生している場合があります。時間をおいて再操作してください。' : error.message;
    } finally {
      clearTimeout(timer);
      busy = false;
      form.removeAttribute('aria-busy');
      fileInput.disabled = cameraStart.disabled = false;
      form.querySelectorAll('select, input:not([type=hidden]), .receipt-remove').forEach(input => { input.disabled = false; });
      updateSummary();
    }
  });
  add.addEventListener('click', () => { appendRow(); updateSummary(); rows.lastElementChild?.querySelector('select').focus(); });
  rows.addEventListener('click', event => {
    if (!busy && event.target.closest('.receipt-remove')) { event.target.closest('tr').remove(); updateSummary(); }
  });
  rows.addEventListener('input', () => updateSummary());
  document.getElementById('receipt-date').addEventListener('input', () => updateSummary());
  form.addEventListener('submit', event => {
    if (busy || saving || !rows.children.length) { event.preventDefault(); return; }
    saving = true;
    save.disabled = true;
    save.textContent = '登録しています…';
    stopCamera();
  });
  window.addEventListener('pagehide', stopCamera);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera(); });
  window.addEventListener('pageshow', () => { saving = false; save.textContent = '確定して支出を登録'; updateSummary(false); });
  updateSummary(false);
})();
