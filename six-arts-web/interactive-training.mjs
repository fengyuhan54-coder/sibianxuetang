import {teachingContext} from './course-library.mjs';
import {ModelError} from './model.mjs';
import {textbookContext,searchTextbook} from './textbook.mjs';
const str=(v,n=2000)=>typeof v==='string'&&v.trim()&&v.length<=n;
export function confusionReferences(concept,contrast){const terms=[concept,contrast].filter(t=>typeof t==='string'&&t.length>=2);return searchTextbook(terms.join(' '),5).filter(r=>terms.some(t=>r.text.includes(t))).slice(0,2).map(r=>{const at=Math.min(...terms.map(t=>r.text.indexOf(t)).filter(i=>i>=0));return {...r,text:r.text.slice(Math.max(0,at-50),at+230)};});}
export async function roundtableTurn({topic,history,question},ask,parse){
 const names=[...new Set(history.map(x=>x.name))],target=names.find(n=>question.includes('@'+n)||question.includes('＠'+n));
 const r=parse(await ask('roundtable-turn',[{role:'system',content:'你主持教学模拟圆桌，输出JSON：{"speakers":[{"name":"角色","value":"价值前提","statement":"有理由的发言","respondsTo":"回应的角色名，没有则空字符串"}],"tradeoff":"核心权衡","question":"邀请用户参与的开放问题"}。首次生成3至5个相关角色；有history时沿用角色，回应用户最新输入和其他角色的具体理由，有逻辑碰撞，不重复初始自我介绍。若指定target则只让该角色回应。没有指定时所有角色各发言一次，每条60至150字。保留合理分歧，不虚构事实、研究、真实专家引文。没有提供真实试点资料，禁止声称我们试点、我们研究或已经证明；提出方案时明确是设想。'+teachingContext('perspectives')},{role:'user',content:JSON.stringify({topic,history:history.slice(-40),question,target})}],3000));
 if(!Array.isArray(r.speakers)||r.speakers.length<(target?1:3)||r.speakers.length>(target?1:5)||r.speakers.some(s=>!['name','value','statement'].every(k=>str(s[k]))||typeof s.respondsTo!=='string'||target&&s.name!==target||names.length&&!names.includes(s.name))||!str(r.tradeoff)||!str(r.question))throw new ModelError('圆桌发言未完整生成，请重试。');
 return {...r,topic,time:Date.now(),history:[...history,...r.speakers]};
}
export function validateVisual(v){
 if(v?.type==='none')return null;
 if(!v||!['comparison','tree','flow'].includes(v.type)||!str(v.title,100)||!str(v.reason,600)||!Array.isArray(v.nodes)||v.nodes.length<2||v.nodes.length>14||!Array.isArray(v.edges)||v.edges.length>20)throw new ModelError('概念图解结构不完整，请重试。');
 const ids=new Set();for(const n of v.nodes){if(!str(n.id,30)||ids.has(n.id)||!str(n.label,100)||!str(n.detail,1800))throw new ModelError('概念图解节点不完整，请重试。');ids.add(n.id);}
 for(const e of v.edges)if(!ids.has(e.from)||!ids.has(e.to)||e.from===e.to||!str(e.label,100))throw new ModelError('概念图解关系不完整，请重试。');
 if(v.type==='tree'){
  const parents=new Map();for(const e of v.edges){if(parents.has(e.to))throw new ModelError('概念包含关系必须是树状结构。');parents.set(e.to,e.from);}
  if(v.nodes.filter(n=>!parents.has(n.id)).length!==1)throw new ModelError('概念树需要唯一的中心概念。');
  for(const n of v.nodes){const seen=new Set();let id=n.id;while(id){if(seen.has(id))throw new ModelError('概念包含关系不能循环。');seen.add(id);id=parents.get(id);}}
 }
 return v;
}
export async function conceptVisual({question,reply,history},ask,parse){
 for(let attempt=0;attempt<2;attempt++)try{
  const raw=await ask('concept-visual',[{role:'system',content:'你是概念智析。只输出合法JSON。根据当前问题、回答和对话上下文决定是否需要概念图解。大概、可能只是线索，不机械判为模糊；合理概率表述不触发。用户确实混淆边界、包含关系、步骤，或图解有助于解释当前概念时生成。普通简短事实问答无需图，输出{"type":"none"}。需要图时输出{"type":"comparison|tree|flow","title":"具体标题","reason":"为什么这张图有助于理解当前问题","nodes":[{"id":"n1","label":"短标题","detail":"节点的具体解释和例子"}],"edges":[{"from":"n1","to":"n2","label":"关系"}]}。comparison节点依次成对呈现同一维度的两个对象，每节点标题标明对象与维度（如有效论证·前提联系、无效论证·前提联系）；tree必须单根无环，用真实的包含/分类关系，不把相关当包含；flow有序呈现当前概念从含混到澄清的具体过程。2至14节点，具体内容随对话变化，不输出固定模板。禁止编造教材引文页码。'+textbookContext(question)+(attempt?'上一份结构无效，请修正。':'')},{role:'user',content:JSON.stringify({question,reply,history:history.slice(-6)})}],2600);
  return validateVisual(parse(raw));
 }catch(e){if(e.name==='AbortError'||attempt===1)throw e;}
}
export async function debateTurn({stage,text,end,resume,ask,parse}){
 const s=stage;s.debateTurns ||= [];s.diagnostics ||= [];
 if(end){
  const userTurns=s.debateTurns.filter(t=>t.role==='user').map((t,i)=>({turn:i+1,text:t.content}));
  const raw=await ask('debate-review',[{role:'system',content:'对整场实际对战统一复盘，只输出JSON：{"summary":"围绕同一议题回顾交锋脉络，不编造进步","strengths":[{"turn":1,"reason":"说明该轮用户具体做对了什么；不能只复制其观点，更不能把明确谬误当优点。没有可确认优点可空数组"}],"next":"下一次可练习的具体方向","confusions":[{"turn":1,"concept":"被混淆的概念","contrast":"另一概念","reason":"冲突原因","suggestion":"改进建议"}]}。turn只能选择userTurns中真实存在的编号。用户原话由程序根据编号插入，不要输出quote。没有充分依据的混淆返回空数组，不为了凑表编错。未回答则说明未发生交锋。只评价提供的用户发言，不把AI观点当用户观点。'},{role:'user',content:JSON.stringify({topic:s.topic,turns:s.debateTurns,userTurns,diagnostics:s.diagnostics})}],2600);
  const r=parse(raw);if(!str(r.summary,4000)||!str(r.next)||!Array.isArray(r.strengths)||!r.strengths.every(x=>userTurns.some(t=>t.turn===Number(x.turn))&&str(x.reason))||!Array.isArray(r.confusions))throw new ModelError('整场复盘未完整生成，请重试。');
  for(const c of r.confusions){const turn=userTurns.find(t=>t.turn===Number(c.turn));if(turn)c.quote=turn.text;if(!turn||!['concept','contrast','reason','suggestion'].every(k=>str(c[k])))throw new ModelError('复盘混淆项缺少用户原话依据，请重试。');c.references=confusionReferences(c.concept,c.contrast);}
  s.status='complete';s.step='debate-ended';s.pendingOpponent='';
  return {text:`**整场对战复盘**\n\n${r.summary}\n\n${r.strengths.map(x=>'- 第 '+x.turn+' 次回应：'+x.reason).join('\n')}\n\n**下一步**\n${r.next}`,artifact:{status:'ended',report:r,turns:s.debateTurns,userTurns,diagnostics:s.diagnostics}};
 }
 if(s.step==='debate-paused'&&resume){const reply=s.pendingOpponent;s.pendingOpponent='';s.step='debate';s.debateTurns.push({role:'assistant',content:reply});return {text:reply,artifact:{status:'active',round:s.debateTurns.filter(t=>t.role==='user').length}};}
 const first=!s.debateTurns.length;
 let diagnosis=null;
 if(!first){const checked=parse(await ask('debate-check',[{role:'system',content:'独立检查用户本轮反驳的逻辑。只输出JSON：{"coach":null}。确实出现谬误时输出{"coach":{"quote":"用户answer中的逐字连续片段","type":"谬误名称","reason":"说明从哪条理由到哪条结论缺少联系","question":"引导用户修正的问题"}}。必须结合上下文，不按关键词判断。不把反驳AI、不确定、观点修正本身当成错误；多数人使用不能推出答案都正确属于需要检查的推理。逐字quote只取用户当前answer，不准改写。'},{role:'user',content:JSON.stringify({history:s.debateTurns.slice(-8),answer:text})}],1300));diagnosis=checked.coach; if(diagnosis&&(!str(diagnosis.quote)||!text.includes(diagnosis.quote)||!['type','reason','question'].every(k=>str(diagnosis[k]))))throw new ModelError('教练提示缺少本轮原话依据，请重试。');}
 const raw=await ask('debate-turn',[{role:'system',content:'你是教学模拟中的诡辩士，与用户就同一议题持续多轮交锋。输出JSON：{"acknowledgment":"准确承接对方本轮理由，不能冒充用户用第一人称重复其观点，首次说明自己的立场","challenge":"针对该理由的新反驳或待检验前提","question":"邀请用户回应的一个聚焦问题","clue":"初级时显著缺口的逐字片段，其他空字符串"}。初次提出可反驳的立场；之后必须引用或准确承接用户刚才的反驳，回应其具体理由，承认有效反驳并调整论证，继续同一议题，不能答对就换题、宣布过关或自动结束。只由用户主动结束整场。竞技但尊重，不嘲讽，不编统计或新闻，不把未经证实的“多数学生都”等泛化作为事实；可以明确设定假设情境。初级显著缺口并返回clue为reply中须高亮的逐字片段，中级隐蔽，高级多种缺口但仍同题。教练独立检查，当前仅写对手观点。所有字段用纯中文文本，不含HTML标签或JSON结束符。不得把反驳AI或承认不确定当成谬误，类比不是证据。coach出现时reply仍生成但系统暂不向用户展示，等待修正或继续。'},{role:'user',content:JSON.stringify({topic:s.topic,level:s.level,history:s.debateTurns.slice(-80),answer:first?null:text})}],2200);
 const r=parse(raw);if(str(r.acknowledgment)&&str(r.challenge)&&str(r.question))r.reply=first?['这是教学模拟中的对抗练习。我先提出一个供你检验的论证：',r.challenge.replace(/^(?:但|然而)[，,]?/,''),r.question].join('\n\n'):[r.acknowledgment,r.challenge,r.question].join('\n\n');r.coach=diagnosis; if(!str(r.reply,4000)||/<\/?[a-z][^>]*>/i.test(r.reply))throw new ModelError('对手回应未完整生成，请重试。');
 if(r.coach&&(!str(r.coach.quote)||!text.includes(r.coach.quote)||!['type','reason','question'].every(k=>str(r.coach[k]))))throw new ModelError('教练提示缺少本轮原话依据，请重试。');
 if(!first)s.debateTurns.push({role:'user',content:text});s.status='waiting';
 if(r.coach&&!first){s.pendingOpponent=r.reply;s.step='debate-paused';s.diagnostics.push({...r.coach,turn:s.debateTurns.filter(t=>t.role==='user').length});return {text:`**教练视角 · 暂停对手**\n\n你刚才说：“${r.coach.quote}”\n\n${r.coach.reason}\n\n${r.coach.question}`,artifact:{status:'paused',coach:r.coach}};}
 s.step='debate';s.pendingOpponent='';s.debateTurns.push({role:'assistant',content:r.reply});
 return {text:r.reply,artifact:{status:'active',round:s.debateTurns.filter(t=>t.role==='user').length,clue:s.level===1&&str(r.clue)&&r.reply.includes(r.clue)?r.clue:''}};
}
