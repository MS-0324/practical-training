import fs from 'node:fs/promises';
import {FileBlob,PresentationFile} from 'file:///C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-737-0_26.1112.737.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const p=await PresentationFile.importPptx(await FileBlob.load('C:/Users/maeya/Downloads/情報システム基礎演習　c班.pptx'));
await fs.mkdir('reference-render',{recursive:true});
await fs.writeFile('reference-proto.json',JSON.stringify(p.toProto()));
console.log((await p.inspect({kind:'layout',maxChars:3000})).ndjson);
for(let i=0;i<p.slides.items.length;i++){const b=await p.export({slide:p.slides.items[i],format:'png',scale:0.8});await fs.writeFile(`reference-render/${i+1}.png`,new Uint8Array(await b.arrayBuffer()));}

