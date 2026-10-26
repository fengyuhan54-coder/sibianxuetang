import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runTraining,cleanState} from '../training.mjs';
import {qualityResult} from '../test-fixtures/socratic-quality.mjs';
import {socraticCandidate} from '../test-fixtures/socratic-candidate.mjs';

function teachingModel({badQuestions=0,badReviews=false,multiQuestion=false}={}){
 const calls=[];let questionCalls=0;
 const ask=async(kind,messages)=>{
  const data=JSON.parse(messages[1].content);calls.push({kind,messages,data});
  if(kind==='socratic-quality')return qualityResult();
  if(kind==='socratic-transition')return JSON.stringify({sourceAnchor:data.story.text.slice(0,18),text:`借着这个情境，我们先把注意力带回“${data.concepts.join('”与“')}”，接着厘清${data.questionType==='definition'?'这个概念的含义':'这两者之间的联系'}。`});
  if(kind==='socratic-question'){const obj=socraticCandidate(data);obj.quote='用户并未说过的价值观不完善';if(++questionCalls<=badQuestions)obj.questionType=null;if(multiQuestion)obj.question='是什么情况？能再举个例子吗？';return JSON.stringify(obj);}
  if(kind==='socratic-review')return JSON.stringify({gesture:'轻轻点头',opening:'让我们回看这段思考的旅程。',steps:badReviews?[]:data.records.map(record=>({index:record.index,reflection:'这一发言使讨论多了一个可继续检验的线索。'})),synthesis:'这里呈现的是你实际表达的思路，而有些条件仍然值得慢慢检验。',closing:'这段对话之后，你最愿意保留或重新审视的认识是什么？'});
  throw new Error('unexpected call '+kind);
 };
 return {ask,calls};
}
async function turn(text,state,model=teachingModel(),extra={}){
 const deltas=[];let meta;
 const result=await runTraining({agent:'socratic',messages:[{role:'user',content:text}],training:state,...extra},{ask:model.ask,onDelta:s=>deltas.push(s),onMeta:m=>{meta=m;}});
 return {...result,text:deltas.join(''),meta,model};
}

test('a Socratic turn has one main question and cannot quote invented additions to the user statement',async()=>{
 const statement='依赖AI可能让人跳过分析和推理';
 const result=await turn(statement);
 assert.equal((result.text.match(/[?？]/g)||[]).length,1);
 assert.ok(result.text.includes('“'+statement+'”'));
 assert.ok(!result.text.includes('价值观不完善'));
 assert.equal(result.state.stages.socratic.answers?.length||0,0);
});
test('only the first complete question is presented when the model appends another',async()=>{
 const result=await turn('努力一定成功',undefined,teachingModel({multiQuestion:true}));
 assert.equal((result.text.match(/[?？]/g)||[]).length,1);assert.ok(!result.text.includes('能再举个例子吗'));
});
test('invalid question output is regenerated once and failure never advances the input checkpoint',async()=>{
 const fixed=await turn('努力一定成功',undefined,teachingModel({badQuestions:1}));assert.equal(fixed.model.calls.filter(c=>c.kind==='socratic-question').length,2);
 const state=fixed.state,snapshot=JSON.stringify(state);
 await assert.rejects(()=>turn('也许还要考虑条件',state,teachingModel({badQuestions:3})),/训练进度未推进/);
 assert.equal(JSON.stringify(state),snapshot);
});
test('five actual answers produce a chronological review with exact source records and an optional closing question',async()=>{
 const initial='过度依赖人工智能会影响批判性思维';
 const answers=['能够从多个角度看问题','可能跳过分析论证推理的过程','不同认知水平的人判断依据不同','现在很多人都在使用AI','两种因素都可能有影响'];
 let result=await turn(initial);
 for(const [i,answer] of answers.entries()){
  result=await turn(answer,result.state);
  assert.equal(result.state.stages.socratic.answers.length,i+1);
  assert.equal(result.state.stages.socratic.status,i===4?'complete':'waiting');
 }
 assert.deepEqual(result.socraticTrace.records.map(r=>r.content),[initial,...answers]);
 assert.equal(result.meta.socraticTrace.answered,5);
 assert.ok(result.socraticTrace.records.slice(1).every(r=>/本质|究竟什么是|核心含义|联系|逻辑关系/.test(r.question.split('\n').at(-1))));
 assert.equal((result.text.match(/[?？]/g)||[]).length,1);assert.match(result.text,/如果你愿意/);
 assert.doesNotMatch(result.text,/^（/);
 let position=-1;
 for(const text of [initial,...answers]){const next=result.text.indexOf('“'+text+'”');assert.ok(next>position);position=next;}
 const followup=await turn('我想保留核对证据这个习惯',result.state);assert.match(followup.text,/如果你愿意继续思考/);
 assert.equal(followup.state.stages.socratic.status,'complete');assert.equal(followup.state.stages.socratic.answers.length,5);
 assert.equal(followup.state.stages.socratic.step,'followup');
});
test('an early stop reviews only available answers and refuses to invent missing review steps',async()=>{
 let result=await turn('努力一定成功');result=await turn('有时也要考虑环境',result.state);
 result=await turn('结束',result.state);
 assert.equal(result.socraticTrace.complete,false);assert.equal(result.socraticTrace.answered,1);
 assert.equal(result.socraticTrace.records.length,2);
 const model=teachingModel({badReviews:true});
 await assert.rejects(()=>turn('结束',result.state,model),/训练进度未推进/);
 assert.equal(model.calls.length,3);
});
test('old checkpoints cannot finish from a round counter without five recorded answers',async()=>{
 const state=cleanState({active:'socratic',topic:'AI与思考'});
 Object.assign(state.stages.socratic,{topic:'AI与思考',status:'waiting',round:5,step:'question',question:'你有什么理由？'});
 const result=await turn('我还需要检查证据',state);
 assert.equal(result.state.stages.socratic.status,'waiting');assert.equal(result.state.stages.socratic.answers.length,1);
 assert.equal(result.state.stages.socratic.round,2);
});
test('resuming keeps the pending question context and never treats navigation as an answer',async()=>{
 let result=await turn('依赖AI可能影响思考');result=await turn('关键可能是使用方式',result.state);
 const pending=result.state.stages.socratic.question;
 const resumed=await turn('继续刚才的追问',result.state);
 assert.equal(resumed.state.stages.socratic.answers.length,1);
 assert.equal(resumed.state.stages.socratic.round,2);
 const data=resumed.model.calls[0].data;assert.equal(data.currentStatement,'关键可能是使用方式');assert.equal(data.pendingQuestion,pending);
});

