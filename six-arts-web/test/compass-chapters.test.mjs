import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {compassChapters,compassCatalog,gradeCompass,validateCompassAnswers} from '../compass-chapters.mjs';
import {createApp} from '../server.mjs';
import {learningNodes,questionBank} from '../question-bank.mjs';
test('compass maps 01–08 to all 30 original end-of-chapter reflection questions and exact source pages',()=>{
 assert.deepEqual(compassChapters.map(c=>c.questions.length),[4,3,3,3,5,4,5,3]);
 assert.deepEqual(compassChapters.map(c=>c.end),[25,42,67,110,164,188,206,221]);
 assert.equal(compassCatalog().questionCount,30);assert.equal(learningNodes.length,4);assert.equal(questionBank.length,23);
 assert.equal(compassChapters[0].title,'知识与批判');assert.equal(compassChapters[1].title,'断言与澄清概念');
 assert.equal(compassChapters[0].questions[0].stem,'何谓批判？你之前怎么理解？现在怎么理解？');
 assert.equal(compassChapters[7].questions[2].stem,'对公开情报源进行内容分析的步骤是什么？为何需要情报分析员具备较高的学历？');
 for(const c of compassChapters)for(const q of c.questions){assert.equal(q.type,'reflection');assert.equal(q.reference.kind,'教材章末原题');assert.equal(q.reference.pdfPage,c.end+7);assert.equal(q.options,undefined);assert.equal(q.answer,undefined);}
});
test('chapter answers retain original question counts and 80% threshold instead of forcing five questions',async()=>{
 const makeAsk=correct=>async(_system,data)=>({results:data.tasks.map((t,i)=>({id:t.id,verdict:i<correct?'correct':'partial',feedback:'结合原题检查概念与理由。',sourceIds:[data.chapterMaterial[0].id]}))});
 const c1=compassChapters[0];assert.throws(()=>validateCompassAnswers(c1,['','a','b','c']));assert.throws(()=>validateCompassAnswers(c1,['a','b','c','d','e']));
 const r1=await gradeCompass(c1,['a','b','c','d'],makeAsk(3));assert.equal(r1.total,4);assert.equal(r1.passed,false);assert.equal(r1.threshold,4);
 const r2=await gradeCompass(compassChapters[4],['a','b','c','d','e'],makeAsk(4));assert.equal(r2.passed,true);assert.equal(r2.threshold,4);
 const r3=await gradeCompass(compassChapters[1],['a','b','c'],makeAsk(3));assert.equal(r3.passed,true);assert.equal(r3.total,3);
});
test('chapter evaluation rejects missing/duplicate questions and references outside the chapter',async()=>{
 const chapter=compassChapters[0],answers=['a','b','c','d'];
 await assert.rejects(()=>gradeCompass(chapter,answers,async()=>({results:[]})),/完整/);
 await assert.rejects(()=>gradeCompass(chapter,answers,async(_s,d)=>({results:d.tasks.map(t=>({id:t.id,verdict:'correct',feedback:'反馈',sourceIds:['p206']}))})),/定位/);
});
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+server.address().port)));
const close=server=>new Promise(resolve=>server.close(resolve));
test('compass endpoints are separate from concept practice, keep graded attempts idempotent and require real text answers',async()=>{
 let calls=0;const upstream=http.createServer(async(req,res)=>{
  let raw='';for await(const c of req)raw+=c;const input=JSON.parse(raw),data=JSON.parse(input.messages[1].content);calls++;
  const content=JSON.stringify({results:data.tasks.map(t=>({id:t.id,verdict:'correct',feedback:'概括、理由与应用均回应了原题。',sourceIds:[data.chapterMaterial[0].id]}))});res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{message:{content}}]}));
 });
 const directory=await mkdtemp(join(tmpdir(),'compass-chapter-test-')),provider=await listen(upstream),app=createApp({baseURL:provider+'/v1',model:'test',apiKey:'synthetic-test-only',dataDirectory:directory}),base=await listen(app);
 const post=async(path,data)=>{const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});return {status:r.status,data:await r.json()};};
 try{
  const old=await (await fetch(base+'/api/learning')).json();assert.deepEqual(old.nodes,learningNodes);assert.equal(old.questionCount,23);
  const catalog=await (await fetch(base+'/api/compass')).json();assert.equal(catalog.chapters.length,8);assert.equal(catalog.chapters[7].number,8);
  const start=await post('/api/compass/start',{chapter:'chapter-01'});assert.equal(start.data.questions.length,4);assert.equal(start.data.questions[0].type,'reflection');assert.equal(start.data.questions[0].answer,undefined);
  const bad=await post('/api/compass/submit',{id:start.data.id,answers:[0,1,2,3]});assert.equal(bad.status,400);assert.equal(calls,0);
  const good=await post('/api/compass/submit',{id:start.data.id,answers:['概括','关系','建构性','反思例子']});assert.equal(good.data.passed,true);assert.equal(good.data.total,4);
  const again=await post('/api/compass/submit',{id:start.data.id,answers:['更改的回答']});assert.deepEqual(again.data,good.data);assert.equal(calls,1);
  const original=await post('/api/quiz/start',{node:'concepts'});assert.equal(original.data.questions.length,5);assert.ok(original.data.questions.every(q=>Array.isArray(q.options)));
 }finally{await close(app);await close(upstream);await rm(directory,{recursive:true,force:true});}
});
