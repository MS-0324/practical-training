import {chromium} from 'file:///C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-737-0_26.1112.737.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
const bridge=spawn('python',['-u','.category-work/browser_bridge.py'],{stdio:['pipe','pipe','inherit']});
const queue=[];
createInterface({input:bridge.stdout}).on('line',line=>queue.shift()(JSON.parse(line)));
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
const page=await browser.newPage({viewport:{width:1260,height:1000}});
await page.route('http://budget.test/**',async route=>{
  const request=route.request();const url=new URL(request.url());
  const response=await new Promise(resolve=>{queue.push(resolve);bridge.stdin.write(JSON.stringify({path:url.pathname+url.search,method:request.method(),headers:request.headers(),body:request.postDataBuffer()?.toString('base64')||''})+'\n')});
  await route.fulfill({status:response.status,headers:response.headers,body:Buffer.from(response.body,'base64')});
  console.log(request.method(),url.pathname,response.status);
});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
page.on('requestfailed',r=>console.log('FAILED',r.url(),r.failure()));
page.on('console',m=>console.log('BROWSER',m.type(),m.text()));
await page.goto('http://budget.test/login');
await page.locator('[name=username]').fill('demo@example.com');
await page.locator('[name=password]').fill('demo-password-only');
await page.locator('input[type=submit]').click();
await page.goto('http://budget.test/dashboard');
await page.locator('#add-panel summary').first().click();
await page.locator('[name=amount]').fill('1850');
await page.locator('[name=description]').fill('入力途中のメモ');
await page.locator('[name=category][value=other_expense]').check();
assert.equal(await page.locator('[data-category-creator]').getAttribute('open'),'');
await page.locator('[name=new_category_name]').fill('ライブ遠征');
await page.locator('[name=category_action]').click();
await page.getByText('次回からも一覧で選べます。',{exact:false}).waitFor();
const custom=page.locator('[name=category][value^=custom_]');
assert.equal(await custom.isChecked(),true);
assert.equal(await page.locator('[name=amount]').inputValue(),'1850');
assert.equal(await page.locator('[name=description]').inputValue(),'入力途中のメモ');
await page.locator('#add-panel').screenshot({path:'.category-work/created-category.png'});
// Enter in the amount field must save the transaction, not create a category.
await page.locator('[name=amount]').press('Enter');
try { await page.getByText('収支を追加しました。',{exact:true}).waitFor({timeout:5000}); }
catch(error){console.log(await page.locator('#add-panel').innerText());console.log(await page.locator('#save-status').innerText());console.log(errors);throw error;}
assert.match(await page.locator('#transaction-history').innerText(),/ライブ遠征/);
assert.match(await page.locator('#expense-analysis').innerText(),/ライブ遠征/);
await page.reload();
await page.locator('#add-panel summary').first().click();
assert.equal(await custom.count(),1);
await page.locator('.category-manager summary').click();
page.on('dialog',dialog=>dialog.accept());
await page.locator('[name=delete_category]').click();
await page.getByText('カテゴリを削除しました。過去の収支と集計はそのまま残ります。',{exact:true}).waitFor();
assert.equal(await custom.count(),0);
assert.match(await page.locator('#transaction-history').innerText(),/ライブ遠征/);
await page.locator('#transaction-history a').first().click();
assert.equal(await custom.isChecked(),true);
await page.locator('[name=amount]').fill('2200');
await page.locator('input[type=submit]').click();
await page.locator('#transaction-history').waitFor();
assert.match(await page.locator('#transaction-history').innerText(),/2,200/);
// Narrow layout and keyboard creation of another kind.
await page.setViewportSize({width:390,height:844});
await page.locator('#add-panel summary').first().click();
await page.locator('[name=kind]').selectOption('income');
await page.locator('[data-category-creator] summary').click();
await page.locator('[name=new_category_name]').fill('臨時の報酬');
await page.locator('[name=new_category_name]').press('Enter');
await page.getByText('「臨時の報酬」を選択しました。次回からも一覧で選べます。',{exact:true}).waitFor();
assert.equal(await page.locator('[name=category][value^=custom_]').isChecked(),true);
assert.equal(await page.locator('[name=kind]').inputValue(),'income');
await page.locator('#add-panel').screenshot({path:'.category-work/mobile-category.png'});
assert.deepEqual(errors,[]);
console.log('PASS: create, preserve inputs, save with Enter, reload, chart labels, delete, preserve history, edit archived category, income, mobile, keyboard creation');
} finally {await browser.close();bridge.stdin.end()}