test('semantic rejection regenerates privately with concrete feedback before emitting any reply',async()=>{
 const base=teachingModel();let generations=0,audits=0;const deltas=[];
 const ask=async(kind,messages,...rest)=>{
  if(kind==='socratic-question'){
   const obj=JSON.parse(await base.ask(kind,messages,...rest));
   if(++generations===1)obj.mapping.parallel='隐喻将书封面颜色当作内容可靠的依据。';
   else assert.match(messages.at(-1).content,/外观当作证据/);
   return JSON.stringify(obj);
  }
  if(kind==='socratic-quality'){
   const {candidate,currentStatement,records}=JSON.parse(messages[1].content);
   assert.equal(currentStatement,'我用AI整理笔记');assert.equal(records[0].content,currentStatement);
   audits++;return qualityResult(candidate.mapping.parallel.includes('颜色')?['隐喻将外观当作证据，缺乏平行关系，需要换一个合理的生活场景。']:[]);
  }
  return base.ask(kind,messages,...rest);
 };
 await runTraining({agent:'socratic',messages:[{role:'user',content:'我用AI整理笔记'}]},{ask,onDelta:s=>deltas.push(s)});
 assert.equal(generations,2);assert.equal(audits,2);assert.equal(deltas.length,1);
 assert.doesNotMatch(deltas[0],/颜色|审核|issues/);
});

test('repeated semantic failure exposes no candidate and preserves the input state',async()=>{
 const first=await turn('努力一定成功');const before=JSON.stringify(first.state),deltas=[];let audits=0;
 const base=teachingModel();
 const ask=async(kind,...rest)=>kind==='socratic-quality'?(audits++,qualityResult(['一个问号包含定义、举例和证明三个任务。'])):base.ask(kind,...rest);
 await assert.rejects(()=>runTraining({agent:'socratic',messages:[{role:'user',content:'我还不确定'}],training:first.state},{ask,onDelta:s=>deltas.push(s)}),/训练进度未推进/);
 assert.equal(audits,3);assert.deepEqual(deltas,[]);assert.equal(JSON.stringify(first.state),before);
});

