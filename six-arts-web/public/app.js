import {createStudio,conversationRecords} from './studio.js';
const $=id=>document.getElementById(id);
let STORE='six-arts-v1';
let saved={};try{saved=JSON.parse(localStorage.getItem(STORE)||'{}');}catch{}
let sessions=Array.isArray(saved.sessions)?saved.sessions.filter(s=>s&&typeof s.id==='string'&&typeof s.agent==='string'&&Array.isArray(s.messages)):[];
let notes=typeof saved.notes==='string'?saved.notes:'';
let agents=[],config={},activeAgent='coach',activeSession=null,currentView='chat',controller=null,busy=false,graph=null,confirmAction=null,draftMode='free';
const curriculum=['socratic','concept','argument','fallacy','perspectives','planner'];
// Presentation only: course labels and decorative portraits never enter model requests.
const mentorPresentation={
 coach:{ability:'六艺协同 · 陪伴式学习',path:['提出问题','选择思考路径','回看认知变化']},
 socratic:{ability:'追问与反思',path:['澄清概念','检查理由','反思判断']},
 fallacy:{ability:'谬误识别与理性辩论',path:['辨认主张','检验推理','回应质疑']},
 perspectives:{ability:'换位思考与立场比较',path:['理解立场','切换视角','权衡价值']},
 argument:{ability:'论点、理由与证据',path:['拆解论证','评价证据','完善表达']},
 planner:{ability:'学习规划与自我监控',path:['明确目标','循序练习','回顾调整']},
 concept:{ability:'概念边界与含义辨析',path:['界定含义','区分歧义','检验理解']}
};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function persist(){try{localStorage.setItem(STORE,JSON.stringify({sessions,notes}));}catch{toast('本地存储空间不足，请导出记录后清理。');}}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,4200);}
function byId(id){return agents.find(a=>a.id===id)||agents[0];}
function getSession(){return sessions.find(s=>s.id===activeSession);}
function isLocked(){if(busy||studio.busy()){toast('请先停止或等待当前请求完成。');return true;}return false;}
async function api(url,body){const res=await fetch(url,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const data=await res.json();if(!res.ok)throw new Error(data.error||'请求未完成');return data;}
function renderStatus(){document.body.classList.toggle('connected',config.configured);$('model-status').textContent=config.configured?'● '+config.model:'○ 模型待连接';$('sidebar-model').textContent=config.configured?config.model:'尚未连接模型';$('connection-notice').hidden=!!config.configured;}
function navClose(){$('sidebar').classList.remove('open');$('mobile-overlay').hidden=true;}
function view(name){studio.detach();currentView=name;for(const v of ['chat','history','profile'])$(v+'-view').hidden=v!==name;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view===name));$('coach-home').classList.toggle('selected',name==='chat'&&activeAgent==='coach');$('page-name').textContent=name==='chat'?(activeAgent==='coach'?'思维教练 · 主工作台':byId(activeAgent).name+' · 独立工作台'):{history:'对话历史',profile:'学习记录'}[name];if(name==='history')renderHistory();if(name==='profile')renderProfile();navClose();}
function selectAgent(id,sessionId){if(isLocked())return;activeAgent=id;activeSession=sessionId||sessions.filter(s=>s.agent===id).sort((a,b)=>b.updated-a.updated)[0]?.id||null;draftMode=getSession()?.training?.mode||'free';view('chat');renderChat();}
function renderNav(){
 $('agents-nav').innerHTML=agents.filter(a=>a.id!=='coach').map(a=>`<button data-agent="${a.id}" class="${activeAgent===a.id?'active':''}"><span class="nav-symbol mentor-portrait" data-mentor="${a.id}" aria-hidden="true">${a.symbol}</span>${a.name}<small>${a.tag.split('与')[0]}</small></button>`).join('');
 $('history-count').textContent=sessions.filter(s=>s.messages.length).length;
 $('coach-home').classList.toggle('selected',currentView==='chat'&&activeAgent==='coach');
 $('workspace-agents').hidden=activeAgent!=='coach';
 $('workspace-agents').innerHTML=agents.filter(a=>a.id!=='coach').map(a=>`<button data-agent="${a.id}" title="进入${a.name}独立工作台"><span class="mentor-portrait" data-mentor="${a.id}" aria-hidden="true">${a.symbol}</span><strong>${a.name}</strong><small>独立对话 ↗</small></button>`).join('');
}
function renderTraining(){
 const t=getSession()?.training,mode=t?.mode||draftMode;
 $('mode-switch').hidden=!['coach','concept'].includes(activeAgent);
 document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
 const active=t?.active,stage=t?.stages?.[active];
 $('training-phase').textContent=stage?(byId(active).name+' · '+(active==='socratic'&&stage.status==='waiting'?`第 ${stage.round} / 5 轮追问`:stage.status==='waiting'?'等待你的回答':stage.status==='complete'?'本环节已完成':'准备训练')):activeAgent==='coach'?(mode==='systematic'?'写下议题，从五轮追问开始':'结合问题与上下文，选择合适的伙伴'):'独立工作台 · 按当前伙伴的流程训练';
 $('training-track').hidden=activeAgent!=='coach';
 $('training-track').innerHTML=curriculum.map(id=>{const s=t?.stages?.[id];return `<span class="training-step ${active===id?'current':''} ${s?.status==='complete'?'complete':''}"><i>${s?.status==='complete'?'✓':byId(id).symbol}</i>${byId(id).name}</span>`;}).join('');
 const actions=$('training-actions');actions.innerHTML='';
 if(activeAgent==='coach'&&t){
  const next=t.queue?.find(x=>x.agent!==active&&t.stages?.[x.agent]?.status!=='complete');
  if(stage?.status==='complete'&&next)actions.innerHTML=`<button data-control="next">下一步：${byId(next.agent).name} →</button>`;
  if(stage?.status==='waiting'&&next)actions.innerHTML='<span>请先回答当前问题，也可以</span><button data-control="skip" class="muted">暂时跳过当前环节 →</button>';
  const paused=curriculum.filter(id=>id!==active&&t.stages?.[id]?.status==='waiting');
  for(const id of paused){const b=document.createElement('button');b.dataset.resume=id;b.className='muted';b.textContent='继续'+byId(id).name;actions.append(b);}
  if(mode==='systematic'&&curriculum.every(id=>t.stages?.[id]?.status==='complete'))actions.innerHTML='<span class="training-finished">✓ 本次六艺系统训练已完成，可以导出记录或开启新议题。</span>';
 }
}
function renderChat(){
 const a=byId(activeAgent),s=getSession();renderNav();
 $('chat-view').dataset.roleTheme=activeAgent;
 $('chat-view').classList.toggle('has-conversation',!!s?.messages.length);
 const presentation=mentorPresentation[activeAgent]||mentorPresentation.coach;
 $('active-symbol').dataset.mentor=activeAgent;
 $('mentor-focus').textContent=presentation.ability;
 $('mentor-ability').textContent=presentation.ability;
 $('mentor-path').innerHTML=presentation.path.map(t=>'<span>'+t+'</span>').join('<i aria-hidden="true">→</i>');
 $('mentor-caption-name').textContent=a.name;
 $('mentor-presence').textContent=busy?'正在梳理你的观点':'我在听，慢慢想。';
 $('chat-view').classList.toggle('is-responding',busy);
 $('active-symbol').textContent=a.symbol;$('hero-symbol').textContent=a.symbol;$('active-name').textContent=a.name;$('active-tag').textContent=a.tag;
 $('welcome-title').textContent=a.intro;
 if(activeAgent==='coach')$('welcome-title').innerHTML='一个问题，<br>六种思考路径。';
 $('welcome-desc').textContent=a.description;$('coach-quote').hidden=activeAgent!=='coach';
 $('starters').innerHTML=a.starters.map(t=>`<button data-starter="${escape(t)}"><span>${escape(t)}</span><span>↗</span></button>`).join('');
 $('welcome').hidden=!!s?.messages.length;$('messages').innerHTML='';
 if(s?.messages.length){appendMessage({role:'assistant',content:a.opening,opening:true},null);for(const m of s.messages)appendMessage(m,s);}
 $('send-button').classList.toggle('stop',busy);$('send-button').textContent=busy?'■':'↑';$('send-button').setAttribute('aria-label',busy?'停止生成':'发送消息');
 renderTraining();studio.toolsFor(activeAgent);if(s?.messages.length)scrollEnd();else requestAnimationFrame(()=>$('message-scroll').scrollTop=0);
}
function inline(text){return escape(text).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1 ↗</a>');}
function markdown(text){
 const chunks=text.split(/(```[\s\S]*?```)/g);
 return chunks.map(c=>{
  if(c.startsWith('```'))return '<pre><code>'+escape(c.replace(/^```[^\n]*\n?/,'').replace(/```$/,''))+'</code></pre>';
  return c.split(/\n\s*\n/).filter(Boolean).map(block=>{
   if(/^#{1,4}\s/.test(block)){const [heading,...rest]=block.split('\n');return '<h3>'+inline(heading.replace(/^#{1,4}\s/,''))+'</h3>'+(rest.length?markdown(rest.join('\n')):'');}
   const lines=block.split('\n');if(lines.every(l=>/^\s*[-*]\s/.test(l)))return '<ul>'+lines.map(l=>'<li>'+inline(l.replace(/^\s*[-*]\s/,''))+'</li>').join('')+'</ul>';
   return '<p>'+inline(block)+'</p>';
  }).join('');
 }).join('');
}
function appendMessage(m,s){
 const node=document.createElement('article');node.className='message '+(m.role==='user'?'user':'ai');node.dataset.messageId=m.id||'';
 const a=byId(m.routed||s?.agent||activeAgent);
 node.innerHTML=`<div class="message-avatar">${m.role==='user'?'我':a.symbol}</div><div class="message-body"><div class="message-header"><span>${m.role==='user'?'你':escape(a.name)}</span>${m.routed&&s?.agent==='coach'?'<span>· 思维教练调度</span>':''}</div><div class="message-phase"></div><div class="message-content"></div><div class="message-artifacts"></div><div class="message-error"></div><div class="message-actions"></div></div>`;
 if(m.role!=='user'){const avatar=node.querySelector('.message-avatar');avatar.classList.add('mentor-portrait');avatar.dataset.mentor=a.id;avatar.setAttribute('aria-hidden','true');}
 $('messages').append(node);updateMessage(node,m);
 if(!m.opening){const actions=node.querySelector('.message-actions');const copy=document.createElement('button');copy.textContent='复制';copy.onclick=()=>copyText(m.content,copy);actions.append(copy);if(m.role==='user'){const pin=document.createElement('button');pin.textContent='加入学习笔记';pin.onclick=()=>{notes=(notes+'\n'+m.content).trim().slice(-5000);persist();toast('已加入跨角色学习笔记');};actions.append(pin);}}
 return node;
}
function updateMessage(node,m){
 node.querySelector('.message-content').innerHTML=m.content?markdown(m.content):m.error?'<p>未收到完整回复。</p>':`<span class="typing">${escape(m.statusText||'正在整理思路…')}</span>`;
 if(m.debate?.clue){const el=node.querySelector('.message-content'),clue=escape(m.debate.clue);el.innerHTML=el.innerHTML.replace(clue,'<mark>'+clue+'</mark>');}
 node.querySelector('.message-phase').textContent=[m.phase,m.routeReason].filter(Boolean).join(' · ');
 const artifacts=node.querySelector('.message-artifacts');
 const signature=JSON.stringify([m.feedback,m.graph,m.sources,m.socraticTrace,m.assessmentIds,m.trajectory,m.conceptCard,m.essay,m.table,m.visual,m.illustration,m.debate,m.evaluationError]);
 if(artifacts.dataset.signature!==signature){
 artifacts.dataset.signature=signature;artifacts.innerHTML='';
 if(m.feedback){const feedback=document.createElement('div');feedback.className='feedback-note';feedback.textContent='模型练习反馈：'+({correct:'已抓住要点',partial:'还需补充',incorrect:'需要修正'}[m.feedback.verdict]||'待核验')+'。'+m.feedback.feedback;artifacts.append(feedback);}
 if(m.graph&&m.routed!=='argument'){const preview=document.createElement('button');preview.className='inline-graph';preview.innerHTML=`<span>⌘</span><span><strong>${escape(m.graph.claim)}</strong><small>${m.graph.branches.length} 个分支 · 查看本次分析结构图 ↗</small></span>`;preview.onclick=()=>showGraph(m.graph,m.routed==='planner');artifacts.append(preview);}
 if(m.socraticTrace?.records?.length){
  const trace=document.createElement('details');trace.className='knowledge-sources reflection-trace';
  const summary=document.createElement('summary');summary.textContent='回看我的原话 · '+m.socraticTrace.answered+' 次回答';trace.append(summary);
  for(const record of m.socraticTrace.records){
   const section=document.createElement('section');section.className='course-reference';
   const label=document.createElement('strong');label.textContent=record.label;section.append(label);
   if(record.question){const question=document.createElement('p');question.className='trace-question';question.textContent='当时的追问：'+record.question;section.append(question);}
   const original=document.createElement('p');original.textContent=record.content;section.append(original);trace.append(section);
  }
  artifacts.append(trace);
 }
 if(m.sources?.length){
  const details=document.createElement('details');details.className='knowledge-sources';
  const summary=document.createElement('summary');summary.textContent='教材与课程参考 · '+m.sources.map(s=>s.term).join('、');details.append(summary);
  for(const source of m.sources){
   for(const reference of source.references||[]){
    const card=document.createElement('section');card.className='course-reference';
    const title=document.createElement('strong');title.textContent='《'+reference.title+'》'+(reference.author?' · '+reference.author:'');
    const location=document.createElement('div');location.className='reference-location';location.textContent=[reference.kind,reference.chapter,reference.printedPages?.length?'教材页码 '+reference.printedPages.join('、')+' 页':'','PDF 第 '+reference.pdfPages.join('、')+' 页'].filter(Boolean).join(' · ');
    const note=document.createElement('p');note.textContent='相关要点：'+reference.summary;
    const file=document.createElement('small');file.textContent='资料文件：'+reference.file;
    card.append(title,location,note,file);if(reference.document==='book'){const link=document.createElement('a');link.href='/api/textbook.pdf#page='+reference.pdfPages[0];link.target='_blank';link.rel='noopener';link.textContent='打开教材原页 ↗';card.append(link);}details.append(card);
   }
  }
  if(details.children.length>1)artifacts.append(details);
 }
 }
 node.querySelector('.message-error').textContent=m.error||'';studio.renderArtifacts(m,node);
}
function scrollEnd(){requestAnimationFrame(()=>$('message-scroll').scrollTop=$('message-scroll').scrollHeight);}
function setBusy(value){busy=value;studio.setThinking(value);$('chat-view').classList.toggle('is-responding',value);$('mentor-presence').textContent=value?'正在梳理你的观点':'我在听，慢慢想。';$('send-button').classList.toggle('stop',value);$('send-button').textContent=value?'■':'↑';$('send-button').setAttribute('aria-label',value?'停止生成':'发送消息');$('map-button').disabled=value;}
async function readEvents(response,onEvent){
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
 try{while(true){const {value,done}=await reader.read();buffer+=done?decoder.decode():decoder.decode(value,{stream:true});let match;while((match=buffer.match(/\r?\n\r?\n/))){const index=match.index,part=buffer.slice(0,index);buffer=buffer.slice(index+match[0].length);const event=part.split(/\r?\n/).find(l=>l.startsWith('event:'))?.slice(6).trim();const data=part.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(data)onEvent(event,JSON.parse(data));}if(done)break;}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
async function send(options={}){
 if(busy){controller?.abort();return;}
 if(studio.busy()){toast('请先完成或暂停当前训练任务。');return;}
 const text=options.text||$('message-input').value.trim();if(!text){$('message-input').focus();return;}
 if(!config.configured){openSettings();toast('请先配置大模型，输入内容已为你保留。');return;}
 let session=getSession();if(!session){session={id:crypto.randomUUID(),agent:activeAgent,title:text.slice(0,40),created:Date.now(),updated:Date.now(),messages:[]};sessions.push(session);activeSession=session.id;}
 const control=options.control||(activeAgent==='coach'&&(!session.training&&draftMode==='systematic'||/^开始系统训练/.test(text))?{type:'start'}:undefined);
 if(session.messages.filter(m=>!m.error).length>114){toast('本段会话较长，请开启新对话。');return;}
 const user={id:crypto.randomUUID(),role:'user',content:text,time:Date.now()};
 session.messages.push(user);session.updated=Date.now();
 // Keep failed responses and their paired user turn out of future model context.
 const conversation=[];for(let i=0;i<session.messages.length;i++){const m=session.messages[i];if(m.error||m.role==='user'&&session.messages[i+1]?.error)continue;conversation.push({role:m.role,content:m.content,routed:m.routed});}
 const answer={id:crypto.randomUUID(),role:'assistant',content:'',time:Date.now(),pending:true};session.messages.push(answer);
 if(!options.text)$('message-input').value='';resizeInput();persist();setBusy(true);renderChat();
 let node=$('messages').lastElementChild;controller=new AbortController();let completed=false;
 try{
  const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({agent:activeAgent,messages:conversation,context:notes,training:session.training||{mode:draftMode},control})});
  if(!res.ok){const data=await res.json();throw new Error(data.error||'请求未完成');}
  await readEvents(res,(event,data)=>{
   if(event==='status'){answer.statusText=data.text;updateMessage(node,answer);}
   if(event==='meta'){answer.routed=data.agent;answer.phase=data.phase;answer.routeReason=activeAgent==='coach'?data.reason:'';answer.feedback=data.feedback;answer.sources=data.sources;answer.socraticTrace=data.socraticTrace;node.querySelector('.message-avatar').textContent=byId(data.agent).symbol;node.querySelector('.message-avatar').dataset.mentor=data.agent;node.querySelector('.message-header').firstElementChild.textContent=data.name;if(activeAgent==='coach'&&!node.querySelector('.coach-route-label')){const label=document.createElement('span');label.className='coach-route-label';label.textContent='· 思维教练调度';node.querySelector('.message-header').append(label);}updateMessage(node,answer);}
   if(event==='delta'){answer.content+=data.text;updateMessage(node,answer);scrollEnd();}
   if(event==='error')throw new Error(data.message);
   if(event==='artifacts'){answer.graph=data.graph;answer.sources=data.sources;answer.conceptCard=data.conceptCard;answer.visual=data.visual;answer.debate=data.debate;answer.table=data.table;updateMessage(node,answer);scrollEnd();}
   if(event==='training'){answer.checkpoint=data.state;answer.feedback=data.feedback;updateMessage(node,answer);}
   if(event==='done'){completed=true;if(answer.checkpoint){session.training=answer.checkpoint;delete answer.checkpoint;renderTraining();}}
  });
  if(!completed)throw new Error('连接提前结束，请重试。');studio.speak(answer.content);studio.afterTurn(answer,session);
 }catch(e){answer.error=e.name==='AbortError'?'已停止生成。可重新发送或继续讨论。':e.message;updateMessage(node,answer);if(!answer.content){const retry=document.createElement('button');retry.textContent='重新发送';retry.onclick=()=>{if(isLocked())return;$('message-input').value=text;resizeInput();send();};node.querySelector('.message-actions').append(retry);}}
 finally{delete answer.pending;delete answer.checkpoint;session.updated=Date.now();setBusy(false);controller=null;persist();renderNav();renderTraining();}
}
function resizeInput(){const el=$('message-input');el.style.height='auto';el.style.height=Math.min(150,el.scrollHeight)+'px';$('char-count').textContent=el.value.length+' / 12000';}
function newChat(){if(isLocked())return;activeSession=null;view('chat');renderChat();$('message-input').focus();}
function formatDate(t){return new Intl.DateTimeFormat('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(t);}
function renderHistory(){
 const query=$('history-search').value.trim().toLowerCase();const list=sessions.filter(s=>s.messages.length).filter(s=>(s.title+' '+byId(s.agent).name+' '+s.messages.map(m=>m.content).join(' ')).toLowerCase().includes(query)).sort((a,b)=>b.updated-a.updated);
 $('history-list').innerHTML='';if(!list.length){$('history-list').innerHTML='<div class="empty-state">◷<br>'+ (query?'没有找到相关对话。':'还没有对话记录。<br>从一个小问题开始吧。')+'</div>';return;}
 for(const s of list){const a=byId(s.agent),item=document.createElement('div');item.className='history-item';item.innerHTML=`<span class="card-symbol">${a.symbol}</span><button class="history-info"><strong>${escape(s.title)}</strong><p>${escape(s.messages.filter(m=>m.content).at(-1)?.content.slice(0,100)||'')}</p><small>${a.name} · ${s.messages.filter(m=>m.role==='user').length} 次提问 · ${formatDate(s.updated)}</small></button><button class="history-delete" aria-label="删除此对话">×</button>`;item.querySelector('.history-info').onclick=()=>selectAgent(s.agent,s.id);item.querySelector('.history-delete').onclick=()=>{if(isLocked())return;confirm('删除这段对话？','删除后无法恢复。可以先导出全部记录。',()=>{sessions=sessions.filter(x=>x.id!==s.id);if(activeSession===s.id)activeSession=null;persist();renderHistory();renderNav();});};$('history-list').append(item);}
}
function renderProfile(){
 const users=sessions.flatMap(s=>s.messages.filter(m=>m.role==='user').map(m=>({...m,agent:s.agent})));const today=new Date().toDateString();const todayCount=users.filter(m=>new Date(m.time).toDateString()===today).length;const days=new Set(users.map(m=>new Date(m.time).toDateString())).size;
 $('stats').innerHTML=[[sessions.filter(s=>s.messages.length).length,'已保存对话'],[users.length,'累计提问'],[todayCount,'今日提问'],[days,'练习天数']].map(([n,t])=>`<div class="stat-card"><strong>${n}</strong><span>${t}</span></div>`).join('');
 const rank=agents.map(a=>({...a,count:users.filter(m=>m.agent===a.id).length})).filter(a=>a.count).sort((a,b)=>b.count-a.count);
 $('rank-list').innerHTML=rank.length?rank.map(a=>`<div class="rank-row"><span>${a.name}</span><div class="rank-track"><div class="rank-fill" style="width:${a.count/users.length*100}%"></div></div><small>${a.count} 次</small></div>`).join(''):'<p class="empty-state">开始对话后，记录会出现在这里。</p>';
 $('recent-topics').innerHTML=users.length?users.sort((a,b)=>b.time-a.time).slice(0,5).map(m=>`<div class="topic">${escape(m.content.slice(0,100))}<br><small>${byId(m.agent).name} · ${formatDate(m.time)}</small></div>`).join(''):'<p class="empty-state">还没有思考片段。</p>';
}
function download(name,text,type='text/plain'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
async function copyText(text,button){if(button?.disabled)return;if(button)button.disabled=true;try{await navigator.clipboard.writeText(text);if(button){button.textContent='✓ 已复制';button.classList.add('action-success');setTimeout(()=>{button.textContent='复制';button.classList.remove('action-success');button.disabled=false;},1800);}else toast('已复制');}catch{if(button)button.disabled=false;toast('复制未成功，请手动选择文字复制。');}}
function confirm(title,description,action){confirmAction=action;$('confirm-title').textContent=title;$('confirm-description').textContent=description;$('confirm-dialog').showModal();}
function openSettings(){if(isLocked())return;$('base-url').value=config.baseURL||'';$('model-name').value=config.model||'';$('api-key').value='';$('provider').value=config.baseURL?.includes('dashscope')?'qwen':config.baseURL?.includes('deepseek')?'deepseek':'custom';$('settings-result').textContent='';$('settings-dialog').showModal();}
async function saveConfig(test=false){
 const result=$('settings-result');result.classList.remove('error');result.textContent='正在保存…';
 const trigger=test?$('test-model'):$('settings-form').querySelector('[type=submit]'),label=trigger.textContent;
 trigger.textContent=test?'正在连接…':'正在保存…';trigger.setAttribute('aria-busy','true');
 for(const b of $('settings-form').querySelectorAll('button:not(.close-dialog)'))b.disabled=true;
 try{config={...config,...await api('/api/config',{baseURL:$('base-url').value,model:$('model-name').value,apiKey:$('api-key').value})};$('api-key').value='';renderStatus();result.textContent='已保存。';if(test){result.textContent='正在测试模型连接…';await api('/api/test',{});result.textContent='连接成功，可以开始对话了。';}else{$('settings-dialog').close();toast(config.configured?'配置已保存':'地址已保存，请填写 API Key 后开始对话。');}}
 catch(e){result.classList.add('error');result.textContent=e.message;}
 finally{trigger.textContent=label;trigger.removeAttribute('aria-busy');for(const b of $('settings-form').querySelectorAll('button'))b.disabled=false;}
}
async function createMap(){
 if(isLocked())return;if(!config.configured){openSettings();return;}
 const latest=getSession()?.messages.filter(m=>m.role==='assistant'&&m.graph&&!m.error).at(-1);
 if(!$('message-input').value.trim()&&latest){showGraph(latest.graph,latest.routed==='planner');return;}
 const text=$('message-input').value.trim()||getSession()?.messages.filter(m=>m.role==='user').at(-1)?.content;
 if(!text){toast('请先输入或发送一段需要梳理的文字。');return;}
 $('map-title').textContent=activeAgent==='planner'?'把学习目标拆成行动':'把思考的结构展开';
 $('map-description').textContent=activeAgent==='planner'?'基于输入的目标生成阶段与任务。时间安排与学习建议仍需结合你的实际情况调整。':'基于最近一条用户输入生成。结构由 AI 提取，事实与支持关系仍需你核验。';
 $('map-content').innerHTML='<p class="typing">正在梳理结构，请稍候…</p>';$('download-map').disabled=true;$('map-dialog').showModal();
 try{graph=await api('/api/map',{text,kind:activeAgent==='planner'?'plan':'argument'});$('map-content').innerHTML=`<div class="map-claim">${escape(graph.claim)}</div><div class="map-branches">${graph.branches.map(b=>`<section class="map-branch"><strong>${escape(b.claim)}</strong>${b.evidence.map(e=>`<div class="map-evidence">${escape(e)}</div>`).join('')}${b.gap?`<div class="map-gap">待补充：${escape(b.gap)}</div>`:''}</section>`).join('')}</div><p class="map-caution">${escape(graph.caution||'结构由 AI 提取，请对照原文核验。')}</p>`;$('download-map').disabled=false;}
 catch(e){$('map-content').textContent=e.message;}
}
function showGraph(value,isPlan=false){graph=value;$('map-title').textContent=isPlan?'把学习目标拆成行动':'把思考的结构展开';$('map-description').textContent='这张图来自对应回复使用的同一份结构数据。请对照原文核验，学习安排也可继续在对话中调整。';$('map-content').innerHTML=`<div class="map-claim">${escape(graph.claim)}</div><div class="map-branches">${graph.branches.map(b=>`<section class="map-branch"><strong>${escape(b.claim)}</strong>${b.evidence.map(e=>`<div class="map-evidence">${escape(e)}</div>`).join('')}${b.gap?`<div class="map-gap">待补充：${escape(b.gap)}</div>`:''}</section>`).join('')}</div><p class="map-caution">${escape(graph.caution||'请核验事实与来源。')}</p>`;$('download-map').disabled=false;$('map-dialog').showModal();}
function changeMode(mode){if(isLocked())return;if(activeAgent!=='concept')activeAgent='coach';activeSession=null;draftMode=mode;view('chat');renderChat();toast(mode==='systematic'?'已开启新的系统训练，请输入一个议题。':'已开启新的自由问答，之前记录已保留。');$('message-input').focus();}
function trainingControl(type,agent){if(isLocked())return;const state=getSession()?.training;const next=state?.queue?.find(t=>t.agent!==state.active&&state.stages[t.agent]?.status!=='complete');const content=type==='resume'?'继续之前的'+byId(agent).name+'训练':type==='skip'?'暂时跳过当前环节，进入'+byId(next?.agent).name:'进入下一环节：'+byId(next?.agent).name;send({text:content,control:{type,agent}});}
document.addEventListener('click',e=>{const agent=e.target.closest('[data-agent]');if(agent)selectAgent(agent.dataset.agent);const starter=e.target.closest('[data-starter]');if(starter){$('message-input').value=starter.dataset.starter;resizeInput();$('message-input').focus();}const navigation=e.target.closest('[data-view]');if(navigation&&!isLocked())view(navigation.dataset.view);const mode=e.target.closest('[data-mode]');if(mode)changeMode(mode.dataset.mode);const control=e.target.closest('[data-control]');if(control)trainingControl(control.dataset.control);const resume=e.target.closest('[data-resume]');if(resume)trainingControl('resume',resume.dataset.resume);});
$('send-button').onclick=()=>send();$('message-input').oninput=resizeInput;$('message-input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send();}};
$('new-chat').onclick=newChat;document.querySelector('.brand').onclick=e=>{e.preventDefault();selectAgent('coach');};
$('settings-button').onclick=openSettings;$('configure-inline').onclick=openSettings;
document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('settings-form').onsubmit=e=>{e.preventDefault();saveConfig();};$('test-model').onclick=()=>{if($('settings-form').reportValidity())saveConfig(true);};
$('provider').onchange=()=>{const p=$('provider').value;if(p==='qwen'){$('base-url').value='https://dashscope.aliyuncs.com/compatible-mode/v1';$('model-name').value='qwen-plus';}if(p==='deepseek'){$('base-url').value='https://api.deepseek.com';$('model-name').value='deepseek-flash';}};
$('disconnect').onclick=async()=>{try{config={...config,...await api('/api/config',{baseURL:config.baseURL,model:config.model,clearKey:true})};$('api-key').value='';renderStatus();$('settings-result').textContent='已从本机服务内存清除密钥。';}catch(e){toast(e.message);}};
$('clear-chat').onclick=()=>{if(isLocked())return;const s=getSession();if(!s?.messages.length){toast('当前对话是空的。');return;}confirm('清空当前对话？','这段对话将从当前浏览器中删除。',()=>{sessions=sessions.filter(x=>x.id!==s.id);activeSession=null;persist();renderChat();});};
$('confirm-cancel').onclick=()=>$('confirm-dialog').close();$('confirm-ok').onclick=()=>{$('confirm-dialog').close();confirmAction?.();confirmAction=null;};
$('history-search').oninput=renderHistory;$('profile-shortcut').onclick=()=>view('profile');
$('export-chat').onclick=()=>{const s=getSession();if(!s?.messages.length){toast('当前还没有可导出的对话。');return;}download(`${byId(s.agent).name}-${new Date().toISOString().slice(0,10)}.md`,`# ${s.title}\n\n角色：${byId(s.agent).name}\n\n`+s.messages.map(m=>`## ${m.role==='user'?'我':byId(m.routed||s.agent).name}\n\n${m.content}${m.error?'\n\n[未完成] '+m.error:''}`).join('\n\n'));};
$('export-all').onclick=()=>download('思辨学堂学习记录.json',JSON.stringify({version:3,exported:new Date().toISOString(),sessions,notes,trainingRecords:studio.exportData()},null,2),'application/json');
$('delete-all').onclick=()=>{if(isLocked())return;confirm('清除全部学习数据？','所有对话与学习笔记将删除，无法恢复。建议先到历史页面导出。',()=>{sessions=[];notes='';activeSession=null;studio.clear();persist();renderNav();renderProfile();toast('已清除全部学习数据');});};
$('map-button').onclick=createMap;$('download-map').onclick=()=>{if(graph)download('思辨结构图.json',JSON.stringify(graph,null,2),'application/json');};
function openNotes(){navClose();$('shared-notes').value=notes;$('notes-dialog').showModal();}$('save-notes').onclick=()=>{notes=$('shared-notes').value;persist();$('notes-dialog').close();toast('学习笔记已保存');};
$('sidebar-notes').onclick=openNotes;
$('menu-toggle').onclick=()=>{$('sidebar').classList.add('open');$('mobile-overlay').hidden=false;};$('mobile-overlay').onclick=navClose;
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
async function init(){try{config=await api('/api/status');agents=config.agents;sessions=sessions.filter(s=>agents.some(a=>a.id===s.agent));for(const s of sessions)for(const m of s.messages){delete m.enriching;delete m.assessing;if(m.pending){m.error='上次生成被中断，可重新发送。';delete m.pending;}}persist();renderStatus();view('chat');renderChat();studio.init();if(config.trainingVersion!==2)toast('训练逻辑已更新，请重启后端加载新版。');}catch(e){$('welcome-title').textContent='暂时无法连接本机服务';$('welcome-desc').textContent='请启动服务后刷新页面。'+e.message;}}
const studio=createStudio({api,toast,persist,session:getSession,isBusy:()=>busy,
 open(tab){if(isLocked())return;studio.mount(tab);},
 agent:()=>activeAgent,
 async send(text){await send({text});},
 async startDebate(text){if(isLocked())return;selectAgent('fallacy');activeSession=null;renderChat();await send({text});},
 coach(){selectAgent('coach');},
 records(){return conversationRecords(getSession());},
 refreshMessage(m){const node=document.querySelector('[data-message-id="'+m.id+'"]');if(node)updateMessage(node,m);},
 changeAccount(user){const key=user?'six-arts-user:'+user.id:'six-arts-v1';if(STORE===key)return;persist();STORE=key;let next={};try{next=JSON.parse(localStorage.getItem(STORE)||'{}');}catch{}sessions=Array.isArray(next.sessions)?next.sessions:[];notes=typeof next.notes==='string'?next.notes:'';activeSession=null;renderChat();},
 interrupt(){if(busy)controller?.abort();},
 async waitIdle(){for(let i=0;i<50&&busy;i++)await new Promise(r=>setTimeout(r,100));if(busy)throw new Error('请等待当前回复停止后再说。');},
 async sendVoice(text){await send({text});}
});
init();
setInterval(async()=>{if(!busy){try{const status=await api('/api/status');config={...config,...status};renderStatus();}catch{}}},20000);
