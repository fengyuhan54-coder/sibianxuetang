import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createConceptIllustrations,nativeOrigin,safeImageURL,validPlan} from '../concept-illustrations.mjs';
import {runTraining} from '../training.mjs';
const config={baseURL:'https://dashscope.aliyuncs.com/compatible-mode/v1',model:'qwen-plus',apiKey:'test-only'};
const input={question:'什么是信息茧房？',reply:'人们反复接触相似观点，可能难以看到其他信息。',history:[]};
const plan={suitable:true,confidence:0.96,category:'social',term:'信息茧房',scene:'一个人被柔和发光的无字屏幕包围，屏幕上反复出现相似的花朵，屏幕外是多样的自然世界。',mapping:'屏幕围合表现单一信息环境；外部多样景物表现其他观点，不表示人真的被困住。'};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=','base64');
const review={textFree:true,symbolFree:true,sceneAccurate:true,storybookStyle:true};
const model=async(c)=>JSON.stringify(c.model==='qwen3-vl-plus'?review:plan);
const upstream='https://example.oss-cn-beijing.aliyuncs.com/image.png';
test('theory exclusion makes no model/image call; uncertain mapping is rejected',async()=>{
 let calls=0;const service=createConceptIllustrations({getConfig:()=>config,completeModel:async()=>{calls++;throw Error();}});
 for(const question of ['什么是三段论？','先验知识有什么含义？'])assert.equal(await service.generate({...input,question}),null);
 assert.equal(calls,0);assert.equal(validPlan({...plan,confidence:0.5}),null);assert.equal(validPlan({...plan,term:'三段论'}),null);
});
test('only trusted provider origins and image hosts are accepted',()=>{
 assert.equal(nativeOrigin(config.baseURL),'https://dashscope.aliyuncs.com');
 for(const u of ['https://dashscope.aliyuncs.com.attacker.test','http://dashscope.aliyuncs.com','https://user@dashscope.aliyuncs.com'])assert.equal(nativeOrigin(u),null);
 assert.equal(safeImageURL(upstream),upstream);assert.ok(safeImageURL('https://dashscope-a717.oss-accelerate.aliyuncs.com/generated.png'));for(const u of ['http://127.0.0.1/private','https://evil.test/file','https://oss-cn-beijing.aliyuncs.com.evil.test/file'])assert.equal(safeImageURL(u),null);
});
test('one image per request, no watermark, negative text constraints, audit before saving, concurrent requests deduplicated',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'concept-image-test-')),directory=pathToFileURL(dir+'/');let generated=0,audited=0;
 try{
  const service=createConceptIllustrations({getConfig:()=>config,directory,completeModel:async(c,msg)=>{if(c.model==='qwen3-vl-plus'){audited++;assert.match(msg[1].content[1].image_url.url,/^data:image\/png;base64,/);}return model(c);},fetcher:async(url,options)=>{
   if(url.includes('/services/')){generated++;const payload=JSON.parse(options.body);assert.equal(payload.model,'wan2.6-t2i');assert.equal(payload.parameters.n,1);assert.equal(payload.parameters.watermark,false);assert.equal(payload.parameters.prompt_extend,false);assert.match(payload.parameters.negative_prompt,/汉字/);assert.match(payload.input.messages[0].content[0].text,/绝对禁止/);assert.equal(options.redirect,'error');return Response.json({output:{choices:[{message:{content:[{image:upstream}]}}]}});}
   return new Response(png,{headers:{'Content-Type':'image/png'}});
  }});
  const [a,b]=await Promise.all([service.generate(input),service.generate(input)]);assert.deepEqual(a,b);assert.equal(generated,1);assert.equal(audited,1);assert.match(a.url,/^\/api\/concept-images\/[a-f0-9]{64}\.png$/);assert.deepEqual(await readFile(new URL(a.url.split('/').at(-1),directory)),png);assert.equal(service.isActive(),false);
  const other=await service.generate({...input,question:'解释一下信息茧房'});assert.deepEqual(other,a);assert.equal(generated,1);assert.equal(service.status().cached,true);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('generation denial, malformed result, and visible text all silently omit the picture',async()=>{
 for(const mode of ['403','bad-result','text','symbols','inaccurate']){
  const service=createConceptIllustrations({getConfig:()=>config,directory:pathToFileURL(join(tmpdir(),'unused-concept-rejection-tests')+'/'),completeModel:async(c)=>c.model==='qwen3-vl-plus'?JSON.stringify({...review,...(mode==='text'?{textFree:false}:mode==='symbols'?{symbolFree:false}:{sceneAccurate:false})}):JSON.stringify(plan),fetcher:async(url)=>url.includes('/services/')?mode==='403'?new Response('',{status:403}):Response.json(mode==='bad-result'?{}:{output:{choices:[{message:{content:[{image:upstream}]}}]}}):new Response(png)});
  assert.equal(await service.generate({...input,question:input.question+mode}),null);assert.equal(service.isActive(),false);
 }
});
test('timeout and upstream network failure return null rather than fail the teaching turn',async()=>{
 const service=createConceptIllustrations({getConfig:()=>config,timeoutMs:1,completeModel:async(c,m,{signal})=>{await new Promise(resolve=>setTimeout(resolve,5));signal.throwIfAborted();}});
 assert.equal(await service.generate(input),null);assert.equal(service.status().state,'unavailable');
 const failed=createConceptIllustrations({getConfig:()=>config,completeModel:async()=>{throw Error('network');}});assert.equal(await failed.generate(input),null);
});
test('concept text completes without invoking the retired chart generation or image network',async()=>{
 const calls=[];const result=await runTraining({agent:'concept',messages:[{role:'user',content:'相关关系和因果关系有什么不同？'}]},{ask:async kind=>{calls.push(kind);assert.equal(kind,'concept-lesson');return JSON.stringify({term:'相关关系与因果关系',definition:'相关表示一起变化，因果表示产生影响。',plain:'共同变化不能直接证明因果。',facets:'需要区分共同原因与直接影响。',misconceptions:['同时发生不等于因果'],positive:'假设：阳光同时吸引泳客和冰淇淋顾客。',negative:'假设：只凭销量相关就认定因果。',question:'请复述区别。'});}});
 assert.equal(result.visual,null);assert.deepEqual(calls,['concept-lesson']);assert.equal(result.route.agent,'concept');
});
