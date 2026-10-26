import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Always locate configuration beside the project, including launches from Explorer.
const envFile=fileURLToPath(new URL('./.env',import.meta.url));
if(existsSync(envFile)){
 try{process.loadEnvFile(envFile);}
 catch{throw new Error('无法读取项目中的 .env 文件，请检查配置格式。');}
}
export function serverPort(){
 const port=Number(process.env.PORT||3210);
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT 必须是 1 到 65535 之间的整数。');
 return port;
}
