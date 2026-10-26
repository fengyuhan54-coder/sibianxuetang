import {createApp} from './server.mjs';
import {serverPort} from './runtime.mjs';
// Only the project process starts this worker; it never accepts network configuration transfer.
process.on('error',error=>{if(error.code!=='ERR_IPC_DISCONNECTED')console.error('后台交接通道异常。');});
process.once('message',async message=>{
 const config=message?.config;if(!config||typeof config.apiKey!=='string'||typeof config.baseURL!=='string'||typeof config.model!=='string'){process.send?.({failed:true});process.exit(1);}
 try{
  const app=createApp(config),port=serverPort();
  // Preflight new imports/data and socket binding before asking the old process to exit.
  await new Promise((resolve,reject)=>{app.once('error',reject);app.listen(0,'127.0.0.1',resolve);});
  await new Promise(resolve=>app.close(resolve));app.removeAllListeners('error');
  process.send?.({prepared:true});let tries=0;
  const bind=()=>app.listen(port,'127.0.0.1');
  app.on('error',error=>{if(error.code==='EADDRINUSE'&&tries++<100)setTimeout(bind,100);else{console.error('新版后端启动失败：'+error.code);process.exit(1);}});
  app.once('listening',()=>{console.log('思辨学堂后端已升级：http://127.0.0.1:'+port);if(process.connected)process.disconnect();});bind();
 }catch{process.send?.({failed:true});process.exit(1);}
});
setTimeout(()=>{if(!process.listenerCount('message'))return;process.exit(1);},15000).unref();
