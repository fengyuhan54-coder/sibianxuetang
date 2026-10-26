import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {Readable} from 'node:stream';
import {gunzipSync} from 'node:zlib';
import {createDemoGateway} from './gateway.mjs';

const requestHTTP=(url,init={})=>new Promise((resolve,reject)=>{
 const req=http.request(url,{method:init.method||'GET',headers:init.headers},res=>resolve(new Response(Readable.toWeb(res),{status:res.statusCode,headers:res.headers})));
 req.on('error',reject);req.end(init.body);
});

test('比赛入口：权限、来源、配置隔离、流式回复、静态资源和调用限制',async t=>{
 let hits=[],usage={},streamClosed=false;
 const upstream=http.createServer(async(req,res)=>{
  hits.push({path:req.url,host:req.headers.host,origin:req.headers.origin});
  if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end('<html><head></head><body>思辨学堂</body></html>');}
  if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end('console.log("hello")');}
  if(req.url==='/api/textbook.pdf'){res.writeHead(206,{'Content-Type':'application/pdf','Content-Range':'bytes 0-3/10','Accept-Ranges':'bytes'});return res.end('test');}
  if(req.url==='/api/chat'){
   res.writeHead(200,{'Content-Type':'text/event-stream'});res.write('event: delta\ndata: first\n\n');
   const timer=setTimeout(()=>res.end('event: done\ndata: end\n\n'),500);
   res.on('close',()=>{streamClosed=true;clearTimeout(timer);});return;
  }
  res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':'sixarts_session=fake; HttpOnly; Path=/; SameSite=Strict'});res.end('{"ok":true}');
 });
 await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 const gateway=createDemoGateway({upstream:`http://127.0.0.1:${upstream.address().port}`,publicOrigin:'https://sibianxuetang.cn',accessCode:'test-code-123456789',dailyLimit:2,readUsage:()=>usage,writeUsage:x=>{usage=x;}});
 await new Promise(r=>gateway.listen(0,'127.0.0.1',r));
 t.after(()=>{gateway.closeAllConnections();upstream.closeAllConnections();gateway.close();upstream.close();});
 const base=`http://127.0.0.1:${gateway.address().port}`;
 const request=(path,init={})=>requestHTTP(base+path,{...init,headers:{Host:'sibianxuetang.cn',...init.headers}});
 let response=await request('/');assert.equal(response.status,200);assert.match(await response.text(),/演示访问码/);
 assert.equal((await request('/api/status')).status,401);
 assert.equal((await request('/?access=wrong')).status,401);
 response=await request('/?access=test-code-123456789');assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/');
 const auth=response.headers.get('set-cookie');assert.match(auth,/HttpOnly/);assert.match(auth,/Secure/);assert.match(auth,/SameSite=Strict/);
 const headers={Cookie:auth.split(';')[0]};
 response=await request('/',{headers});assert.match(await response.text(),/#settings-button/);
 response=await request('/api/status',{headers:{...headers,Origin:'https://sibianxuetang.cn'}});assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/Secure/);
 assert.equal(hits.at(-1).origin,`http://127.0.0.1:${upstream.address().port}`);
 assert.equal(hits.at(-1).host,`127.0.0.1:${upstream.address().port}`);
 assert.equal((await request('/api/status',{headers:{...headers,Origin:'https://evil.example'}})).status,403);
 assert.equal((await request('/api/status',{headers:{...headers,Host:'evil.example'}})).status,403);
 const n=hits.length;
 for(const path of ['/api/config','/api/test','/api/maintenance/reload'])assert.equal((await request(path,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal(hits.length,n);
 assert.equal((await request('/.env',{headers})).status,404);
 assert.equal((await request('/api/chat',{method:'POST',headers,body:'{}'})).status,415);
 response=await request('/app.js',{headers:{...headers,'Accept-Encoding':'gzip'}});assert.equal(response.headers.get('content-encoding'),'gzip');assert.equal(gunzipSync(Buffer.from(await response.arrayBuffer())).toString(),'console.log("hello")');
 response=await request('/api/textbook.pdf',{headers:{...headers,Range:'bytes=0-3'}});assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),'bytes 0-3/10');assert.equal(await response.text(),'test');
 response=await request('/api/auth/register',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});assert.deepEqual(usage,{});
 response=await request('/api/chat',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'});
 const reader=response.body.getReader();assert.match(new TextDecoder().decode((await reader.read()).value),/first/);assert.equal(streamClosed,false);
 let rest='';for(;;){const chunk=await reader.read();if(chunk.done)break;rest+=new TextDecoder().decode(chunk.value);}assert.match(rest,/done/);
 response=await request('/api/chat',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'});await response.text();
 assert.equal(usage.count,2);
 assert.equal((await request('/api/chat',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'})).status,429);
});

test('用量文件损坏时返回可理解的错误',async t=>{
 const gateway=createDemoGateway({upstream:'http://127.0.0.1:1',publicOrigin:'https://sibianxuetang.cn',accessCode:'test-code-123456789',readUsage:()=>{throw Error('bad');}});
 await new Promise(r=>gateway.listen(0,'127.0.0.1',r));t.after(()=>{gateway.closeAllConnections();gateway.close();});
 const base=`http://127.0.0.1:${gateway.address().port}`;
 const login=await requestHTTP(base+'/?access=test-code-123456789',{headers:{Host:'sibianxuetang.cn'}});
 const headers={Host:'sibianxuetang.cn',Cookie:login.headers.get('set-cookie').split(';')[0],'Content-Type':'application/json'};
 const r=await requestHTTP(base+'/api/chat',{method:'POST',headers,body:'{}'});assert.equal(r.status,503);
 const unavailable=await requestHTTP(base+'/api/status',{headers});assert.equal(unavailable.status,502);
});
