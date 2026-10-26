import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateVisual,debateTurn,roundtableTurn} from '../interactive-training.mjs';
import {runTraining} from '../training.mjs';
import {argumentDiagram,conceptDiagram,thoughtDiagram} from '../public/visuals.js';
const nodes=[{id:'a',label:'论证',detail:'总概念'},{id:'b',label:'演绎论证',detail:'下位概念'}];
test('concept visual rejects cycles, multiple parents, nonexistent endpoints; none remains optional',()=>{
 assert.equal(validateVisual({type:'none'}),null);
 const v={type:'tree',title:'概念包含',reason:'理解包含关系',nodes,edges:[{from:'a',to:'b',label:'包含'}]};assert.equal(validateVisual(v),v);
 assert.throws(()=>validateVisual({...v,edges:[...v.edges,{from:'b',to:'a',label:'包含'}]}));
 assert.throws(()=>validateVisual({...v,edges:[{from:'a',to:'fake',label:'包含'}]}));
});
test('debate pauses on grounded diagnostics, resumes without counting navigation as a user argument, ends only on request',async()=>{
 const stage={topic:'学校如何使用AI',level:2};
 const ask=async kind=>JSON.stringify(kind==='debate-review'?{summary:'回顾已发生的交锋',strengths:[],next:'检查前提',confusions:[]}:{reply:'围绕同一观点继续回应。',coach:stage.debateTurns?.length?{quote:'所有人都用所以一定正确',type:'诉诸多数',reason:'流行程度不能证明正确。',question:'多数与正确之间有什么联系？'}:null});
 await debateTurn({stage,text:'开始',ask,parse:JSON.parse});
 let r=await debateTurn({stage,text:'所有人都用所以一定正确',ask,parse:JSON.parse});assert.equal(r.artifact.status,'paused');assert.equal(stage.status,'waiting');assert.ok(!r.text.includes('围绕同一观点'));
 r=await debateTurn({stage,text:'继续对战',resume:true,ask,parse:JSON.parse});assert.equal(stage.debateTurns.filter(t=>t.role==='user').length,1);assert.equal(r.artifact.status,'active');
 r=await debateTurn({stage,text:'结束对战',end:true,ask,parse:JSON.parse});assert.equal(r.artifact.status,'ended');assert.equal(stage.status,'complete');
});
test('debate rejects invented diagnostic quote and does not append failed reply',async()=>{
 const stage={topic:'AI',level:1,debateTurns:[{role:'assistant',content:'观点'}]};
 await assert.rejects(()=>debateTurn({stage,text:'需要核验',parse:JSON.parse,ask:async()=>JSON.stringify({reply:'反驳',coach:{quote:'从未说过',type:'错误',reason:'理由',question:'问题'}})}),/原话/);assert.equal(stage.debateTurns.length,1);
});
const lesson={term:'批判性思维',definition:'核验理由',plain:'先看理由',facets:'能力与素养',misconceptions:['不等于反对'],positive:'假设：核验后接受',negative:'假设：盲目否定',question:'请复述'};
test('free concept explains without grading or forced task; systematic requires both restatement and example',async()=>{
 let text='',calls=[];const ask=async(kind)=>{calls.push(kind);return JSON.stringify(kind==='concept-lesson'?lesson:kind==='concept-visual'?{type:'none'}:kind==='assessment'?{verdict:'correct',hasRestatement:true,hasExample:false,feedback:'概括基本准确，但尚无例子。'}:{explanation:'概括基本准确。',case:'假设：核验一则信息。',task:'请补充生活例子。'});};
 const input={agent:'concept',messages:[{role:'user',content:'什么是批判性思维？'}]};
 let r=await runTraining(input,{ask,onDelta:t=>text+=t});assert.equal(r.state.stages.concept.status,'complete');assert.equal(r.feedback,null);assert.doesNotMatch(text,/请.*复述/);assert.ok(!calls.includes('assessment'));
 text='';r=await runTraining({...input,training:{mode:'systematic'}},{ask,onDelta:t=>text+=t});assert.match(text,/复述.*并举/);assert.equal(r.state.stages.concept.status,'waiting');
 r=await runTraining({...input,training:r.state,messages:[{role:'user',content:'就是审慎判断。'}]},{ask});assert.equal(r.feedback.verdict,'partial');assert.equal(r.state.stages.concept.status,'waiting');
});
test('diagrams retain argument relation direction, both colors, source quotes, zoom and thought questions',()=>{
 const html=argumentDiagram({nodes:[{id:'c',label:'主张',kind:'claim',quote:'原文主张'},{id:'p',label:'前提',kind:'premise',quote:'原文前提'},{id:'r',label:'反例',kind:'reason',quote:'原文反例'}],edges:[{from:'p',to:'c',type:'support'},{from:'r',to:'c',type:'attack'}]});assert.match(html,/#32734f/);assert.match(html,/#b44740/);assert.match(html,/data-zoom/);assert.match(html,/原文前提/);
 for(const type of ['comparison','tree','flow'])assert.match(conceptDiagram({type,title:'<概念>',reason:'具体关系',nodes,edges:[{from:'a',to:'b',label:'包含'}]}),/&lt;概念&gt;/);
 assert.match(thoughtDiagram([{content:'初始观点'},{content:'我的回答',question:'为什么这样认为？'}]),/为什么这样认为/);
});
test('targeted roundtable must preserve the selected existing role',async()=>{
 const history=[{name:'教师',statement:'考虑学习效果'}];await assert.rejects(()=>roundtableTurn({topic:'AI',history,question:'@教师 请说明依据'},async()=>JSON.stringify({speakers:[{name:'商家',value:'收益',statement:'我的理由',respondsTo:''}],tradeoff:'取舍',question:'怎么想？'}),JSON.parse),/圆桌/);
});

test('comparison concept title and definition are not overwritten by an incidentally retrieved subtopic',async()=>{
 const c={...lesson,term:'有效论证与无效论证',definition:'有效性取决于前提是否保证结论，不等于结论碰巧为真。'};
 const r=await runTraining({agent:'concept',messages:[{role:'user',content:'有效论证和无效论证有什么区别？'}]},{ask:async kind=>JSON.stringify(kind==='concept-visual'?{type:'none'}:c)});
 assert.equal(r.conceptCard.term,c.term);assert.equal(r.conceptCard.definition,c.definition);
});
test('systematic concept combines a restatement and an example supplied across two turns',async()=>{
 const ask=async(kind,messages)=>{
  if(kind==='concept-lesson')return JSON.stringify(lesson);
  if(kind==='concept-visual')return JSON.stringify({type:'none'});
  if(kind==='concept-followup')return JSON.stringify({explanation:'已核对这次表达。',case:'假设：核验消息的来源。',task:'请补充一个例子。'});
  const answer=JSON.parse(messages[1].content).answer,hasExample=answer.includes('例如');
  return JSON.stringify({verdict:hasExample?'correct':'partial',hasRestatement:answer.includes('审慎'),hasExample,feedback:hasExample?'概括和例子均已提供。':'概括已提供，仍需例子。'});
 };
 let r=await runTraining({agent:'concept',training:{mode:'systematic'},messages:[{role:'user',content:'什么是批判性思维？'}]},{ask});
 r=await runTraining({agent:'concept',training:r.state,messages:[{role:'user',content:'就是审慎地检查理由和推理再判断。'}]},{ask});assert.equal(r.state.stages.concept.status,'waiting');
 r=await runTraining({agent:'concept',training:r.state,messages:[{role:'user',content:'例如读到广告时先核查数据来源，再决定是否相信。'}]},{ask});assert.equal(r.state.stages.concept.status,'complete');
});
