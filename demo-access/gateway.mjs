import http from 'node:http';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {createGzip} from 'node:zlib';

const same=(a,b)=>timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
const assets=new Set(['/', '/index.html','/app.js','/studio.js','/compass.js','/course-welcome.js','/course-welcome.css','/visuals.js','/style.css','/training.css','/studio.css','/concept-illustrations.js','/concept-illustrations.css']);
const gets=new Set(['/api/status','/api/auth/me','/api/leaderboard','/api/learning','/api/compass','/api/textbook.pdf','/api/concept-illustration/status']);
const posts=new Set(['/api/chat','/api/map','/api/auth/register','/api/auth/login','/api/auth/logout','/api/quiz/start','/api/quiz/submit','/api/compass/start','/api/compass/submit','/api/lab/evaluate','/api/lab/argument','/api/lab/roundtable','/api/lab/concept','/api/lab/trajectory','/api/battle/start','/api/battle/arm','/api/battle/identify','/api/battle/submit','/api/battle/retake','/api/battle/coach','/api/battle/resume','/api/concept-illustration']);
const paid=new Set([...posts].filter(p=>!p.startsWith('/api/auth/')&&!['/api/quiz/start','/api/compass/start','/api/battle/arm','/api/battle/identify','/api/battle/resume'].includes(p)));
const hop=new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade']);
const gateHTML=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>思辨学堂 · 比赛演示</title><style>body{margin:0;background:#f7f3e8;color:#20334f;font:16px system-ui;display:grid;min-height:100vh;place-items:center}main{background:#fffdf7;max-width:390px;margin:24px;padding:36px;border:1px solid #e1d6ba;border-radius:20px;box-shadow:0 16px 60px #20334f10}small{letter-spacing:3px;color:#9d7e45}h1{font-size:30px}p{line-height:1.8;color:#616874}input,button{box-sizing:border-box;width:100%;padding:13px;margin-top:16px;border:1px solid #d4ccbb;border-radius:10px;font:inherit}button{background:#20334f;color:white;cursor:pointer}label{display:block;margin-top:22px}</style><main><small>THE ART OF THINKING</small><h1>欢迎来到思辨学堂</h1><p>本入口用于比赛评审与体验。请输入团队提供的演示访问码，开始与六位学习伙伴交流。</p><form method="post" action="/__demo/login"><label for="code">演示访问码</label><input id="code" name="code" type="password" autocomplete="off" required maxlength="128"><button>进入思辨学堂 →</button></form></main></html>`;

export function createDemoGateway({upstream,publicOrigin,accessCode,listenPort=3211,dailyLimit=300,readUsage=()=>({}),writeUsage=()=>{}}){
 const target=new URL(upstream),pub=new URL(publicOrigin);
 if(!['localhost','127.0.0.1'].includes(target.hostname)||target.protocol!=='http:')throw new Error('演示后端必须是本机HTTP地址');
 if(pub.protocol!=='https:'||pub.username||pub.password||pub.pathname!=='/'||pub.search||pub.hash)throw new Error('公网地址格式不正确');
 if(typeof accessCode!=='string'||accessCode.length<12)throw new Error('演示访问码至少12位');
 const allowedHosts=new Set([pub.host,'www.'+pub.hostname,'127.0.0.1:'+listenPort,'localhost:'+listenPort]);
 const sign=value=>createHmac('sha256',accessCode).update(value).digest('base64url');
 const cookie=()=>{const expiry=String(Date.now()+7*86400000);return expiry+'.'+sign(expiry);};
 const authorized=req=>{const value=(req.headers.cookie||'').split(';').map(p=>p.trim()).find(p=>p.startsWith('sb_demo_access='))?.slice(15)||'';const [expiry,mac]=value.split('.');return /^\d+$/.test(expiry||'')&&Number(expiry)>Date.now()&&same(mac||'',sign(expiry));};
 const loginFailures=new Map();let modelActive=0;
 return http.createServer(async(req,res)=>{
  const send=(status,message)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify({error:message}));};
  const host=req.headers.host||'';const local=host==='localhost:'+listenPort||host==='127.0.0.1:'+listenPort;
  const origin=(local?'http://':'https://')+host;
  if(!allowedHosts.has(host))return send(403,'访问域名不匹配');
  if(req.headers.origin&&req.headers.origin!==origin)return send(403,'请求来源不匹配');
  if(req.headers['sec-fetch-site']==='cross-site'&&req.method!=='GET')return send(403,'不接受跨站操作');
  if(!req.url.startsWith('/')||req.url.startsWith('//'))return send(400,'请求路径不正确');
  const url=new URL(req.url,origin);
  res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
  const setAccess=()=>res.setHeader('Set-Cookie',`sb_demo_access=${cookie()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${local?'':'; Secure'}`);
  const redirect=()=>{res.writeHead(303,{'Location':'/','Cache-Control':'no-store'});res.end();};
  const readBody=async()=>{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1000000)throw new Error('输入内容过长');chunks.push(chunk);}return Buffer.concat(chunks);};
  if(req.method==='GET'&&url.pathname==='/'&&url.searchParams.has('access')){
   if(!same(url.searchParams.get('access')||'',accessCode))return send(401,'演示访问码不正确');
   setAccess();return redirect();
  }
  if(req.method==='POST'&&url.pathname==='/__demo/login'){
   const key=req.headers['cf-connecting-ip']||'local',now=Date.now();let f=loginFailures.get(key);
   if(!f||f.reset<now){f={n:0,reset:now+60000};loginFailures.set(key,f);}
   if(++f.n>12)return send(429,'访问码尝试次数较多，请一分钟后再试');
   try{const body=new URLSearchParams((await readBody()).toString('utf8'));if(!same(body.get('code')||'',accessCode))return send(401,'演示访问码不正确');setAccess();return redirect();}catch{return send(413,'输入内容过长');}
  }
  if(!authorized(req)){
   if(req.method==='GET'&&['/','/index.html'].includes(url.pathname)){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"});return res.end(gateHTML);
   }
   return send(401,'请先使用团队提供的演示访问链接或访问码');
  }
  if(['/api/config','/api/test','/api/maintenance/reload'].includes(url.pathname))return send(403,'模型配置及服务管理仅在团队本机管理页开放');
  const image=/^\/api\/concept-images\/[a-f0-9]{64}\.png$/.test(url.pathname);
  if(!(req.method==='GET'&&(assets.has(url.pathname)||gets.has(url.pathname)||image)||req.method==='POST'&&posts.has(url.pathname)))return send(404,'页面不存在');
  const isPaid=req.method==='POST'&&paid.has(url.pathname);
  let body;
  if(req.method==='POST'){
   if(!req.headers['content-type']?.includes('application/json'))return send(415,'请使用JSON请求');
   try{body=await readBody();}catch{return send(413,'输入内容过长');}
  }
  if(isPaid){
   const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   let usage;try{usage=readUsage();}catch{return send(503,'暂时无法读取演示用量，请联系团队');}
   const count=usage?.day===day&&Number.isSafeInteger(usage.count)&&usage.count>=0?usage.count:0;
   if(count>=dailyLimit)return send(429,'今日演示调用已达到团队设置的上限');
   if(modelActive>=3)return send(429,'当前体验人数较多，请稍后再试');
   try{writeUsage({day,count:count+1});}catch{return send(503,'暂时无法记录演示用量，请联系团队');}
   modelActive++;
  }
  let finished=false,heartbeat;
  const finish=()=>{if(finished)return;finished=true;clearInterval(heartbeat);if(isPaid)modelActive--;};
  const headers={...req.headers,host:target.host};
  for(const key of Object.keys(headers))if(hop.has(key)||key.startsWith('x-forwarded-')||key.startsWith('cf-')||['authorization','origin','accept-encoding'].includes(key))delete headers[key];
  if(req.headers.origin)headers.origin=target.origin;
  if(body)headers['content-length']=body.length;
  const proxy=http.request({hostname:target.hostname,port:target.port||80,method:req.method,path:url.pathname+url.search,headers},up=>{
   const responseHeaders={...up.headers};for(const key of Object.keys(responseHeaders))if(hop.has(key))delete responseHeaders[key];
   if(!local&&responseHeaders['set-cookie'])responseHeaders['set-cookie']=responseHeaders['set-cookie'].map(c=>c.includes('Secure')?c:c+'; Secure');
   const type=String(up.headers['content-type']||'');
   const html=type.includes('text/html')&&assets.has(url.pathname);
   if(html){
    const parts=[];up.on('data',p=>parts.push(p));up.on('end',()=>{
     // Hide management controls in this public copy; backend management is independently blocked above.
     const content=Buffer.from(Buffer.concat(parts).toString('utf8').replace('</head>','<style>#settings-button,#settings-dialog,.connection-notice{display:none!important}</style></head>'));
     delete responseHeaders['content-length'];res.writeHead(up.statusCode,responseHeaders);res.end(content);finish();
    });
   }else{
    const gzip=assets.has(url.pathname)&&/text\/|javascript/.test(type)&&/\bgzip\b/.test(req.headers['accept-encoding']||'');
    if(gzip){responseHeaders['content-encoding']='gzip';responseHeaders.vary='Accept-Encoding';delete responseHeaders['content-length'];}
    if(type.includes('text/event-stream')){responseHeaders['cache-control']='no-cache, no-store, no-transform';responseHeaders['x-accel-buffering']='no';}
    res.writeHead(up.statusCode,responseHeaders);
    if(type.includes('text/event-stream')){res.flushHeaders();heartbeat=setInterval(()=>{if(!res.destroyed)res.write(': demo-keepalive\n\n');},15000);heartbeat.unref();}
    if(gzip)up.pipe(createGzip()).pipe(res);else up.pipe(res);
    up.on('end',finish);
   }
   up.on('error',()=>{res.destroy();finish();});
  });
  proxy.setTimeout(160000,()=>proxy.destroy(new Error('upstream timeout')));
  proxy.on('error',()=>{finish();if(!res.headersSent)send(502,'本机演示后端尚未启动或连接中断，请联系团队');else res.end();});
  res.on('close',()=>{proxy.destroy();finish();});
  if(body)proxy.end(body);else proxy.end();
 });
}
