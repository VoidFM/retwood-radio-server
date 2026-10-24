import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHmac,pbkdf2Sync} from 'node:crypto';
import {start} from './server.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));

export function configureManaged({directory=path.join(root,'.managed'),environment=process.env}={}){
 const name=environment.RADIO_NAME||'Retwood Radio',password=environment.RADIO_PASSWORD,secret=environment.RADIO_SIGNING_SECRET;
 if(!name.trim()||name.length>40)throw Error('Set RADIO_NAME to 1–40 characters');
 if(typeof password!=='string'||password.length<10||password.length>128||password==='CHANGE_ME_NOW')throw Error('Set a private RADIO_PASSWORD of 10–128 characters in the hosting dashboard');
 if(typeof secret!=='string'||secret.length<32)throw Error('Set a private RADIO_SIGNING_SECRET of at least 32 characters; the Render blueprint generates one');
 // A stable random host secret keeps salts and signed logins stable on free-host restarts.
 const salt=createHmac('sha256',secret).update('field-radio-password-salt').digest().subarray(0,16);
 const config={name,host:'0.0.0.0',port:8080,channelsFile:path.join(root,'channels.json'),dataDirectory:'.data',scannerEnabled:false,retentionSeconds:120,trustProxy:environment.RENDER==='true',passwordSalt:salt.toString('base64'),passwordHash:pbkdf2Sync(password,salt,100000,32,'sha256').toString('base64')};
 fs.mkdirSync(directory,{recursive:true,mode:0o700});const file=path.join(directory,'server.json');
 fs.writeFileSync(file,JSON.stringify(config,null,2)+'\n',{mode:0o600});fs.chmodSync(file,0o600);
 return file;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const file=configureManaged(),app=start({file});let stopping=false;
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(stopping)return;stopping=true;await app.close();process.exit(0)});
 }catch(error){console.error(error.message);process.exitCode=1}
}
