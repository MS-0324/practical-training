const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
  const nodes = {};
  const element = () => ({value: '', textContent: '', checked: false, disabled: false,
    handlers: {}, addEventListener(name, callback) {this.handlers[name] = callback;},
    setAttribute() {}, removeAttribute() {}, focus() {this.focused = true;},
    checkValidity() {const v = Number(this.value); return Number.isInteger(v) && v >= 1 && v <= 1e9;}});
  const node = id => nodes[id] ||= element();
  const rows = node('receipt-rows');
  rows.children = [];
  rows.querySelectorAll = () => rows.children.map(row => row.fields['[name=amount]']);
  rows.append = row => {rows.children.push(row); rows.lastElementChild = row;};
  rows.replaceChildren = () => {rows.children = [];};
  node('receipt-row-template').content = {cloneNode() {
    const fields = {'[name=category]': element(), '[name=description]': element(), '[name=amount]': element()};
    return {fields, querySelector(selector) {return fields[selector] || fields['[name=category]'];},
      remove() {rows.children = rows.children.filter(row => row !== this);}};
  }};
  const form = node('receipt-review-form');
  const csrf = {value: 'csrf-test'};
  form.querySelector = () => csrf;
  form.querySelectorAll = () => rows.children.flatMap(row => Object.values(row.fields));
  node('receipt-scan').dataset = {url: '/receipts/scan'};
  node('receipt-video').play = async () => {};
  const window = element();
  const document = {...element(), getElementById: node};
  let apiCalls = 0;
  let response = {ok: true, redirected: false, headers: {get: () => 'application/json'},
    json: async () => ({date: '2026-11-18', total: 100, notes: '<img onerror=bad>',
      items: [{description: '<script>test</script>', category: 'food', amount: 100}]})};
  let acquire = async () => ({getTracks: () => []});
  vm.runInNewContext(fs.readFileSync('src/static/receipts.js', 'utf8'), {
    document, window, navigator: {mediaDevices: {getUserMedia: args => {assert.equal(args.audio, false); return acquire();}}},
    URL: {createObjectURL: () => 'blob:test', revokeObjectURL() {}},
    FormData: class {append() {}}, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {apiCalls++; assert.equal(url, '/receipts/scan'); assert.equal(options.headers['X-CSRFToken'], 'csrf-test'); return response;},
  });
  return {node, rows, window, document, apiCalls: () => apiCalls,
    response: value => {response = value;}, acquire: callback => {acquire = callback;},
    choose: async (type = 'image/png', size = 100) => {
      node('receipt-file').files = [{name: 'receipt.png', type, size}];
      await node('receipt-file').handlers.change();
    }};
}

test('scan populates editable rows safely and does not submit transactions', async () => {
  const f = fixture();
  await f.choose();
  const pending = f.node('receipt-scan').handlers.click();
  await f.node('receipt-scan').handlers.click();
  await pending;
  assert.equal(f.apiCalls(), 1);
  assert.equal(f.rows.children.length, 1);
  assert.equal(f.rows.children[0].fields['[name=description]'].value, '<script>test</script>');
  assert.equal(f.node('receipt-notes').textContent, '<img onerror=bad>');
  assert.equal(f.node('receipt-sum').textContent, '100');
  assert.equal(f.node('receipt-date').value, '2026-11-18');
  assert.match(f.node('receipt-status').textContent, /まだ登録されていません/);
  f.node('receipt-confirmed').checked = true;
  f.rows.children[0].fields['[name=amount]'].value = '150';
  f.rows.handlers.input();
  assert.equal(f.node('receipt-confirmed').checked, false);
  assert.match(f.node('receipt-total-check').textContent, /\+50/);
  let prevented = 0;
  f.node('receipt-review-form').handlers.submit({preventDefault() {prevented++;}});
  f.node('receipt-review-form').handlers.submit({preventDefault() {prevented++;}});
  assert.equal(prevented, 1);
});

test('failed scan preserves edits and releases controls', async () => {
  const f = fixture();
  f.node('receipt-add-row').handlers.click();
  f.rows.children[0].fields['[name=amount]'].value = '200';
  await f.choose();
  f.response({ok: false, headers: {get: () => 'application/json'}, json: async () => ({error: 'API unavailable'})});
  await f.node('receipt-scan').handlers.click();
  assert.equal(f.rows.children.length, 1);
  assert.equal(f.rows.children[0].fields['[name=amount]'].value, '200');
  assert.equal(f.node('receipt-status').textContent, 'API unavailable');
  assert.equal(f.node('receipt-file').disabled, false);
  assert.equal(f.node('receipt-save').disabled, false);
});

test('invalid file clears pending image and cannot trigger an API call', async () => {
  const f = fixture();
  await f.choose();
  assert.equal(f.node('receipt-scan').disabled, false);
  await f.choose('application/pdf');
  assert.equal(f.node('receipt-scan').disabled, true);
  await f.node('receipt-scan').handlers.click();
  assert.equal(f.apiCalls(), 0);
});

test('camera stream is stopped on hiding page, including late permission result', async () => {
  const f = fixture();
  let stops = 0;
  const stream = {getTracks: () => [{stop() {stops++;}}]};
  f.acquire(async () => stream);
  await f.node('receipt-camera-start').handlers.click();
  f.document.hidden = true;
  f.document.handlers.visibilitychange();
  assert.equal(stops, 1);
  assert.equal(f.node('receipt-camera').hidden, true);
  let resolve;
  f.acquire(() => new Promise(done => {resolve = done;}));
  const pending = f.node('receipt-camera-start').handlers.click();
  f.window.handlers.pagehide();
  resolve(stream);
  await pending;
  assert.equal(stops, 2);
  assert.equal(f.node('receipt-video').srcObject, null);
});
