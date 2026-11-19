import sharp from 'file:///C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-737-0_26.1112.737.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/sharp/lib/index.js';
await sharp('input.png').extract({left:0,top:170,width:950,height:480}).toFile('input-category.png');
await sharp('input.png').extract({left:0,top:665,width:500,height:420}).toFile('input-fields.png');
await sharp('analysis.png').extract({left:80,top:190,width:490,height:495}).toFile('donut.png');
