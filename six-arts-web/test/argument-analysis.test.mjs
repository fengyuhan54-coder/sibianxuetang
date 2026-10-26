import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildStructured,runTraining,cleanState} from '../training.mjs';
import {ModelError} from '../model.mjs';

const input='分析：线上学习更灵活，因此应该取代所有线下教学';
const analysis={
 claim:'应该取代所有线下教学',
 structure:'由线上学习更灵活这一理由，推向取代所有线下教学的普遍结论，支持范围不足。',
 fallacies:['“更灵活”不足以推出“取代所有”，遗漏了教学效果等必要比较。'],
 strengths:['原文提出了可讨论的理由与明确结论。'],
 weaknesses:['没有说明灵活性为什么足以决定全部教学形式。'],
 suggestions:['限定适用场景，并补充学习效果等比较依据。'],
 branches:[{claim:'线上学习更灵活',evidence:['线上学习更灵活'],gap:'重建假设：只要更灵活，就应取代其他教学形式；该假设需要论证。'}],
 caution:'原文未提供线上与线下教学效果的比较数据。'
};

test('argument analysis accepts textual single items without fabricating missing content',async()=>{
 const single={...analysis,fallacies:analysis.fallacies[0],strengths:analysis.strengths[0],weaknesses:analysis.weaknesses[0],suggestions:analysis.suggestions[0],branches:[{...analysis.branches[0],evidence:'线上学习更灵活'}]};
 let calls=0;
 const result=await buildStructured('argument',input,async()=>{calls++;return JSON.stringify(single);});
 assert.equal(calls,1);assert.equal(result.graph.claim,analysis.claim);
 assert.deepEqual(result.graph.branches[0].evidence,['线上学习更灵活']);
 assert.match(result.text,/## 1 论证要素提取/);assert.match(result.text,/## 5 论证结构图/);
 assert.match(result.text,/更灵活.*不足以推出/);
});

test('missing argument fields trigger one grounded correction before emitting or committing anything',async()=>{
 const partial={...analysis};delete partial.suggestions;
 const calls=[],deltas=[];let metaCount=0;
 const state=cleanState({active:'argument',stages:{argument:{status:'waiting',step:'material'}}}),snapshot=structuredClone(state);
 const result=await runTraining({agent:'argument',messages:[{role:'user',content:input}],training:state},{
  ask:async(kind,messages)=>{calls.push({kind,messages});assert.equal(deltas.length,0);assert.equal(metaCount,0);return JSON.stringify(calls.length===1?partial:analysis);},
  onDelta:text=>deltas.push(text),onMeta:()=>metaCount++
 });
 assert.equal(calls.length,2);assert.ok(calls.every(c=>c.kind==='analysis'));
 assert.match(calls[1].messages[0].content,/suggestions/);
 assert.ok(calls[1].messages.some(m=>m.role==='user'&&m.content.includes(input)));
 assert.ok(calls[1].messages.some(m=>m.role==='assistant'&&m.content===JSON.stringify(partial)));
 assert.equal(deltas.length,1);assert.equal(metaCount,1);
 assert.equal(result.state.stages.argument.status,'complete');assert.deepEqual(state,snapshot);
 assert.equal(result.graph.claim,analysis.claim);assert.match(deltas[0],/线上学习更灵活/);
});

test('malformed JSON, empty core fields and object-shaped entries are corrected rather than accepted',async()=>{
 for(const broken of ['{"claim":',JSON.stringify({...analysis,claim:''}),JSON.stringify({...analysis,structure:' '}),JSON.stringify({...analysis,strengths:[{text:'优点'}]}),JSON.stringify({...analysis,branches:[{claim:'',evidence:[]} ]})]){
  let calls=0;const result=await buildStructured('argument',input,async()=>++calls===1?broken:JSON.stringify(analysis));
  assert.equal(calls,2);assert.equal(result.graph.claim,analysis.claim);assert.doesNotMatch(result.text,/\[object Object\]/);
 }
});

test('two incomplete analyses fail within the retry limit and preserve the checkpoint without partial output',async()=>{
 const state=cleanState({active:'argument',stages:{argument:{status:'waiting',step:'material'}}}),snapshot=structuredClone(state);
 let calls=0,deltas=0,metas=0;
 await assert.rejects(()=>runTraining({agent:'argument',messages:[{role:'user',content:input}],training:state},{ask:async()=>{calls++;return JSON.stringify({claim:analysis.claim,branches:analysis.branches});},onDelta:()=>deltas++,onMeta:()=>metas++}),/论证分析.*未推进/);
 assert.equal(calls,2);assert.equal(deltas,0);assert.equal(metas,0);assert.deepEqual(state,snapshot);
});

test('provider errors and cancellations are not retried as analysis format errors',async()=>{
 for(const error of [new ModelError('当前账户无权调用该模型。'),Object.assign(new Error('stopped'),{name:'AbortError'})]){
  let calls=0;await assert.rejects(()=>buildStructured('argument',input,async()=>{calls++;throw error;}),e=>e===error);assert.equal(calls,1);
 }
});

test('explicit empty observations remain valid and complete analyses do not incur extra model calls',async()=>{
 let calls=0;const result=await buildStructured('argument',input,async()=>{calls++;return JSON.stringify({...analysis,fallacies:[],strengths:[],branches:[]});});
 assert.equal(calls,1);assert.deepEqual(result.graph.branches,[]);
});
