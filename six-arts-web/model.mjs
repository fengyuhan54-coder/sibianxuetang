export class ModelError extends Error {}
export function connectionError(error){
 if(error?.name==='AbortError')return error;
 const codes=[error?.code,error?.cause?.code,...(error?.cause?.errors||[]).map(e=>e.code)];
 if(codes.some(c=>c==='EACCES'||c==='EPERM'))return new ModelError('后端访问模型接口被网络权限拦截（EACCES/EPERM）。请检查后端运行权限或网络设置。');
 if(error?.name==='TimeoutError'||codes.some(c=>['ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT'].includes(c)))return new ModelError('连接模型接口超时，请检查网络或稍后重试。');
 if(codes.some(c=>['ENOTFOUND','EAI_AGAIN'].includes(c)))return new ModelError('无法解析模型接口地址，请检查接口地址和网络 DNS 设置。');
 if(codes.some(c=>['ECONNREFUSED','ECONNRESET','ENETUNREACH','EHOSTUNREACH'].includes(c)))return new ModelError('无法连接模型接口，请检查网络、代理或服务商状态后重试。');
 return new ModelError('连接模型接口失败，请检查网络与接口地址后重试。');
}
export function completionURL(base) {
 const u=new URL(base);
 if (!['https:','http:'].includes(u.protocol)||u.username||u.password||u.search||u.hash) throw new Error('接口地址需要是有效的 HTTP 或 HTTPS 地址');
 if(u.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname)) throw new Error('远程模型接口需要使用 HTTPS');
 return u.href.replace(/\/$/,'').replace(/\/chat\/completions$/,'')+'/chat/completions';
}
export async function* readSSE(body) {
 const reader=body.getReader(),decoder=new TextDecoder(); let buffer='';
 try {
  while(true){
   const {done,value}=await reader.read(); buffer+=done?decoder.decode():decoder.decode(value,{stream:true});
   let split;
   while((split=buffer.search(/\r?\n\r?\n/))>=0){
    const event=buffer.slice(0,split); const sep=buffer.slice(split).match(/^\r?\n\r?\n/)[0]; buffer=buffer.slice(split+sep.length);
    const data=event.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
    if(data==='[DONE]') return;
    if(data) yield JSON.parse(data);
   }
   if(done) break;
  }
  const data=buffer.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trim()).join('\n');
  if(data&&data!=='[DONE]') yield JSON.parse(data);
 } finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function complete(config,messages,{signal,onDelta,maxTokens=2400,json=false}={}) {
 const endpoint=completionURL(config.baseURL);
 let res;
 try{res=await fetch(endpoint,{method:'POST',signal,headers:{'Authorization':`Bearer ${config.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:config.model,messages,stream:true,max_tokens:maxTokens, ...(config.model.startsWith('qwen')?{enable_thinking:false,...(json?{response_format:{type:'json_object'}}:{})}:{})})});}
 catch(error){throw connectionError(error);}
 if(!res.ok){
  await res.body?.cancel();
  const messages={401:'API Key 无效或没有调用权限，请检查模型设置。',403:'当前账户无权调用该模型。',404:'接口或模型不存在，请检查地址与模型名称。',429:'调用频率或余额受限，请检查服务商账户后重试。'};
  throw new ModelError(messages[res.status]||`模型服务返回错误（${res.status}），请稍后重试。`);
 }
 let output='',finishReason='';
 if(res.headers.get('content-type')?.includes('application/json')){
  const obj=await res.json();output=obj.choices?.[0]?.message?.content||'';finishReason=obj.choices?.[0]?.finish_reason||'';if(output)onDelta?.(output);
 }else{
  for await(const event of readSSE(res.body)){
   if(event.error)throw new ModelError('模型返回错误，请检查配置或稍后重试。');
   if(event.choices?.[0]?.finish_reason)finishReason=event.choices[0].finish_reason;
   const delta=event.choices?.[0]?.delta?.content;
   if(typeof delta==='string'){output+=delta;onDelta?.(delta);}
  }
 }
 if(finishReason==='length')throw new ModelError('回复达到长度上限，本轮尚未完成，请缩短输入或重新发送。');
 if(!output.trim())throw new ModelError('模型没有返回正文，请检查模型兼容性。');
 return output;
}
