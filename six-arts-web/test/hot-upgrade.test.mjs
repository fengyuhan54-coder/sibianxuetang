import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
test('backend handoff keeps model credentials in private IPC and the replacement stays online',async()=>{
 const upstream=http.createServer(async(req,res)=>{assert.equal(req.headers.authorization,'Bearer synthetic-upgrade-only');for await(const c of req){}res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:'连接成功'},finish_reason:'stop'}]}));});
 await new Promise(r=>upstream.listen(0,'127.0.0.1',r));const reserve=http.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));const directory=await mkdtemp(path.join(os.tmpdir(),'sixarts-handoff-'));
 const script=`import {createApp} from ${JSON.stringify(new URL('../server.mjs',import.meta.url).href)}; createApp({baseURL:'http://127.0.0.1:${upstream.address().port}',model:'synthetic-upgrade',apiKey:'synthetic-upgrade-only',dataDirectory:${JSON.stringify(directory)}}).listen(${port},'127.0.0.1',()=>process.send({ready:true}));`;
 const child=spawn(process.execPath,['--input-type=module','-e',script],{env:{...process.env,PORT:String(port)},windowsHide:true,stdio:['ignore','ignore','ignore','ipc']});let replacement=null;
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('test parent did not start')),8000);child.once('message',()=>{clearTimeout(timer);resolve();});child.once('error',reject);});
  const response=await fetch(`http://127.0.0.1:${port}/api/maintenance/reload`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal((await response.json()).scheduled,true);
  for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,150));try{const status=await (await fetch(`http://127.0.0.1:${port}/api/status`,{signal:AbortSignal.timeout(500)})).json();if(status.processId!==child.pid){replacement=status;break;}}catch{}}
  assert.ok(replacement);assert.equal(replacement.configured,true);assert.equal(replacement.model,'synthetic-upgrade');assert.ok(!('apiKey'in replacement));
  const result=await fetch(`http://127.0.0.1:${port}/api/test`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(result.status,200);await new Promise(r=>setTimeout(r,300));assert.equal((await (await fetch(`http://127.0.0.1:${port}/api/status`)).json()).processId,replacement.processId);
 }finally{if(replacement?.processId)process.kill(replacement.processId);if(child.exitCode===null)child.kill();upstream.closeAllConnections();await new Promise(r=>upstream.close(r));}
});
