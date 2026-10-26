import {existsSync,unlinkSync,mkdirSync,openSync,closeSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const requestFile=new URL('./.local/reload-backend',import.meta.url);
let upgrading=false;
// Credentials travel over a private parent/child IPC channel, never files, argv, URLs or logs.
export function scheduleBackendUpgrade(config,requested=false){
 if(upgrading||!requested&&!existsSync(requestFile))return false;
 if(existsSync(requestFile))unlinkSync(requestFile);upgrading=true;
 const directory=fileURLToPath(new URL('./',import.meta.url));mkdirSync(new URL('./.local/',import.meta.url),{recursive:true});
 const log=openSync(new URL('./.local/server.log',import.meta.url),'a');
 const child=spawn(process.execPath,[fileURLToPath(new URL('./upgrade-worker.mjs',import.meta.url))],{cwd:directory,detached:true,windowsHide:true,stdio:['ignore',log,log,'ipc']});closeSync(log);
 const timer=setTimeout(()=>{upgrading=false;child.kill();},12000);timer.unref();
 child.on('error',()=>{clearTimeout(timer);upgrading=false;});
 child.on('message',message=>{if(message?.prepared){clearTimeout(timer);child.unref();setTimeout(()=>process.exit(0),500).unref();}else if(message?.failed){clearTimeout(timer);upgrading=false;}});
 child.send({config:{baseURL:config.baseURL,model:config.model,apiKey:config.apiKey,...(config.dataDirectory?{dataDirectory:config.dataDirectory}:{})}});
 return true;
}
