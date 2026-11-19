const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('src/static/transactions.js', 'utf8');
function fixture() {
  const kind = {value: 'expense', addEventListener(name, callback) {this[name] = callback;}};
  const makeOption = type => ({dataset: {kind: type}, radio: {checked: true}, querySelector() {return this.radio;}});
  const options = [makeOption('expense'), makeOption('income')];
  const submit = {disabled: false};
  const status = {textContent: ''};
  const summary = {focus() {this.focused = true;}};
  const form = {
    action: '/dashboard?month=2026-11',
    querySelector(selector) {return selector.includes('kind') ? kind : submit;},
    querySelectorAll() {return options;},
    addEventListener(name, callback) {this[name] = callback;}
  };
  const panel = {open: true, querySelector(selector) {return selector === 'summary' ? summary : form;}, addEventListener(name, callback) {this[name] = callback;}};
  const cancel = {addEventListener(name, callback) {this[name] = callback;}};
  const main = {replaceWith(value) {this.replacement = value;}};
  let fetchResponse;
  let calls = 0;
  const context = {
    document: {querySelectorAll() {return [form];}, getElementById(id) {return {'add-panel':panel, 'cancel-add':cancel, 'save-status':status}[id];}, querySelector() {return main;}},
    FormData: class {},
    DOMParser: class {parseFromString() {return {querySelector() {return fetchResponse.main;}};}},
    fetch: async (url, request) => {calls++; assert.equal(url, form.action); assert.equal(request.method, 'POST'); return fetchResponse;}
  };
  vm.runInNewContext(source, context);
  return {kind, options, submit, status, summary, form, panel, cancel, main,
    response(value) {fetchResponse = value;}, calls() {return calls;}};
}
test('kind switch hides and disables incompatible categories, clearing selection', () => {
  const f = fixture();
  assert.equal(f.options[0].hidden, false);
  assert.equal(f.options[1].hidden, true);
  assert.equal(f.options[1].radio.disabled, true);
  f.kind.value = 'income'; f.kind.change();
  assert.equal(f.options[0].radio.disabled, true);
  assert.equal(f.options[1].hidden, false);
  assert.equal(f.options.some(o => o.radio.checked), false);
});
test('cancel and Escape close panel and restore focus', () => {
  const f = fixture(); f.cancel.click();
  assert.equal(f.panel.open, false); assert.equal(f.summary.focused, true);
  f.panel.open = true; f.panel.keydown({key:'Escape'});
  assert.equal(f.panel.open, false);
});
test('save replaces dashboard without navigation and prevents duplicate requests', async () => {
  const f = fixture();
  const next = {querySelector() {return {};}};
  f.response({ok:true, text:async () => '<main>', main:next});
  const pending = f.form.submit({preventDefault() {}});
  await f.form.submit({preventDefault() {}});
  assert.equal(f.calls(), 1);
  f.panel.open = false;
  await pending;
  assert.equal(f.main.replacement, next);
  assert.equal(f.summary.focused, true);
});
test('server/CSRF failure retains form and allows retry', async () => {
  const f = fixture(); f.response({ok:false, text:async () => 'error'});
  await f.form.submit({preventDefault() {}});
  assert.equal(f.main.replacement, undefined);
  assert.equal(f.submit.disabled, false);
  assert.notEqual(f.status.textContent, '');
});
