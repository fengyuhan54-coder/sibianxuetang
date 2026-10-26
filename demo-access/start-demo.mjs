import {mkdirSync,existsSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {createDemoGateway} from './gateway.mjs';
import {createApp} from '../six-arts-web/server.mjs';

const directory=fileURLToPath(new URL('./',import.meta.url));
const local=new URL('./.local/',import.meta.url);mkdirSync(local,{recursive:true});
const configFile=new URL('demo-settings.json',local);
if(!existsSync(configFile))writeFileSync(configFile,JSON.stringify({publicOrigin:'https://sibianxuetang.cn',accessCode:randomBytes(12).toString('base64url'),dailyLimit:300},null,2),{mode:0o600});
const settings=JSON.parse(readFileSync(configFile,'utf8'));
const usageFile=new URL('demo-usage.json',local);
const usage={read:()=>existsSync(usageFile)?JSON.parse(readFileSync(usageFile,'utf8')):{},write:data=>writeFileSync(usageFile,JSON.stringify(data),{mode:0o600})};
// Separate account/quiz state protects the team's existing local development records.
const backend=createApp({dataDirectory:fileURLToPath(new URL('app-data/',local))});
const gateway=createDemoGateway({upstream:'http://127.0.0.1:3212',publicOrigin:settings.publicOrigin,accessCode:settings.accessCode,dailyLimit:settings.dailyLimit,readUsage:usage.read,writeUsage:usage.write});
const links='思辨学堂｜比赛演示访问\n\n老师使用的直接访问链接：\n'+settings.publicOrigin+'/?access='+settings.accessCode+'\n\n普通入口：'+settings.publicOrigin+'\n演示访问码：'+settings.accessCode+'\n\n本机管理页（仅在这台电脑配置模型）：http://127.0.0.1:3212/\n本机演示入口：http://127.0.0.1:3211/\nCloudflare路由的服务地址：http://127.0.0.1:3211\n\n访问链接内含演示访问码，只分享给评审或体验者。域名路由配置完成前，公网链接尚不可用。\n';
writeFileSync(new URL('./老师访问链接.txt',import.meta.url),links,{mode:0o600});
for(const [server,port,label] of [[backend,3212,'本机管理页'],[gateway,3211,'公网演示网关']]){
 server.on('error',e=>{console.error(label+'启动失败：'+e.code);process.exitCode=1;backend.close();gateway.close();});
 server.listen(port,'127.0.0.1',()=>console.log(label+'已启动：http://127.0.0.1:'+port));
}
console.log('老师访问链接保存在本文件夹的“老师访问链接.txt”，请保持本进程运行。');
const shutdown=()=>{gateway.close();backend.close();};process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
