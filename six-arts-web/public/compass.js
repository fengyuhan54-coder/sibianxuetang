const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createCompass(ctx){
 let catalog=null,active=null,report=null,busy=false;
 const bookLink=(page,label)=>`<a target="_blank" rel="noopener" href="/api/textbook.pdf#page=${page+7}">${e(label||'教材 P'+page)} ↗</a>`;
 const data=()=>ctx.data();
 const unlocked=c=>c.number===1||data().chapterMastered.includes('chapter-'+String(c.number-1).padStart(2,'0'));
 async function html(){
  if(!catalog)catalog=await ctx.api('/api/compass');
  if(active)return exercise();
  return `<section class="lab-card"><h2>知识罗盘 · 按章节完成教材课后题</h2><p>01 至 08 与教材第一章至第八章逐章对应，共 ${catalog.questionCount} 道章末“思考题”。题目按教材原文保留，使用文字作答。</p><p class="muted">每章按原有题数练习；达到本章题数的 80% 后解锁下一章。反馈由 AI 结合本章教材生成，供学习参考。</p></section><div class="learning-path">${catalog.chapters.map(c=>{
   const passed=data().chapterMastered.includes(c.id),open=unlocked(c),last=data().chapterReports.filter(r=>r.chapter===c.id).at(-1),pre=data().chapterReports.filter(r=>r.chapter===c.id&&r.phase==='pre').at(-1),post=data().chapterReports.filter(r=>r.chapter===c.id&&r.phase==='post').at(-1);
   return `<section class="path-node ${open?'':'locked'}"><div class="path-number">${String(c.number).padStart(2,'0')}</div><div class="lab-card"><div class="card-top"><h3>第${'一二三四五六七八'[c.number-1]}章 ${e(c.title)}</h3><span>${passed?'已通过':open?'可开始':'待解锁'}</span></div><p>章末思考题 · ${c.count} 题 · 教材 P${c.end}</p><div class="book-links">① 学 · ${bookLink(c.start,'阅读本章 P'+c.start+'–'+c.end)}　${bookLink(c.end,'查看课后题原页 P'+c.end)}</div><div class="node-actions"><button type="button" class="primary-button" data-compass-start="${c.id}" data-phase="practice" ${open?'':'disabled'}>② 练 · 本章 ${c.count} 题</button><button type="button" class="secondary-button" data-compass-start="${c.id}" data-phase="pre" ${open?'':'disabled'}>训练前测</button><button type="button" class="secondary-button" data-compass-start="${c.id}" data-phase="post" ${passed?'':'disabled'}>③ 测 · 训练后测</button></div>${last?'<p>最近反馈：'+last.correct+' / '+last.total+' 题达到要求。</p>':''}${pre||post?'<p class="muted">前测：'+(pre?pre.correct+'/'+pre.total:'未完成')+'　后测：'+(post?post.correct+'/'+post.total:'未完成')+'。同题复测存在记忆效应，差异仅供回顾。</p>':''}</div></section>`;
  }).join('')}</div><p id="compass-error" role="status"></p>`;
 }
 function exercise(){return `<section class="lab-card"><div class="card-top"><h2>${String(active.number).padStart(2,'0')} · ${e(active.title)} · ${{pre:'训练前测',post:'训练后测',practice:'章末思考题'}[active.phase]}</h2><button type="button" data-compass-back class="secondary-button">返回章节地图</button></div><p>${bookLink(active.questions[0].reference.printedPage,'打开本章思考题原页')}　共 ${active.questions.length} 题；至少 ${Math.ceil(active.questions.length*.8)} 题达到要求。</p><p class="muted">请按原题文字作答。涉及个人经历可如实说明；涉及画图可用文字或箭头描述推理关系。</p><form id="compass-answer-form">${active.questions.map((q,i)=>{
  const feedback=report?.results.find(r=>r.id===q.id);
  return `<fieldset class="quiz-question"><legend>${q.number}. ${e(q.stem)}</legend><label>我的回答<textarea name="answer-${i}" required maxlength="10000" rows="5" ${report?'readonly':''}>${e(feedback?.answer||active.answers?.[i]||'')}</textarea></label><small>${e(q.reference.chapter)} · 章末思考题第 ${q.number} 题 · ${bookLink(q.reference.printedPage)}</small>${feedback?'<div class="answer-review '+(feedback.correct?'correct':'needs-work')+'"><b>'+({correct:'已达到本题要求',partial:'还需补充',incorrect:'需要修正'}[feedback.verdict])+'</b><p>'+e(feedback.feedback)+'</p>'+feedback.references.map(r=>bookLink(r.printedPage)).join('　')+'</div>':''}</fieldset>`;
 }).join('')}${report?'<div class="quiz-result"><strong>'+report.correct+' / '+report.total+'</strong><p>'+(report.passed?'已达到本章 80% 的要求。':'请结合本章教材完善回答后再练习。')+(active.phase!=='practice'?'本次为测评记录，不用于章节解锁。':'')+'</p><button type="button" data-compass-back class="primary-button">返回章节地图</button></div>':'<button type="submit" class="primary-button">提交本章回答并查看反馈</button>'}<p id="compass-error" role="status"></p></form></section>`;}
 async function run(work){if(busy)return;busy=true;const buttons=[...ctx.host().querySelectorAll('button')].map(b=>({b,disabled:b.disabled}));buttons.forEach(({b})=>b.disabled=true);try{await work();}catch(err){const node=document.getElementById('compass-error');if(node)node.textContent=err.message;else ctx.toast(err.message);}finally{busy=false;buttons.forEach(({b,disabled})=>{if(b.isConnected)b.disabled=disabled;});}}
 document.addEventListener('click',async ev=>{
  const b=ev.target.closest('button');if(!b)return;
  if(b.dataset.compassStart){const c=catalog?.chapters.find(c=>c.id===b.dataset.compassStart);if(!c||!unlocked(c)||b.dataset.phase==='post'&&!data().chapterMastered.includes(c.id))return;await run(async()=>{active=await ctx.api('/api/compass/start',{chapter:c.id,phase:b.dataset.phase});report=null;await ctx.render();});}
  if(b.hasAttribute('data-compass-back')&&!busy){active=null;report=null;await ctx.render();}
 });
 document.addEventListener('submit',async ev=>{
  if(ev.target.id!=='compass-answer-form')return;ev.preventDefault();if(busy||!active||report)return;
  active.answers=active.questions.map((_,i)=>ev.target.elements.namedItem('answer-'+i).value.trim());if(active.answers.some(a=>!a)){document.getElementById('compass-error').textContent='请完成本章每一道思考题。';return;}
  await run(async()=>{document.getElementById('compass-error').textContent='正在结合本章教材逐题反馈，请稍候…';report=await ctx.api('/api/compass/submit',{id:active.id,answers:active.answers});data().chapterReports.push(report);if(report.phase==='practice'&&report.passed&&!data().chapterMastered.includes(report.chapter))data().chapterMastered.push(report.chapter);if(report.user)ctx.account(report.user);ctx.save();await ctx.render();});
 });
 return {html,busy:()=>busy,reset(){active=null;report=null;}};
}
