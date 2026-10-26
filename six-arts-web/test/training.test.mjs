import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runTraining,cleanState,decideRoute,parseStructured} from '../training.mjs';
import {qualityResult} from '../test-fixtures/socratic-quality.mjs';
import {socraticCandidate,socraticTransition} from '../test-fixtures/socratic-candidate.mjs';

const analysis={claim:'应区分不同AI使用方式',structure:'原文为因果论证，概括范围过强。',fallacies:['不能仅凭相关现象确定因果。'],strengths:['提出了明确议题。'],weaknesses:['没有提供比较数据。'],suggestions:['补充使用方式与学习结果的比较。'],branches:[{claim:'直接复制可能减少练习',evidence:['原文提到直接复制'],gap:'需要比较证据'}],caution:'事实尚未核验'};
const plan={goal:'四周练习思辨',assumptions:['每周三小时'],stages:[{name:'检查论证',duration:'第一周',tasks:['分析两段文本'],resources:['现有课程笔记'],check:'能够指出主张和证据'}],review:'每周换一篇新文本复盘。'};
function fakeModel({verdict='correct',route}={}){
 const calls=[];
 const ask=async(kind,messages,tokens,onDelta)=>{
  calls.push({kind,messages});
  if(kind==='roundtable-turn')return JSON.stringify({speakers:['教师','学生','家长'].map(name=>({name,value:'学习',statement:'需要检查相关理由。',respondsTo:''})),tradeoff:'自主与支持',question:'你如何权衡？'});
  if(kind==='concept-visual')return JSON.stringify({type:'none'});
  if(kind==='debate-check')return JSON.stringify({coach:null});
  if(kind==='debate-turn')return JSON.stringify({reply:'你刚才的理由值得检验，但是否意味着所有情况下都应如此？',coach:null});
  if(kind==='debate-review')return JSON.stringify({summary:'围绕原议题回顾实际交锋。',strengths:[],next:'继续检查前提。',confusions:[]});
  if(kind==='socratic-quality')return qualityResult();
  if(kind==='socratic-transition')return JSON.stringify(socraticTransition(JSON.parse(messages[1].content)));
  if(kind==='route')return JSON.stringify(route||{agent:'socratic',relation:'answer',reason:'用户正在回答追问',tasks:[]});
  if(kind==='concept-lesson')return JSON.stringify({term:JSON.parse(messages[1].content).knowledge[0]?.term||'相关关系与因果关系',definition:'检查理由与推理的思考方式',plain:'先核对证据与推理，再根据理由修正判断。思考思考。',facets:'区分思维能力与理智素养',misconceptions:['批判不等于反对'],positive:'假设：核验理由后接受判断。',negative:'假设：未经核验就直接否定。',question:'请用自己的话复述或举例。'});
  if(kind==='concept-followup')return JSON.stringify({explanation:'你这次说明了检查依据与推理的要点。',case:'假设：对一条消息核验来源后再判断可信度。',task:'请补充一个检验判断的例子。'});
  if(kind==='assessment')return JSON.stringify({verdict,hasRestatement:true,hasExample:true,feedback:verdict==='correct'?'用户说明了推理缺口及其原因。':'还没有说明关键推理步骤。'});
  if(kind==='analysis')return JSON.stringify(analysis);
  if(kind==='plan')return JSON.stringify(plan);
  if(kind==='socratic-question')return JSON.stringify(socraticCandidate(JSON.parse(messages[1].content)));
  if(kind==='socratic-review'){const data=JSON.parse(messages.at(-1).content);return JSON.stringify({gesture:'略作停顿',opening:'让我们一起回看刚才的思考。',steps:data.records.map(r=>({index:r.index,reflection:'这一回答为接下来的检验留下了线索。'})),synthesis:'这些记录呈现了你已表达的思路，仍有一些依据可以继续检验。',closing:'这段对话中，你最想保留或重新审视的认识是什么？'});}
  const text='这是测试模型生成的真实测试响应：请说明你的理由。';onDelta?.(text);return text;
 };
 return {ask,calls};
}
async function turn(agent,text,training,model=fakeModel(),control){
 let meta;const result=await runTraining({agent,messages:[{role:'user',content:text}],training,control},{ask:model.ask,onMeta:m=>{meta=m;}});
 return {...result,meta,model};
}

