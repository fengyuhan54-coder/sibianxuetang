import {spawn} from 'node:child_process';
import {mkdirSync,openSync,closeSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {serverPort} from './runtime.mjs';

const directory=path.dirname(fileURLToPath(import.meta.url));
const port=serverPort();
const address=`http://127.0.0.1:${port}`;
async function ready(){
 try{
  const res=await fetch(address+'/api/status',{signal:AbortSignal.timeout(1200)});
  if(!res.ok)return false;
  const body=await res.json();
  return Array.isArray(body.agents)&&body.agents.some(a=>a.id==='socratic');
 }catch{return false;}
}
try{
 if(!await ready()){
  mkdirSync(path.join(directory,'.local'),{recursive:true});
  const log=openSync(path.join(directory,'.local','server.log'),'a');
  const child=spawn(process.execPath,[path.join(directory,'server.mjs')],{
   cwd:directory,detached:true,windowsHide:true,stdio:['ignore',log,log]
  });
  closeSync(log);
  let launchError;
  child.on('error',error=>{launchError=error;});
  child.unref();
  let online=false;
  for(let i=0;i<25;i++){
   if(launchError)throw launchError;
   if(await ready()){online=true;break;}
   await new Promise(resolve=>setTimeout(resolve,200));
  }
  if(!online)throw new Error('网页服务未能启动，请查看 .local/server.log，检查 3210 端口是否被占用。');
 }
 console.log('思辨学堂已启动：'+address);
 console.log('服务在后台运行，关闭启动窗口不会中断网页。');
 if(process.platform==='win32'){
  const browser=spawn('cmd.exe',['/c','start','',address],{detached:true,windowsHide:true,stdio:'ignore'});
  browser.on('error',()=>{});browser.unref();
 }
}catch(error){console.error(error.message);process.exitCode=1;}