test('review audit gets the original questions and catches invented progress or motives before publication',async()=>{
 let r=await turn('AI也可能帮助学习');r=await turn('我不知道',r.state);
 const base=teachingModel();let generations=0,audits=0;
 const ask=async(kind,messages,...rest)=>{
  if(kind==='socratic-review'){
   const obj=JSON.parse(await base.ask(kind,messages,...rest));
   if(++generations===1)obj.synthesis='你已经承认自己逃避责任，并形成了完整的人机协同理论。';
   return JSON.stringify(obj);
  }
  if(kind==='socratic-quality'){
   const data=JSON.parse(messages[1].content);audits++;
   assert.equal(data.type,'review');assert.equal(data.records[1].content,'我不知道');assert.ok(data.records[1].question);
   return qualityResult(data.candidate.synthesis.includes('逃避责任')?['用户只说不知道，不能替其承认动机或声称已形成理论。']:[]);
  }
  return base.ask(kind,messages,...rest);
 };
 const result=await turn('结束',r.state,{ask});
 assert.equal(generations,2);assert.equal(audits,2);assert.doesNotMatch(result.text,/逃避责任|完整的人机协同理论/);
});

test('malformed or contradictory audits never silently pass and network cancellation is not rewritten',async()=>{
 for(const raw of ['not json',JSON.stringify({pass:'true',issues:[]}),JSON.stringify({pass:true,issues:['仍存在预设动机']})]){
  const base=teachingModel();
  await assert.rejects(()=>turn('AI也可能有用',undefined,{ask:async(kind,...args)=>kind==='socratic-quality'?raw:base.ask(kind,...args)}),/训练进度未推进/);
 }
 const base=teachingModel(),cancel=new DOMException('cancelled','AbortError');let audits=0;
 await assert.rejects(()=>turn('努力有意义',undefined,{ask:async(kind,...args)=>{if(kind==='socratic-quality'){audits++;throw cancel;}return base.ask(kind,...args);}}),e=>e===cancel);
 assert.equal(audits,1);
});

test('every question begins with the faithful quote and avoids an answered question',async()=>{
 const first=await turn('努力与成功有关');
 const second=await turn('还需要机遇',first.state);
 assert.match(first.text,/^你提到“努力与成功有关”/);assert.match(second.text,/^我听到你说“还需要机遇”/);assert.doesNotMatch(first.text+second.text,/（|）/);
 const base=teachingModel();let generations=0;
 const ask=async(kind,messages,...rest)=>{
  if(kind==='socratic-question'){
   const obj=JSON.parse(await base.ask(kind,messages,...rest));generations++;
   const original=socraticCandidate(first.model.calls.find(c=>c.kind==='socratic-question').data);Object.assign(obj,{questionType:original.questionType,concepts:original.concepts,questionVariant:(original.questionVariant+1)%3,mapping:original.mapping});return JSON.stringify(obj);
  }
  return base.ask(kind,messages,...rest);
 };
 await assert.rejects(()=>turn('还需要机遇',first.state,{ask}),/训练进度未推进/);assert.equal(generations,3);
});

