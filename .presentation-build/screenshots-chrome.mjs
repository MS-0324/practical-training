import {chromium} from 'file:///C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-737-0_26.1112.737.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright/index.mjs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const b=await chromium.launch({headless:true,channel:'chrome'});
const p=await b.newPage({viewport:{width:1260,height:900},deviceScaleFactor:1.5});
for (const [file,sel,name] of [['dashboard','.monthly-overview','overview'],['dashboard','#expense-2026-11','analysis'],['input','#add-panel','input'],['goal','main','goal']]) {
 await p.goto(pathToFileURL(path.resolve(file+'.html')).href);
 if(file==='input')await p.evaluate(()=>{document.querySelectorAll('.category-option[data-kind="income"]').forEach(x=>x.hidden=true)});
 await p.locator(sel).screenshot({path:name+'.png'});
}
await b.close();