test('a definition answering the coach stays with Socrates while an explicit explanation request can switch',async()=>{
 const state=cleanState({active:'socratic',topic:'AI与独立思考',stages:{socratic:{topic:'AI与独立思考',status:'waiting',round:1,step:'question',question:'那么，在你看来，究竟什么是“独立思考”？'}}});
 const ask=async()=>{throw new Error('An explicit answer must not need semantic rerouting');};
 const answer='独立思考就是自己解决问题自己先进行思考，对这个问题有自己的见解';
 const route=await decideRoute({agent:'coach',text:answer,state,messages:[{role:'user',content:answer}]},ask);
 assert.equal(route.agent,'socratic');assert.equal(route.relation,'answer');
 const request=await decideRoute({agent:'coach',text:'请解释一下独立思考',state,messages:[]},ask);
 assert.equal(request.agent,'concept');assert.equal(request.relation,'new');
});
test('Socratic questioning waits for five real answers before reviewing',async()=>{
 let result=await turn('socratic','我认为努力就一定能成功');
 assert.equal(result.state.stages.socratic.round,1);assert.equal(result.state.stages.socratic.status,'waiting');
 for(let answer=1;answer<=4;answer++){
  result=await turn('socratic','这是我的第'+answer+'次回答，定义和证据也需要检查。',result.state);
  assert.equal(result.state.stages.socratic.round,answer+1);assert.equal(result.state.stages.socratic.status,'waiting');
 }
 result=await turn('socratic','还需要考虑环境和个人差异。',result.state);
 assert.equal(result.state.stages.socratic.status,'complete');assert.match(result.meta.phase,/复盘/);
 assert.match(result.model.calls.findLast(c=>c.kind==='socratic-review').messages[0].content,/不追加第六轮/);
 assert.equal(result.state.stages.socratic.answers.length,5);
 assert.match(result.model.calls.at(-1).messages.at(-1).content,/这是我的第1次回答/);
});
test('Greeting does not consume a Socratic question',async()=>{
 const first=await turn('socratic','你好');assert.equal(first.state.stages.socratic.round,0);
 const second=await turn('socratic','努力一定会成功',first.state);assert.equal(second.state.stages.socratic.round,1);
});
test('Coach can pause for a concept, verify a restatement, and resume without consuming an answer',async()=>{
 let r=await turn('coach','我认为人工智能会削弱思考');
 r=await turn('coach','什么是批判性思维？',r.state);
 assert.equal(r.state.active,'concept');assert.equal(r.state.stages.socratic.round,1);assert.equal(r.sources[0].id,'K01');
 r=await turn('coach','我会检查证据、推理和替代解释，也愿意修正结论。',r.state,fakeModel({route:{agent:'concept',relation:'answer',reason:'用户在复述',tasks:[]}}));
 assert.equal(r.state.stages.concept.status,'complete');
 r=await turn('coach','继续刚才的追问',r.state);assert.equal(r.state.active,'socratic');assert.equal(r.state.stages.socratic.round,1);
 r=await turn('coach','不同使用方式可能导致不同结果。',r.state);assert.equal(r.state.stages.socratic.round,2);
});
test('Partial concept answer stays in verification and a fresh concept restarts explanation',async()=>{
 let r=await turn('concept','什么是因果关系？',{mode:'systematic'});
 r=await turn('concept','就是两个东西同时出现。',r.state,fakeModel({verdict:'incorrect'}));
 assert.equal(r.state.stages.concept.status,'waiting');assert.equal(r.feedback.verdict,'incorrect');
 r=await turn('concept','什么是归纳推理？',r.state);
 assert.equal(r.meta.phase,'解释概念与复述举例');assert.equal(r.sources[0].id,'K05');assert.ok(!r.model.calls.some(c=>c.kind==='assessment'));
});
test('Systematic path waits for input, preserves skipped stages and supports resuming them',async()=>{
 let r=await turn('coach','讨论AI与学习',undefined,fakeModel(),{type:'start'});
 assert.equal(r.state.mode,'systematic');assert.equal(r.state.queue.length,6);
 await assert.rejects(()=>turn('coach','下一步',r.state,fakeModel(),{type:'next'}),/等待你的回答/);
 r=await turn('coach','跳过当前环节',r.state,fakeModel(),{type:'skip'});
 assert.equal(r.state.active,'concept');assert.equal(r.state.stages.socratic.status,'waiting');assert.equal(r.state.queue.at(-1).agent,'socratic');
 r=await turn('coach','继续苏格拉底',r.state,fakeModel(),{type:'resume',agent:'socratic'});assert.equal(r.state.stages.socratic.round,1);
});
test('Multi-intent coach plan queues work instead of inventing user participation',async()=>{
 const model=fakeModel({route:{agent:'concept',relation:'new',reason:'先澄清，再分析',tasks:[{agent:'concept',goal:'解释批判性思维'},{agent:'argument',goal:'分析用户论证'}]}});
 const r=await turn('coach','先讲清批判性思维，然后分析我的论证。',undefined,model);
 assert.equal(r.state.active,'concept');assert.equal(r.state.stages.concept.status,'complete');assert.equal(r.next.agent,'argument');assert.equal(model.calls.filter(c=>c.kind==='reply'||c.kind==='concept-lesson').length,1);
});
test('Argument graph and five-part output derive from the same structured analysis',async()=>{
 const model=fakeModel();const r=await turn('argument','请分析这段文本：AI直接复制可能减少学生独立练习，所以一切AI应用都必须禁止。',undefined,model);
 assert.equal(r.graph.claim,analysis.claim);assert.deepEqual(r.graph.branches[0].evidence,analysis.branches[0].evidence);
 assert.equal(r.state.stages.argument.status,'complete');assert.equal(model.calls.filter(c=>c.kind==='analysis').length,1);
 const source=model.calls.find(c=>c.kind==='analysis').messages.at(-1).content;assert.match(source,/待分析的用户原文/);
});
test('Missing argument text prompts for material and planning produces a matching map',async()=>{
 const r=await turn('argument','请分析这段文本');assert.equal(r.state.stages.argument.status,'waiting');assert.equal(r.graph,null);
 const planned=await turn('planner','四周学习批判性思维，每周三小时');assert.equal(planned.graph.claim,plan.goal);assert.match(planned.graph.branches[0].claim,/第一周/);assert.equal(planned.state.stages.planner.status,'complete');
});
test('Continuous debate stays on the same topic until the user ends it',async()=>{
 let r=await turn('fallacy','开始对战训练');const topic=r.state.stages.fallacy.topic;
 for(const answer of ['我认为还有第三种选择。','应该先检验依据，再讨论结论。','使用工具不必然意味着放弃判断。']){r=await turn('fallacy',answer,r.state);assert.equal(r.state.stages.fallacy.status,'waiting');assert.equal(r.state.stages.fallacy.topic,topic);assert.equal(r.state.stages.fallacy.level,1);}
 assert.equal(r.state.stages.fallacy.debateTurns.filter(t=>t.role==='user').length,3);
 r=await turn('fallacy','结束对战',r.state);assert.equal(r.state.stages.fallacy.status,'complete');assert.equal(r.debate.status,'ended');
});
test('A failed response never mutates the supplied checkpoint',async()=>{
 const initial=await turn('socratic','努力会成功');const snapshot=JSON.stringify(initial.state);
 await assert.rejects(()=>runTraining({agent:'socratic',messages:[{role:'user',content:'也需要运气'}],training:initial.state},{ask:async()=>{throw new Error('network failure');}}));
 assert.equal(JSON.stringify(initial.state),snapshot);
});
test('Systematic fallacy phase starts an interactive battle rather than analyzing navigation text',async()=>{
 const state=cleanState({mode:'systematic',active:'argument',topic:'AI与思考',queue:[{agent:'fallacy',goal:'练习反驳'}]});state.stages.argument.status='complete';
 const r=await turn('coach','进入下一环节：诡辩士',state,fakeModel(),{type:'next'});
 assert.equal(r.state.stages.fallacy.step,'debate');assert.equal(r.state.stages.fallacy.status,'waiting');
});
test('Independent workspaces cannot be redirected into another agent',async()=>{
 const state=cleanState({active:'socratic'});state.stages.socratic.status='waiting';state.stages.socratic.round=3;
 const route=await decideRoute({agent:'socratic',text:'什么是因果关系',state,messages:[]},async()=>{throw new Error('must not classify');});assert.equal(route.agent,'socratic');assert.equal(route.relation,'answer');
});
test('Classifier cannot reset an unanswered question by calling an ordinary reply a new task',async()=>{
 const state=cleanState({active:'socratic'});state.stages.socratic.status='waiting';state.stages.socratic.round=2;state.stages.socratic.answers=['此前的真实回答'];
 const model=fakeModel({route:{agent:'socratic',relation:'new',reason:'另一个观点',tasks:[]}});
 const r=await turn('coach','我指的是直接复制答案，使自己减少分析和判断的练习。',state,model);
 assert.equal(r.state.stages.socratic.round,3);assert.equal(r.route.relation,'answer');
});
test('Structured output accepts fenced JSON and surrounding prose but rejects incomplete objects',()=>{
 assert.deepEqual(parseStructured('结果如下：\n{"goal":"检查包含 } 的字符串","nested":{"a":1}}\n完成'),{goal:'检查包含 } 的字符串',nested:{a:1}});
 assert.deepEqual(parseStructured('```json\n{"a":1}\n```'),{a:1});
 assert.throws(()=>parseStructured('{"a":'));
});

test('Classifier cannot treat an answer to the active question as a resume command',async()=>{
 const first=await turn('coach','过度依赖人工智能会影响人的批判性思维。');
 const model=fakeModel({route:{agent:'socratic',relation:'resume',reason:'继续苏格拉底',tasks:[]}});
 const r=await turn('coach','我指的是直接复制答案，使自己减少分析和判断的练习。',first.state,model);
 assert.equal(r.state.stages.socratic.round,2);assert.equal(r.route.relation,'answer');
});