test('a selected allusion has a classical source and its internal mapping is not shown',async()=>{
 let r=await turn('依赖AI也许有影响');
 for(const answer of [null,'影响还要看具体条件','也要看个人原先的能力']){
  if(answer)r=await turn(answer,r.state);
  const audited=r.model.calls.find(c=>c.kind==='socratic-quality').data.candidate;
  assert.ok(audited.analogy&&audited.mapping.source&&audited.mapping.parallel&&audited.mapping.limits);
  assert.match(audited.metaphorContext.sourceTitle,/^《/);assert.match(audited.metaphorContext.sourceUrl,/^https:\/\//);
  assert.ok(r.text.includes(audited.analogy));assert.doesNotMatch(r.text,/"source"|"target"|"parallel"|"limits"/);
 }
});

test('an unknown type and an untrusted binary question cannot bypass the guided protocol',async()=>{
 const base=teachingModel();let generations=0;
 const ask=async(kind,messages,...rest)=>{
  if(kind==='socratic-question'){
   const obj=JSON.parse(await base.ask(kind,messages,...rest));
   if(++generations===1){obj.questionType='phenomenon';obj.question='是什么情况？他是在追求便捷还是逃避思考责任？';}
   else assert.match(messages.at(-1).content,/六步指导/);
   return JSON.stringify(obj);
  }
  return base.ask(kind,messages,...rest);
 };
 const result=await turn('大家都在使用AI',undefined,{ask});assert.equal(generations,2);assert.doesNotMatch(result.text,/逃避思考责任|还是/);
});

test('the displayed acknowledgement preserves qualifiers and cannot include a misleading paraphrase',async()=>{
 const statement='考试成绩高，并不一定代表批判性思维强。';
 const base=teachingModel();
 const ask=async(kind,messages,...rest)=>{
  if(kind==='socratic-question'){
   const obj=JSON.parse(await base.ask(kind,messages,...rest));obj.quote='考试成绩高';obj.acknowledgement='所以成绩和能力不相关。';return JSON.stringify(obj);
  }
  return base.ask(kind,messages,...rest);
 };
 const result=await turn(statement,undefined,{ask});assert.ok(result.text.includes('“'+statement+'”'));assert.doesNotMatch(result.text,/不相关/);
});

test('review preserves a limited claim and does not turn earnest preparation into identical preparation',async()=>{
 let r=await turn('努力可能增加机会，不保证成功');r=await turn('两个人都认真准备，机会可能不同',r.state);
 const base=teachingModel();let attempts=0;
 const ask=async(kind,messages,...rest)=>{
  if(kind==='socratic-review'){
   const obj=JSON.parse(await base.ask(kind,messages,...rest));
   if(++attempts===1)obj.steps[1].reflection='你指出两人准备相同却机会不同。';
   obj.closing='你是否应该放弃结果，转而接受我给出的过程标准？';return JSON.stringify(obj);
  }
  return base.ask(kind,messages,...rest);
 };
 const result=await turn('结束',r.state,{ask});assert.equal(attempts,2);assert.doesNotMatch(result.text,/准备相同|过程标准/);
 assert.match(result.text,/最想保留或重新审视/);
});

test('a fabricated context concept cannot be inserted through the concept field',async()=>{
 const base=teachingModel();let attempts=0;
 const ask=async(kind,messages,...rest)=>{
  if(kind==='socratic-question'){
   const obj=JSON.parse(await base.ask(kind,messages,...rest));
   if(++attempts===1){obj.concepts=['没有共识标准'];obj.mapping.target='没有共识标准的定义';}
   return JSON.stringify(obj);
  }
  return base.ask(kind,messages,...rest);
 };
 const result=await turn('我会检查反例是否成立',undefined,{ask});assert.equal(attempts,2);assert.doesNotMatch(result.text,/没有共识标准/);assert.match(result.text,/反例/);
});

test('an ability deficit cannot be relabelled as a motive in the review',async()=>{
 let r=await turn('依赖AI的影响需要看使用方式');r=await turn('有人为了省时间，有人不会判断',r.state);
 const base=teachingModel();let attempts=0;
 const ask=async(kind,messages,...rest)=>{
  if(kind==='socratic-review'){
   const obj=JSON.parse(await base.ask(kind,messages,...rest));
   if(++attempts===1)obj.steps[1].reflection='你区分了两种动机：省时间与不会判断。';
   return JSON.stringify(obj);
  }
  return base.ask(kind,messages,...rest);
 };
 const result=await turn('结束',r.state,{ask});assert.equal(attempts,2);assert.doesNotMatch(result.text,/两种动机/);
});

test('a missing, unknown or incompletely mapped allusion is silently omitted without losing the question',async()=>{
 const first=await turn('我认为努力能增加成功的机会'),snapshot=JSON.stringify(first.state);
 for(const broken of [{metaphorId:''},{metaphorId:'invented-story'},{metaphorId:null,mapping:null},{mapping:{source:'地图中的路线',target:'努力和机会',parallel:'',limits:'不是证据'}}]){
  const base=teachingModel();let attempts=0;const deltas=[];
  const ask=async(kind,messages,...rest)=>{
   if(kind==='socratic-question'){attempts++;return JSON.stringify({...JSON.parse(await base.ask(kind,messages,...rest)),...broken});}
   return base.ask(kind,messages,...rest);
  };
  const result=await runTraining({agent:'socratic',messages:[{role:'user',content:'还需要考虑外部条件'}],training:first.state},{ask,onDelta:s=>deltas.push(s)});
  assert.equal(attempts,1);assert.equal(deltas.length,1);assert.equal(deltas[0].split('\n\n').length,2);
  assert.match(deltas[0],/^我听到你说“还需要考虑外部条件”/);assert.doesNotMatch(deltas[0],/典故|省略|平台补充|（/);
  assert.equal(result.state.stages.socratic.answers.length,1);assert.equal(JSON.stringify(first.state),snapshot);
 }
});

test('long input quotes a complete judgement and never substitutes an arbitrary leading fragment',async()=>{
 const background='这是背景说明。'.repeat(35),judgement='我认为只有核对关键证据，才有理由作出暂时的判断。';
 const current=background+judgement,base=teachingModel();
 for(const proposed of ['只有核对关键证据',judgement]){
  const ask=async(kind,messages,...rest)=>{
   if(kind==='socratic-question'){const obj=JSON.parse(await base.ask(kind,messages,...rest));obj.quote=proposed;return JSON.stringify(obj);}
   return base.ask(kind,messages,...rest);
  };
  const r=await turn(current,undefined,{ask});
  assert.ok(r.text.includes('“'+(proposed===judgement?judgement:current)+'”'));assert.doesNotMatch(r.text,/……/);
 }
});

test('a nominalized concept must have a verbatim context anchor and is sent to semantic audit',async()=>{
 const base=teachingModel();let audited=false;
 const ask=async(kind,messages,...rest)=>{
  if(kind==='socratic-question'){
   const obj=JSON.parse(await base.ask(kind,messages,...rest));Object.assign(obj,{questionType:'relation',concepts:['判断能力','AI答案'],conceptAnchors:['不会判断','AI答案']});obj.transition.text='从这个阅读与审思的情境，我们把注意力带回判断能力与AI答案，继续厘清这两者之间的联系。';return JSON.stringify(obj);
  }
  if(kind==='socratic-quality'){
   const data=JSON.parse(messages[1].content);audited=true;assert.deepEqual(data.candidate.conceptAnchors,['不会判断','AI答案']);assert.match(data.candidate.mapping.target,/判断能力与AI答案/);return qualityResult();
  }
  return base.ask(kind,messages,...rest);
 };
 const r=await turn('我不会判断AI答案',undefined,{ask});assert.ok(audited);assert.match(r.text,/“判断能力”与“AI答案”/);
});

test('free model text cannot replace the selected metaphor with an announced conclusion',async()=>{
 const base=teachingModel();let attempts=0;const deltas=[];
 const ask=async(kind,messages,...rest)=>{
  if(kind==='socratic-question'){attempts++;const obj=JSON.parse(await base.ask(kind,messages,...rest));obj.analogy='就像用浮板代替划水，因此人工智能必然让思维退化。';return JSON.stringify(obj);}
  return base.ask(kind,messages,...rest);
 };
 await runTraining({agent:'socratic',messages:[{role:'user',content:'AI和思维练习可能有关'}]},{ask,onDelta:s=>deltas.push(s)});
 assert.equal(attempts,1);assert.equal(deltas.length,1);assert.doesNotMatch(deltas[0],/因此人工智能必然|思维退化/);assert.match(deltas[0],/《孟子·尽心下》/);
});

test('a level predicate cannot disguise an already-asked relation as a new task',async()=>{
 const state=cleanState({active:'socratic',topic:'考试成绩高，并不一定代表批判性思维强',stages:{socratic:{status:'waiting',step:'question',round:2,topic:'考试成绩高，并不一定代表批判性思维强',question:'那么，你认为“考试成绩高”与“批判性思维”之间存在着怎样的逻辑联系？',answers:['要看试题内容']}}});
 const base=teachingModel();let attempts=0;
 const ask=async(kind,messages,...rest)=>{
  if(kind==='socratic-question'){
   const obj=JSON.parse(await base.ask(kind,messages,...rest));
   if(++attempts===1)Object.assign(obj,{questionType:'relation',concepts:['批判性思维','考试成绩'],conceptAnchors:['批判性思维','考试成绩'],questionVariant:2});
   else assert.match(messages.at(-1).content,/已经问过/);
   return JSON.stringify(obj);
  }
  return base.ask(kind,messages,...rest);
 };
 const r=await turn('试题内容也影响判断',state,{ask});assert.equal(attempts,2);assert.equal(r.state.stages.socratic.status,'waiting');
});

test('an ill-fitting allusion is removed and the entire remaining reply must pass a second audit',async()=>{
 const base=teachingModel();let generations=0,audits=0;
 const ask=async(kind,messages,...rest)=>{
  if(kind==='socratic-question'){generations++;return base.ask(kind,messages,...rest);}
  if(kind==='socratic-quality'){
   const {candidate}=JSON.parse(messages[1].content);audits++;
   const verdict=JSON.parse(qualityResult());
   if(candidate.analogy){verdict.pass=false;verdict.issues=['典故与当前概念只有词语相似，省略。'];verdict.checks.find(c=>c.id==='analogy').pass=false;}
   else{assert.equal(candidate.mapping,null);assert.equal(candidate.metaphorContext,null);assert.equal(candidate.transition,null);assert.ok(candidate.quote&&candidate.question);}
   return JSON.stringify(verdict);
  }
  return base.ask(kind,messages,...rest);
 };
 const r=await turn('AI能不能帮助判断',undefined,{ask});
 assert.equal(generations,1);assert.equal(audits,2);assert.equal(r.text.split('\n\n').length,2);assert.doesNotMatch(r.text,/典故|省略/);
});

test('omitting an allusion never bypasses a defective question and never advances a failed checkpoint',async()=>{
 const base=teachingModel(),first=await turn('判断需要理由'),snapshot=JSON.stringify(first.state);let audits=0;
 const ask=async(kind,messages,...rest)=>{
  if(kind==='socratic-quality'){
   const {candidate}=JSON.parse(messages[1].content);audits++;
   const verdict=JSON.parse(qualityResult());verdict.pass=false;
   verdict.checks.find(c=>c.id===(candidate.analogy?'analogy':'openness')).pass=false;
   verdict.issues=[candidate.analogy?'典故不贴切，应省略。':'问题仍预置答案，不能通过。'];return JSON.stringify(verdict);
  }
  return base.ask(kind,messages,...rest);
 };
 await assert.rejects(()=>turn('证据也要检查',first.state,{ask}),/训练进度未推进/);
 assert.equal(audits,6);assert.equal(JSON.stringify(first.state),snapshot);
});

test('model-generated gestures, modern metaphors and fake historical speech cannot enter the displayed reply',async()=>{
 const base=teachingModel();
 const ask=async(kind,messages,...rest)=>{
  if(kind==='socratic-question')return JSON.stringify({...JSON.parse(await base.ask(kind,messages,...rest)),gesture:'手指轻叩桌面',metaphorId:'unknown',analogy:'苏格拉底曾说AI会偷走思考。',mapping:null});
  return base.ask(kind,messages,...rest);
 };
 const r=await turn('AI与思考有关',undefined,{ask});assert.match(r.text,/^你提到“AI与思考有关”/);assert.equal(r.text.split('\n\n').length,2);assert.doesNotMatch(r.text,/桌面|苏格拉底曾说|偷走/);
});

test('a question-like expression is nominalized with its original anchor rather than repeated as a concept',async()=>{
 const base=teachingModel();let attempts=0;
 const ask=async(kind,messages,...rest)=>{
  if(kind==='socratic-question'){
   const obj=JSON.parse(await base.ask(kind,messages,...rest));attempts++;
   if(attempts>1)assert.match(messages.at(-1).content,/疑问|名词短语/);
   return JSON.stringify({...obj,questionType:'definition',concepts:[attempts===1?'结论为什么成立':'结论成立的理由'],conceptAnchors:['问结论为什么成立'],metaphorId:'',mapping:null});
  }
  return base.ask(kind,messages,...rest);
 };
 const r=await turn('学习时我会问结论为什么成立',undefined,{ask});
 assert.equal(attempts,2);assert.match(r.text,/究竟什么是“结论成立的理由”/);assert.equal(r.text.split('\n\n').length,2);
});

test('a clear but skipped allusion can be caught and regenerated even for a definition question',async()=>{
 const base=teachingModel();let generations=0,audits=0;
 const ask=async(kind,messages,...rest)=>{
  if(kind==='socratic-question'){
   const obj=JSON.parse(await base.ask(kind,messages,...rest));generations++;
   Object.assign(obj,{questionType:'definition',concepts:['独立思考'],conceptAnchors:['独立思考'],allusionReason:'孟子读武成中的阅读与自行审思，对应借助信息与自主思考，不证明AI的影响。'});
   obj.transition.text='故事中的阅读与质疑让我们回到你提到的独立思考，在讨论影响之前，可以先厘清这个词的含义。';
   if(generations===1)Object.assign(obj,{metaphorId:'',mapping:null,allusionReason:'默认只给一个短问题，未检查贴切典故。'});
   else{assert.match(messages.at(-1).content,/遗漏|孟子/);obj.metaphorId='meng-zi-du-wu-cheng';}
   return JSON.stringify(obj);
  }
  if(kind==='socratic-quality'){
   const data=JSON.parse(messages[1].content);audits++;
   assert.ok(data.metaphorOptions.some(a=>a.id==='meng-zi-du-wu-cheng'));
   const verdict=JSON.parse(qualityResult());
   if(!data.candidate.analogy){verdict.pass=false;verdict.checks.find(c=>c.id==='analogy').pass=false;verdict.issues=['遗漏孟子读武成与自行审思之间的贴切关系，请先核查映射再选择。'];}
   return JSON.stringify(verdict);
  }
  return base.ask(kind,messages,...rest);
 };
 const r=await turn('过度依赖 AI 会影响独立思考吗？',undefined,{ask});
 assert.equal(generations,2);assert.equal(audits,2);assert.equal(r.text.split('\n\n').length,3);
 assert.match(r.text,/孟子读《尚书·武成》/);assert.match(r.text,/究竟什么是“独立思考”/);
 assert.doesNotMatch(r.text,/allusionReason|未检查|遗漏|因此AI/);assert.equal(r.state.stages.socratic.answers?.length||0,0);
});

test('a multi-clause definition advances once and explicitly supplies the already-asked task',async()=>{
 const state=cleanState({active:'socratic',topic:'AI与独立思考',stages:{socratic:{topic:'AI与独立思考',status:'waiting',round:1,step:'question',question:'那么，在你看来，究竟什么是“独立思考”？',answers:[],exchanges:[]}}});
 const current='独立思考就是自己解决问题自己先进行思考，对这个问题有自己的见解',base=teachingModel();
 const ask=async(kind,messages,...rest)=>{
  if(kind==='socratic-question'){
   const data=JSON.parse(messages[1].content);
   assert.deepEqual(data.askedTasks,[{questionType:'definition',concepts:['独立思考']}]);
   const obj=JSON.parse(await base.ask(kind,messages,...rest));
   return JSON.stringify({...obj,questionType:'relation',concepts:['自己解决问题','自己先进行思考'],metaphorId:'',mapping:null,allusionReason:'剩余典故与这两个要素间的关系不贴切，避免强行加入。'});
  }
  return base.ask(kind,messages,...rest);
 };
 const r=await turn(current,state,{ask});
 assert.ok(r.text.includes('“'+current+'”'));assert.match(r.text.split('\n\n').at(-1),/“自己解决问题”与“自己先进行思考”/);
 assert.equal(r.state.stages.socratic.answers.length,1);assert.equal(r.state.stages.socratic.round,2);
 assert.equal(state.stages.socratic.answers.length,0);
});

test('a story affecting several checks is removed but every remaining defect is still re-audited',async()=>{
 for(const remainingDefect of [false,true]){
  const base=teachingModel();let audits=0;
  const ask=async(kind,messages,...rest)=>{
   if(kind==='socratic-quality'){
    audits++;const {candidate}=JSON.parse(messages[1].content),verdict=JSON.parse(qualityResult());
    if(candidate.analogy||remainingDefect){
     verdict.pass=false;verdict.checks.find(c=>c.id==='openness').pass=false;
     if(candidate.analogy)verdict.checks.find(c=>c.id==='analogy').pass=false;
     verdict.issues=[candidate.analogy?'故事映射预设结论，影响开放性，应先删除并全面复核。':'删除故事后问句本身仍有无依据的预设。'];
    }
    return JSON.stringify(verdict);
   }
   return base.ask(kind,messages,...rest);
  };
  if(remainingDefect){await assert.rejects(()=>turn('AI与判断有关',undefined,{ask}),/训练进度未推进/);assert.equal(audits,6);}
  else{const r=await turn('AI与判断有关',undefined,{ask});assert.equal(audits,2);assert.equal(r.text.split('\n\n').length,2);}
 }
});

test('a selected story cannot be displayed with a missing, fabricated, disconnected or leading transition',async()=>{
 for(const broken of [null,{sourceAnchor:'古人在互联网上提问',text:'故事中的经验让我们回到AI这个概念，再一起澄清它的含义。'},{sourceAnchor:'孟子读《尚书·武成》时',text:'那么。'},{sourceAnchor:'孟子读《尚书·武成》时',text:'由此可见AI必然剥夺思考能力，因此我们已经有了这个问题的正确答案。'},{sourceAnchor:'孟子读《尚书·武成》时',text:'故事让我们回到AI，接下来你能举一个具体例子吗？'},{sourceAnchor:'孟子读《尚书·武成》时',text:'故事里的阅读和质疑让我们回到AI，先厘清究竟什么是AI，再继续往下。'}]){
  const base=teachingModel();let generations=0,bridges=0;
  const ask=async(kind,messages,...rest)=>{
   if(kind==='socratic-question'){
    const obj=JSON.parse(await base.ask(kind,messages,...rest));if(++generations===1)obj.transition=broken;return JSON.stringify(obj);
   }
   if(kind==='socratic-transition'&&++bridges===1)return JSON.stringify(broken);
   return base.ask(kind,messages,...rest);
  };
  const r=await turn('AI也许影响思考',undefined,{ask});
  assert.equal(generations,1);assert.equal(bridges,2);assert.match(r.text,/孟子/);assert.doesNotMatch(r.text,/互联网|由此可见|举一个具体例子/);
 }
});

test('a semantically empty transition is rewritten without deleting a fitting story',async()=>{
 const base=teachingModel();let generations=0,audits=0;
 const ask=async(kind,messages,...rest)=>{
  if(kind==='socratic-transition'&&generations===1)return JSON.stringify({...JSON.parse(await base.ask(kind,messages,...rest)),text:'这个故事引人深思，说到AI，我们还是回到刚才的话题，再继续往下谈。'});
  if(kind==='socratic-question'){
   const obj=JSON.parse(await base.ask(kind,messages,...rest));generations++;
   if(generations===1)obj.transition.text='这个故事引人深思，说到AI，我们还是回到刚才的话题，再继续往下谈。';
   else assert.match(messages.at(-1).content,/故事.*动作|衔接/);
   return JSON.stringify(obj);
  }
  if(kind==='socratic-quality'){
   audits++;const {candidate}=JSON.parse(messages[1].content),verdict=JSON.parse(qualityResult());
   assert.ok(candidate.analogy&&candidate.transition);
   if(candidate.transition.text.includes('引人深思')){verdict.pass=false;verdict.checks.find(c=>c.id==='continuity').pass=false;verdict.issues=['衔接没有接住故事中的具体动作，只是形式连接，需重写。'];}
   return JSON.stringify(verdict);
  }
  return base.ask(kind,messages,...rest);
 };
 const r=await turn('AI会影响独立思考吗',undefined,{ask});
 assert.equal(generations,2);assert.equal(audits,2);assert.match(r.text,/孟子/);assert.doesNotMatch(r.text,/引人深思/);
 assert.equal(r.text.split('\n\n').length,3);
});

test('a curated transition fallback cannot bypass semantic rejection or advance the checkpoint',async()=>{
 const first=await turn('AI与思考有关'),snapshot=JSON.stringify(first.state),base=teachingModel(),deltas=[];
 const ask=async(kind,messages,...rest)=>{
  if(kind==='socratic-transition')return JSON.stringify({sourceAnchor:'不存在的动作',text:'那么。'});
  if(kind==='socratic-quality')return qualityResult(['当前概念的提炼不忠实于原话，不能通过。']);
  if(kind==='socratic-question')return JSON.stringify({...JSON.parse(await base.ask(kind,messages,...rest)),transition:null});
  return base.ask(kind,messages,...rest);
 };
 await assert.rejects(()=>runTraining({agent:'socratic',messages:[{role:'user',content:'判断还需要证据'}],training:first.state},{ask,onDelta:t=>deltas.push(t)}),/训练进度未推进/);
 assert.deepEqual(deltas,[]);assert.equal(JSON.stringify(first.state),snapshot);
});

test('a conservative anchored transition survives two malformed model attempts and still gets fully audited',async()=>{
 const base=teachingModel();let bridges=0,audits=0;
 const ask=async(kind,messages,...rest)=>{
  if(kind==='socratic-transition'){bridges++;return JSON.stringify({sourceAnchor:'不存在的故事细节',text:'那么。'});}
  if(kind==='socratic-quality'){
   audits++;const {candidate}=JSON.parse(messages[1].content);
   assert.ok(candidate.analogy.includes(candidate.transition.sourceAnchor));
   assert.ok(candidate.transition.text.startsWith(candidate.metaphorContext.bridgeFocus));
   assert.ok(candidate.transition.text.includes(candidate.concepts[0]));return qualityResult();
  }
  return base.ask(kind,messages,...rest);
 };
 const r=await turn('AI与独立思考有关',undefined,{ask});
 assert.equal(bridges,2);assert.equal(audits,1);assert.match(r.text,/读到已有记载之后/);assert.equal(r.text.split('\n\n').length,3);
});

test('both definition and relation questions keep the transition next to its story and one final question',async()=>{
 for(const type of ['definition','relation']){
  const base=teachingModel(),concepts=type==='definition'?['独立思考']:['AI','独立思考'];
  const bridge=type==='definition'?'故事里的阅读与质疑让我们回到独立思考这个词，在讨论影响之前先厘清它的含义':'故事中拿到文字后仍提出疑问，让我们把注意力带回AI与独立思考，接着辨明这两者的联系';
  const ask=async(kind,messages,...rest)=>{
   if(kind==='socratic-transition')return JSON.stringify({sourceAnchor:'孟子读《尚书·武成》时',text:bridge});
   if(kind==='socratic-question')return JSON.stringify({...JSON.parse(await base.ask(kind,messages,...rest)),questionType:type,concepts,transition:{sourceAnchor:'孟子读《尚书·武成》时',text:bridge}});
   return base.ask(kind,messages,...rest);
  };
  const r=await turn('AI也许会影响独立思考',undefined,{ask}),parts=r.text.split('\n\n');
  assert.equal(parts.length,3);assert.ok(parts[1].endsWith(bridge+'。'));assert.equal((parts.at(-1).match(/[?？]/g)||[]).length,1);
  for(const concept of concepts)assert.ok(parts[1].includes(concept)&&parts.at(-1).includes(concept));
 }
});
