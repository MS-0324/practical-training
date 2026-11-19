import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {constants} from 'node:fs';
// This Windows workspace supports file copies but not hard links. Preserve
// exclusive creation of the validated output when the finalizer publishes it.
const originalLink=fs.link;
fs.link=async(a,b)=>{try{return await originalLink(a,b)}catch(e){if(e.code!=='EPERM')throw e;return fs.copyFile(a,b,constants.COPYFILE_EXCL)}};
const root='C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-737-0_26.1112.737.0_x64__3k8sg7r9htsxt/dependencies';
process.env.RUNTIME_NODE_MODULES=root+'/node/node_modules';
const skill='C:/Users/maeya/.codex/plugins/cache/openai-primary-runtime/presentations/26.1112.11217/skills/presentations';
const source='C:/Users/maeya/Downloads/情報システム基礎演習　c班.pptx';
const {finalizePresentation}=await import(pathToFileURL(skill+'/container_tools/artifact_tool_utils.mjs').href);
await fs.mkdir('output',{recursive:true});
const tables=[2,3,4,7,11,13,14,15,17,18,20];
const r=await finalizePresentation({workspaceDir:process.cwd(),candidatePath:path.resolve('candidate.pptx'),finalPath:path.resolve('output/家計簿Webアプリ_期末発表_完成版.pptx'),explicitTotalSlideCount:20,requiredNativeTableOwnerSlides:tables,requiredNativeChartOwnerSlides:[],pythonExecutable:root+'/python/python.exe',integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','9144000,5143500','--validate-bullet-geometry','--validate-heading-fit',...tables.flatMap(n=>['--require-native-table-slide',String(n)])],fontPolicy:{basis:'reference',families:['Meiryo','Arial','Raleway','Lato'],referencePath:source,referenceSha256:createHash('sha256').update(await fs.readFile(source)).digest('hex')},verifyArtifactToolImport:true,receiptPath:path.resolve('validation-final.json')});
console.log(JSON.stringify(r));
