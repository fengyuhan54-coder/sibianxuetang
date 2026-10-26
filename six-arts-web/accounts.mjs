import {readFileSync,mkdirSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {randomBytes,scryptSync,timingSafeEqual,randomUUID} from 'node:crypto';
import path from 'node:path';
export function createAccounts(directory){
 const file=path.join(directory,'accounts.json');let db={users:[]};
 if(existsSync(file))db=JSON.parse(readFileSync(file,'utf8'));
 const sessions=new Map(),attempts=new Map();
 const save=()=>{mkdirSync(directory,{recursive:true});writeFileSync(file+'.tmp',JSON.stringify(db),{mode:0o600});renameSync(file+'.tmp',file);};
 const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const publicUser=u=>u?{id:u.id,name:u.name,points:u.points,days:u.days.length,badges:u.badges,tier:tier(u.points)}:null;
 const cookie=(res,token,clear=false)=>res.setHeader('Set-Cookie',`sixarts_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${clear?0:604800}`);
 function user(req){const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sixarts_session='))?.slice(16);const s=sessions.get(token);if(!s||s.expires<Date.now()){sessions.delete(token);return null;}return db.users.find(u=>u.id===s.id)||null;}
 function login(req,res,body,register=false){const name=String(body.name||'').normalize('NFKC').trim(),password=String(body.password||'');
  if(!/^[\p{L}\p{N}_-]{2,20}$/u.test(name)||password.length<8||password.length>128)throw new Error('账号需为2–20位文字、数字或下划线，密码需为8–128位。');
  const key=req.socket.remoteAddress,rate=attempts.get(key)||{n:0,reset:Date.now()+60000};if(rate.reset<Date.now()){rate.n=0;rate.reset=Date.now()+60000;}attempts.set(key,rate);if(++rate.n>12)throw new Error('尝试次数较多，请一分钟后重试。');
  let u=db.users.find(x=>x.name===name);
  if(register){if(u)throw new Error('这个账号已被使用。');if(db.users.length>=10000)throw new Error('本机账号数量已达到上限。');const salt=randomBytes(16).toString('hex');u={id:randomUUID(),name,salt,hash:scryptSync(password,salt,64).toString('hex'),points:0,days:[],badges:[],awards:[]};db.users.push(u);save();}
  else{const calculated=scryptSync(password,u?.salt||'unregistered',64);if(!u||!timingSafeEqual(calculated,Buffer.from(u.hash,'hex')))throw new Error('账号或密码不正确。');}
  const token=randomBytes(32).toString('hex');sessions.set(token,{id:u.id,expires:Date.now()+7*86400000});cookie(res,token);return publicUser(u);
 }
 function award(u,id,points,badge){if(!u)return null;if(u.awards.includes(id))return publicUser(u);u.awards.push(id);u.awards=u.awards.slice(-5000);u.points+=points;const today=day();if(!u.days.includes(today)){u.days.push(today);u.points+=10;}if(badge&&!u.badges.includes(badge))u.badges.push(badge);save();return publicUser(u);}
 return {user,publicUser,login,award,logout(req,res){const token=(req.headers.cookie||'').match(/sixarts_session=([^;]+)/)?.[1];sessions.delete(token);cookie(res,'',true);},leaderboard:()=>db.users.filter(u=>u.points>0).sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name)).slice(0,50).map(publicUser)};
}
export function tier(points){return points>=1200?'钻石':points>=600?'铂金':points>=300?'黄金':points>=100?'白银':'青铜';}
