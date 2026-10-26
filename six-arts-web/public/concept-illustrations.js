// Optional illustrations never delay, fail, or advance a teaching turn.
const imagePath=/^\/api\/concept-images\/[a-f0-9]{64}\.png$/;
export function createConceptPictures(ctx){
 const jobs=new WeakSet();
 const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/concept-illustrations.css';document.head.append(sheet);
 const preview=document.createElement('dialog');preview.className='concept-picture-preview';preview.setAttribute('aria-label','概念隐喻图片预览');
 const bar=document.createElement('div');bar.className='concept-picture-preview-bar';
 const title=document.createElement('span');title.textContent='💡 概念隐喻卡片';
 const download=document.createElement('a');download.textContent='保存 / 下载';download.download='概念隐喻.png';
 const close=document.createElement('button');close.type='button';close.textContent='关闭 ×';close.setAttribute('aria-label','关闭图片预览');close.onclick=()=>preview.close();
 const full=document.createElement('img');full.alt='概念隐喻插画';bar.append(title,download,close);preview.append(bar,full);document.body.append(preview);
 full.onerror=()=>{if(preview.open)preview.close();};
 preview.addEventListener('close',()=>full.removeAttribute('src'));
 function render(message,container){
  const picture=message.illustration;if(!picture||!imagePath.test(picture.url)||container.querySelector('.concept-picture'))return;
  const card=document.createElement('figure');card.className='concept-picture';card.hidden=true;
  const button=document.createElement('button');button.type='button';button.className='concept-picture-open';button.setAttribute('aria-label','放大查看'+(picture.term||'概念')+'隐喻插画');
  const image=document.createElement('img');image.alt=(picture.term||'概念')+'的视觉隐喻插画';image.decoding='async';
  image.onload=()=>{const scroll=document.getElementById('message-scroll'),follow=scroll&&scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<100;card.hidden=false;if(follow)scroll.scrollTop=scroll.scrollHeight;};image.onerror=()=>card.remove();
  button.onclick=()=>{full.alt=image.alt;full.src=picture.url;download.href=picture.url+'?download=1';if(!preview.open)preview.showModal();};
  const caption=document.createElement('figcaption');caption.textContent='💡 概念隐喻卡片';const hint=document.createElement('span');hint.textContent='点击放大';caption.append(hint);
  button.append(image);card.append(button,caption);container.append(card);image.src=picture.url;
 }
 async function enrich(message,session){
  if(message.routed!=='concept'||message.error||!message.content||message.illustrationChecked||jobs.has(message))return;
  jobs.add(message);
  try{
   const index=session.messages.indexOf(message),prior=session.messages.slice(0,index),question=prior.filter(m=>m.role==='user'&&!m.error).at(-1)?.content;
   if(!question)return;
   const response=await fetch('/api/concept-illustration',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(115000),body:JSON.stringify({question,reply:message.content,history:prior.filter(m=>!m.error).slice(-6).map(m=>({role:m.role,content:m.content}))})});
   if(response.ok){const {image}=await response.json();if(image&&imagePath.test(image.url)){message.illustration={url:image.url,term:String(image.term||'概念').slice(0,100)};ctx.refreshMessage(message);}}
  }catch{/* No spinner, error toast, failed card, or effect on the text turn. */}
  finally{message.illustrationChecked=true;jobs.delete(message);ctx.persist();}
 }
 return {render,enrich};
}
