import {createServer as httpServer} from 'node:http';
import {createServer as httpsServer} from 'node:https';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHash,createHmac,pbkdf2Sync} from 'node:crypto';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import worker from './backend.mjs';
import {RequestProtection,clientAddress} from './protection.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),configFile=path.resolve(process.env.RADIO_CONFIG||path.join(root,'server.json'));
export function loadConfiguration(file=configFile){
 if(!fs.existsSync(file))throw Error('Server is not configured. Run: node setup.mjs');
 const config=JSON.parse(fs.readFileSync(file,'utf8'));
 if(typeof config.name!=='string'||!config.name.trim()||config.name.length>40)throw Error('Set a server name of 1–40 characters');
 const channelFile=path.resolve(path.dirname(file),config.channelsFile||'channels.json'),channels=JSON.parse(fs.readFileSync(channelFile,'utf8'));
 if(!Array.isArray(channels)||channels.length!==48||channels.some((c,i)=>c.id!==i||c.zoneIndex!==Math.floor(i/16)||c.number!==i%16+1||typeof c.name!=='string'||!c.name.trim()||c.name.length>24||typeof c.zone!=='string'||!c.zone.trim()||c.zone.length>24))throw Error('channels.json needs 48 numbered positions with channel and zone names of 1–24 characters');
 for(let z=0;z<3;z++)if(new Set(channels.slice(z*16,z*16+16).map(c=>c.zone)).size!==1)throw Error('Use one name for each 16-channel zone');
 const password=process.env.RADIO_PASSWORD||config.password;
 if(password){if(password.length<10||password==='CHANGE_ME_NOW'||password.length>128)throw Error('Set RADIO_PASSWORD to a password of 10–128 characters, or run node setup.mjs');const salt=config.passwordSalt||createHash('sha256').update(config.name+'-field-radio').digest().subarray(0,16).toString('base64');config.passwordSalt=salt;config.passwordHash=pbkdf2Sync(password,Buffer.from(salt,'base64'),100000,32,'sha256').toString('base64')}
 if(!config.passwordHash||!config.passwordSalt)throw Error('No server password configured. Run: node setup.mjs');
 const port=Number(process.env.PORT||config.port||8080);if(!Number.isInteger(port)||port<0||port>65535)throw Error('Set a valid port');
 const scannerEnabled=process.env.RADIO_SCANNER_ENABLED===undefined?config.scannerEnabled!==false:process.env.RADIO_SCANNER_ENABLED==='true';
 const retentionSeconds=Number(config.retentionSeconds??(scannerEnabled?86400:120));
 if(!Number.isInteger(retentionSeconds)||retentionSeconds<60||retentionSeconds>86400)throw Error('retentionSeconds must be between 60 and 86400');
 return {...config,port,channels,channelFile,scannerEnabled,retentionSeconds};
}
export function database(dataDir){
 fs.mkdirSync(dataDir,{recursive:true,mode:0o700});const filename=path.join(dataDir,'radio.sqlite'),sqlite=new DatabaseSync(filename);sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');fs.chmodSync(filename,0o600);
 sqlite.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)');
 for(const file of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())if(!sqlite.prepare('SELECT name FROM schema_migrations WHERE name=?').get(file)){sqlite.exec('BEGIN');try{sqlite.exec(fs.readFileSync(path.join(root,'drizzle',file),'utf8'));sqlite.prepare('INSERT INTO schema_migrations(name) VALUES(?)').run(file);sqlite.exec('COMMIT')}catch(e){sqlite.exec('ROLLBACK');throw e}}
 const prepare=sql=>{let params=[];const stmt={bind(...values){params=values.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v);return stmt},execute(){const s=sqlite.prepare(sql);if(s.columns().length)return {results:s.all(...params)};const r=s.run(...params);return {results:[],meta:{changes:Number(r.changes)}}},async all(){return stmt.execute()},async first(){return stmt.execute().results[0]||null},async run(){return stmt.execute()}};return stmt};
 return {prepare,sqlite,async batch(statements){sqlite.exec('BEGIN');try{const r=statements.map(s=>s.execute());sqlite.exec('COMMIT');return r}catch(e){sqlite.exec('ROLLBACK');throw e}}};
}
export function start({file=configFile,port,host,quiet=false}={}){
 let config=loadConfiguration(file),lastCheck=0,stamp='';const dataDir=path.resolve(path.dirname(file),config.dataDirectory||'.data'),DB=database(dataDir);
 const keyFile=path.join(dataDir,'signing-key');
 if(process.env.RADIO_SIGNING_SECRET&&process.env.RADIO_SIGNING_SECRET.length<32)throw Error('RADIO_SIGNING_SECRET must have at least 32 characters');
 if(!process.env.RADIO_SIGNING_SECRET&&!fs.existsSync(keyFile))fs.writeFileSync(keyFile,randomBytes(32),{mode:0o600,flag:'wx'});
 const secret=process.env.RADIO_SIGNING_SECRET?Buffer.from(process.env.RADIO_SIGNING_SECRET):fs.readFileSync(keyFile);
 const protection=new RequestProtection();
 const env={DB,SERVER_CONFIG:null,STATION_KEY:null,SCANNER_HTML:config.scannerEnabled?fs.readFileSync(path.join(root,'public/index.html'),'utf8'):''};
 function refresh(force=false){if(!force&&Date.now()-lastCheck<1000)return;lastCheck=Date.now();const updated=fs.statSync(file).mtimeMs+':'+fs.statSync(config.channelFile).mtimeMs;if(!force&&stamp===updated)return;config=loadConfiguration(file);env.SERVER_CONFIG={id:'metro',name:config.name,channels:config.channels,dispatchCallsign:config.dispatchCallsign||'Dispatch',scannerEnabled:config.scannerEnabled,password_salt:config.passwordSalt,password_hash:config.passwordHash,password_version:parseInt(createHash('sha256').update(config.passwordHash).digest('hex').slice(0,8),16)};env.STATION_KEY=createHmac('sha256',secret).update(config.passwordHash).digest('hex');stamp=updated}
 refresh(true);
 const pending=new Set();const context={waitUntil(p){pending.add(p);p.catch(e=>console.error('Background task:',e.message)).finally(()=>pending.delete(p))}};
 const listener=async(req,res)=>{
  let pathname;try{pathname=new URL(req.url,'http://radio.local').pathname}catch{res.writeHead(400);res.end();return}const ip=clientAddress(req,config.trustProxy);
  // CORS also covers throttled requests from a downloaded scanner page.
  const listenerApi=['/api/scanner/login','/api/catalog','/api/status','/api/feed'].includes(pathname);
  if(listenerApi){res.setHeader('access-control-allow-origin','*');res.setHeader('access-control-allow-methods','GET, POST, OPTIONS');res.setHeader('access-control-allow-headers','authorization, content-type');res.setHeader('access-control-max-age','600')}
  const ticket=protection.enter(ip,req.method==='POST'&&['/api/radio/login','/api/scanner/login'].includes(pathname));
  if(!ticket.release){res.writeHead(429,{'content-type':'application/json','cache-control':'no-store','retry-after':String(ticket.retryAfter),'connection':'close'});res.end('{"error":"Too many requests. Please wait and try again."}');req.resume();return}
  res.once('close',ticket.release);res.once('finish',ticket.release);
  req.setTimeout(10000,()=>req.destroy());
  try{
   refresh();
   // Standalone HTML listeners use explicit bearer grants, never cookies.
   if(listenerApi&&req.method==='OPTIONS'){res.writeHead(204);res.end();return}
   if(['/scanner','/scanner.html'].includes(pathname)&&req.method==='GET'){
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src https: http:; frame-ancestors 'self'"});res.end(fs.readFileSync(path.join(root,'scanner.html'),'utf8'));return;
   }
   if(config.scannerEnabled&&(pathname==='/audio-test'||pathname==='/audio-test.html')&&req.method==='GET'){
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'"});res.end(fs.readFileSync(path.join(root,'public/audio-test.html'),'utf8'));return;
   }
   const scannerAssets={'/scanner-audio.js':'text/javascript; charset=utf-8','/ptt-cues.js':'text/javascript; charset=utf-8','/ptt-key.wav':'audio/wav','/ptt-release.wav':'audio/wav'};
   if(config.scannerEnabled&&req.method==='GET'&&Object.hasOwn(scannerAssets,pathname)){
    res.writeHead(200,{'content-type':scannerAssets[pathname],'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(fs.readFileSync(path.join(root,'public',pathname.slice(1))));return;
   }
   if(pathname==='/health'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({ok:true,name:config.name}));return}
   if(Number(req.headers['content-length'])>16384){res.writeHead(413,{'content-type':'application/json','connection':'close'});res.end('{"error":"Request too large"}');req.resume();return}
   let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>16384){res.writeHead(413,{'content-type':'application/json','connection':'close'});res.end('{"error":"Request too large"}');req.resume();return}chunks.push(chunk)}
   const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);
   headers.set('cf-connecting-ip',ip);
   const body=chunks.length?Buffer.concat(chunks):undefined,result=await worker.fetch(new Request('http://radio.local'+req.url,{method:req.method,headers,body,duplex:body?'half':undefined}),env,context);
   const out=Object.fromEntries(result.headers);out['x-content-type-options']='nosniff';out['referrer-policy']='same-origin';res.writeHead(result.status,out);res.end(Buffer.from(await result.arrayBuffer()));
  }catch(e){if(res.destroyed)return;console.error('Request failed:',e.message);if(!res.headersSent)res.writeHead(500,{'content-type':'application/json'});res.end('{"error":"Server configuration or connection error"}')}
 };
 const tls=config.tlsCert&&config.tlsKey?{cert:fs.readFileSync(path.resolve(path.dirname(file),config.tlsCert)),key:fs.readFileSync(path.resolve(path.dirname(file),config.tlsKey))}:null;
 const options={maxHeaderSize:8192};
 const server=tls?httpsServer({...options,...tls},listener):httpServer(options,listener);server.maxConnections=256;server.maxRequestsPerSocket=1000;server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.listen(port??config.port,host||config.host||'0.0.0.0',()=>{if(!quiet)console.log(`${config.name} ready on ${tls?'https':'http'}://${host||config.host||'0.0.0.0'}:${server.address().port}\nRadio users enter the public server address, shared password and callsign.\nEdit ${config.channelFile} to change channel names.`)});
 const cleanup=setInterval(()=>{const cutoff=Date.now()-config.retentionSeconds*1000;DB.sqlite.prepare('DELETE FROM transmissions WHERE started_at<? AND (ended_at IS NOT NULL AND ended_at<? OR last_at<?)').run(cutoff,cutoff,Date.now()-10000);DB.sqlite.prepare('DELETE FROM floors WHERE lease_until<?').run(Date.now());DB.sqlite.prepare('DELETE FROM pairing WHERE expires_at<?').run(Date.now());DB.sqlite.prepare('DELETE FROM rate_limits WHERE expires_at<?').run(Date.now())},30000);cleanup.unref();
 const close=async()=>{clearInterval(cleanup);server.closeAllConnections();await new Promise(r=>server.close(r));await Promise.allSettled([...pending]);DB.sqlite.close()};
 return {server,env,close};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const app=start();let stopping=false;for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(stopping)return;stopping=true;await app.close();process.exit(0)})}catch(e){console.error(e.message);process.exitCode=1}}
