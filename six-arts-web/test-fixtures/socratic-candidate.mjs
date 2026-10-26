// Synthetic candidates validate the protocol; live tests evaluate the metaphor's teaching quality.
export function socraticTransition(data){
 return {sourceAnchor:data.story.text.slice(0,18),text:`借着这个情境，我们先把注意力带回“${data.concepts.join('”与“')}”，接着厘清${data.questionType==='definition'?'这个概念的含义':'这两者之间的联系'}。`};
}
export function socraticCandidate(data){
 const context=[data.currentStatement,...(data.records||[]).map(r=>r.content),data.topic].filter(Boolean).join('\n');
 const terms=[...new Set(context.match(/批判性思维|人工智能|AI|独立思考|思考|努力|成功|学习|依赖|判断|机会|观点|条件|证据|理由|能力|反例|练习|机遇/g)||[])];
 const round=Math.max(1,data.round||1);let questionType=round===1||terms.length<2?'definition':'relation';
 let concepts=questionType==='definition'?[terms[0]]:data.optional?terms.slice(0,2):[terms[(round-2)%terms.length],terms[(round-1)%terms.length]];
 const previous=(data.previousReplies||[]).map(t=>t.trim().split('\n').at(-1));
 const used=previous.map(t=>[...t.matchAll(/“([^”]+)”/g)].map(m=>m[1]));
 if(questionType==='relation'&&used.some(c=>c.length===2&&c.every(x=>concepts.includes(x)))){
  const pairs=terms.flatMap((a,i)=>terms.slice(i+1).map(b=>[a,b]));
  const next=pairs.find(pair=>!used.some(c=>c.length===2&&c.every(x=>pair.includes(x))));
  if(next)concepts=next;else{questionType='definition';concepts=[terms.find(t=>!used.some(c=>c.length===1&&c[0]===t))||terms[0]];}
 }
 return {quote:data.currentStatement,questionType,concepts,questionVariant:(round-1)%3,metaphorId:data.metaphorOptions?.[0]?.id||'',mapping:data.metaphorOptions?.length?{source:'原典情境中的事物、含义和关系。',target:concepts.join('与')+'的含义或联系。',parallel:'区分各自所指，再讨论含义和联系，不推断原议题真假。',limits:'典故帮助理解问题，不构成原议题的证据。'}:null,transition:data.metaphorOptions?.length?{sourceAnchor:data.metaphorOptions[0].text.slice(0,18),text:`借着这个情境，我们先把注意力带回“${concepts.join('”与“')}”，接着厘清${questionType==='definition'?'这个概念的含义':'这两者之间的联系'}。`}:null};
}
