import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {RequestProtection,clientAddress} from './protection.mjs';
import {configureManaged} from './managed.mjs';import {start} from './server.mjs';

// Test time and load deterministically; never send an attack to a real host.
let now=0;const guard=new RequestProtection({burst:2,rate:1,maxConcurrent:2,perClientConcurrent:1,maxClients:2,now:()=>now});
const first=guard.enter('a');assert(first.release);assert(!guard.enter('a').release);first.release();first.release();assert.equal(guard.active,0);
assert.equal(guard.enter('a').retryAfter,1);now=1000;guard.enter('a').release();
const second=guard.enter('b');assert(second.release);assert.equal(guard.enter('c').retryAfter,60);second.release();
now=62000;const recycled=guard.enter('c');assert(recycled.release);recycled.release();assert(guard.clients.size<=2);
const globalGuard=new RequestProtection({maxConcurrent:1,maxLogins:1});const active=globalGuard.enter('one',true);assert(!globalGuard.enter('two').release);active.release();const admitted=globalGuard.enter('two');assert(admitted.release);admitted.release();
const loginGuard=new RequestProtection({loginBurst:1,loginRate:1/3,now:()=>now});loginGuard.enter('login',true).release();assert.equal(loginGuard.enter('login',true).retryAfter,3);now+=3000;loginGuard.enter('login',true).release();
const proxyRequest={headers:{'x-forwarded-for':'spoofed, 203.0.113.8'},socket:{remoteAddress:'127.0.0.1'}};
assert.equal(clientAddress(proxyRequest,false),'127.0.0.1');assert.equal(clientAddress(proxyRequest,true),'203.0.113.8');
console.log('PASS bounded client memory, rate refill, login throttling, global/per-client concurrency and forwarded-address spoof resistance');

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'radio-protected-test-'));
const environment={RADIO_NAME:'Managed Test',RADIO_PASSWORD:'private-test-password-47',RADIO_SIGNING_SECRET:'a-test-only-stable-signing-secret-at-least-32-chars'};
const oldSecret=process.env.RADIO_SIGNING_SECRET;process.env.RADIO_SIGNING_SECRET=environment.RADIO_SIGNING_SECRET;
let app;
try{
 const file=configureManaged({directory:dir,environment}),original=fs.readFileSync(file,'utf8');
 assert(!original.includes(environment.RADIO_PASSWORD));assert(!original.includes(environment.RADIO_SIGNING_SECRET));assert.equal(fs.statSync(file).mode&0o777,0o600);
 configureManaged({directory:dir,environment});assert.equal(fs.readFileSync(file,'utf8'),original);
 app=start({file,port:0,host:'127.0.0.1',quiet:true});await new Promise(r=>app.server.once('listening',r));let origin='http://127.0.0.1:'+app.server.address().port;
 const request=(route,{token,body,raw,method=body||raw?'POST':'GET',headers={}}={})=>fetch(origin+route,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):raw});
 const json=async(route,options)=>{const r=await request(route,options);const data=await r.json();assert(r.ok,JSON.stringify(data));return data};
 for(const route of ['/','/audio-test','/audio-test.html','/scanner-audio.js','/ptt-cues.js','/ptt-key.wav','/audio/fire-tone.wav','/api/pair','/api/pair-code','/api/page','/api/recordings/'+randomUUID()+'.wav'])assert.equal((await request(route)).status,404,route);
 for(const route of ['/api/catalog','/api/feed?channel=0&after=0','/api/status','/api/radio/me'])assert.equal((await request(route)).status,401,route);
 const a=await json('/api/radio/login',{body:{password:environment.RADIO_PASSWORD,callsign:'Engine 12',station:randomUUID()}}),b=await json('/api/radio/login',{body:{password:environment.RADIO_PASSWORD,callsign:'Medic 4',station:randomUUID()}});
 assert.equal(a.server.scannerEnabled,false);assert.equal((await json('/api/catalog',{token:a.token})).channels.length,48);
 assert.equal((await request('/api/page',{token:a.token,body:{preset:'fire-tone',channel:0}})).status,404);
 const tx=await json('/api/tx',{token:a.token,body:{channel:0}}),samples=new Int16Array(1600).fill(2400);
 assert((await request('/api/tx/'+tx.id+'/packets?seq=0',{token:a.token,raw:samples})).ok);
 assert.equal((await request('/api/feed?channel=0&after=0')).status,401);
 const feed=await json('/api/feed?channel=0&after=0',{token:b.token});assert.equal(feed.packets[0].label,'Engine 12');assert.equal(Buffer.from(feed.packets[0].pcm,'base64').compare(Buffer.from(samples.buffer)),0);
 assert.equal((await json('/api/feed?channel=1&after=0',{token:b.token})).packets.length,0);
 await json('/api/tx/'+tx.id+'/end',{token:a.token,body:{}});
 const oversized=await request('/api/tx',{token:a.token,raw:Buffer.alloc(16385)});assert.equal(oversized.status,413);
 assert.equal((await request('/api/catalog',{headers:{authorization:'Bearer '+ 'x'.repeat(10000)}})).status,431);
 // Many forged header identities still share the real direct client's login limit.
 let limited;for(let i=0;i<8;i++){const r=await request('/api/radio/login',{body:{password:'wrong',callsign:'Wrong',station:randomUUID()},headers:{'x-forwarded-for':'fake-'+i,'cf-connecting-ip':'fake-'+i}});if(r.status===429){limited=r;break}}
 assert(limited);assert(Number(limited.headers.get('retry-after'))>0);
 await app.close();app=null;
 // Emulate loss of the free host's disk: stable environment still validates prior grants.
 fs.rmSync(path.join(dir,'.data'),{recursive:true,force:true});configureManaged({directory:dir,environment});
 app=start({file,port:0,host:'127.0.0.1',quiet:true});await new Promise(r=>app.server.once('listening',r));origin='http://127.0.0.1:'+app.server.address().port;
 assert.equal((await json('/api/radio/me',{token:b.token})).callsign,'Medic 4');
 console.log('PASS managed radio-only startup, no scanner/recording/dispatch routes, authenticated receive, exact PCM, channels, bounded uploads/headers, HTTP 429, stable sessions after ephemeral-disk restart');
}finally{if(app)await app.close();if(oldSecret===undefined)delete process.env.RADIO_SIGNING_SECRET;else process.env.RADIO_SIGNING_SECRET=oldSecret;fs.rmSync(dir,{recursive:true,force:true})}
