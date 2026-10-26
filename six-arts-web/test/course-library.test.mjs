import {test} from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {documents,concepts,retrieveConcepts,conceptSources,teachingNotes,teachingContext} from '../course-library.mjs';
import {runTraining} from '../training.mjs';
import {qualityResult} from '../test-fixtures/socratic-quality.mjs';
import {socraticCandidate,socraticTransition} from '../test-fixtures/socratic-candidate.mjs';

function model(){
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
  if(kind==='socratic-question')return JSON.stringify(socraticCandidate(JSON.parse(messages[1].content)));
  if(kind==='concept-lesson')return JSON.stringify({term:JSON.parse(messages[1].content).knowledge[0]?.term||'相关关系与因果关系',definition:'检查理由与推理的思考方式',plain:'先核对证据与推理，再根据理由修正判断。思考思考。',facets:'区分思维能力与理智素养',misconceptions:['批判不等于反对'],positive:'假设：核验理由后接受判断。',negative:'假设：未经核验就直接否定。',question:'请用自己的话复述或举例。'});
  if(kind==='concept-followup')return JSON.stringify({explanation:'你这次说明了检查依据与推理的要点。',case:'假设：对一条消息核验来源后再判断可信度。',task:'请补充一个检验判断的例子。'});
  if(kind==='assessment')return JSON.stringify({verdict:'correct',hasRestatement:true,hasExample:true,feedback:'抓住了检查依据和自我修正的核心。'});
  const answer='先核对证据与推理，再根据理由修正判断。请用自己的话举一个例子。';
  onDelta?.(answer);return answer;
 };
 return {ask,calls};
}
async function turn(agent,text,training){
 const m=model();const result=await runTraining({agent,messages:[{role:'user',content:text}],training:training||(agent==='concept'?{mode:'systematic'}:undefined)},{ask:m.ask});
 return {...result,calls:m.calls};
}

test('course references point to the supplied files and valid one-based pages',async()=>{
 for(const doc of Object.values(documents))await access(new URL('../../resources/'+doc.file,import.meta.url));
 const references=[...concepts.flatMap(c=>c.references),...Object.values(teachingNotes).flatMap(n=>n.references)];
 assert.deepEqual([...new Set(references.map(r=>r.document))],['book']);
 for(const ref of references){
  assert.ok(ref.summary&&ref.chapter&&ref.title);
  assert.ok(ref.pdfPages.length&&ref.pdfPages.every(p=>Number.isInteger(p)&&p>0&&p<=documents[ref.document].pages));
  if(ref.document==='book')assert.deepEqual(ref.pdfPages,ref.printedPages.map(p=>p+7));
 }
});
test('concept retrieval recognizes the user spelling and avoids incidental course names',()=>{
 assert.equal(retrieveConcepts('什么是批判型思维？')[0].id,'K01');
 assert.equal(retrieveConcepts('什么是归纳推理？')[0].id,'K05');
 assert.equal(retrieveConcepts('歧义是什么意思？')[0].id,'C03');
 assert.equal(retrieveConcepts('什么是隐含前提？')[0].id,'C06');
 assert.deepEqual(retrieveConcepts('什么是量子纠缠？这是批判性思维课上想到的问题。'),[]);
 assert.ok(retrieveConcepts('什么是批判性思维？').length<=3);
});
test('explanatory entries without a course reference do not generate source cards',()=>{
 const entries=retrieveConcepts('什么是虚假两难？');
 assert.equal(entries[0].id,'F03');assert.deepEqual(conceptSources(entries),[]);
 assert.deepEqual(conceptSources(retrieveConcepts('什么是量子纠缠？')),[]);
});
test('concept first explanation has verified references but ordinary feedback does not repeat them',async()=>{
 const first=await turn('concept','什么是批判型思维？');
 assert.equal(first.sources[0].id,'K01');
 assert.equal(first.sources[0].references[0].document,'book');
 const prompt=first.calls[0].messages[0].content;
 assert.match(prompt,/思维能力与理智素养/);assert.match(prompt,/复述或举例任务并等待/);
 assert.match(prompt,/不添加来源覆盖情况的说明/);
 const second=await turn('concept','我要先检查证据和推理，也愿意修正自己的判断。',first.state);
 assert.equal(second.state.stages.concept.status,'complete');assert.deepEqual(second.sources,[]);
 assert.match(second.calls.find(c=>c.kind==='concept-followup').messages[0].content,/课堂误区或边界案例/);
});
test('asking for a source preserves the pending exercise and does not grade a question as an answer',async()=>{
 const first=await turn('concept','什么是批判性思维？');
 const pending=first.state.stages.concept.question;
 const second=await turn('concept','这个概念在教材哪一页？',first.state);
 assert.ok(second.sources.length>0);assert.equal(second.state.stages.concept.status,'waiting');
 assert.equal(second.state.stages.concept.question,pending);
 assert.ok(!second.calls.some(c=>c.kind==='assessment'));
});
test('other agents use teaching methods without attaching routine textbook citations',async()=>{
 for(const [agent,input] of [['socratic','过度依赖AI影响独立思考'],['fallacy','生成一个诡辩案例'],['perspectives','如何看待AI辅助写作？']]){
  const result=await turn(agent,input);
  assert.deepEqual(result.sources,[]);
  assert.ok(result.calls.some(c=>c.messages[0].content.includes(teachingNotes[agent].method)));
 }
 assert.match(teachingContext('planner'),/自报倾向当成能力已提升/);
 assert.match(teachingContext('argument'),/不等于结论必然为假/);
});
test('unknown concepts are answered without requiring an uncovered-content disclaimer',async()=>{
 const result=await turn('concept','什么是量子纠缠？');assert.deepEqual(result.sources,[]);
 const prompt=result.calls[0].messages[0].content;
 assert.match(prompt,/没有匹配条目也正常回答/);
 assert.doesNotMatch(prompt,/其他概念使用模型已有知识并明确未接入/);
});
