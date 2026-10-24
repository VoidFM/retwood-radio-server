// Bounded in-memory admission control. The hosting edge handles volumetric DDoS.
export class RequestProtection {
 constructor({maxClients=10000,maxConcurrent=128,perClientConcurrent=32,rate=100,burst=300,loginRate=1/3,loginBurst=6,maxLogins=4,now=()=>Date.now()}={}){
  Object.assign(this,{maxClients,maxConcurrent,perClientConcurrent,rate,burst,loginRate,loginBurst,maxLogins,now});this.clients=new Map();this.active=0;this.logins=0;
 }
 enter(ip,login=false){
  const now=this.now();let state=this.clients.get(ip);
  if(!state){
   if(this.clients.size>=this.maxClients){for(const [key,value] of this.clients)if(!value.active&&now-value.at>60000)this.clients.delete(key)}
   if(this.clients.size>=this.maxClients)return {retryAfter:60};
   state={at:now,tokens:this.burst,loginTokens:this.loginBurst,active:0};this.clients.set(ip,state);
  }
  const elapsed=Math.max(0,now-state.at)/1000;state.at=now;
  state.tokens=Math.min(this.burst,state.tokens+elapsed*this.rate);state.loginTokens=Math.min(this.loginBurst,state.loginTokens+elapsed*this.loginRate);
  if(state.tokens<1)return {retryAfter:Math.ceil(1/this.rate)};
  state.tokens--;
  if(login){if(state.loginTokens<1)return {retryAfter:Math.ceil(1/this.loginRate)};state.loginTokens--}
  if(this.active>=this.maxConcurrent||state.active>=this.perClientConcurrent||(login&&this.logins>=this.maxLogins))return {retryAfter:1};
  this.active++;state.active++;if(login)this.logins++;
  let released=false;
  return {release:()=>{if(released)return;released=true;this.active--;state.active--;if(login)this.logins--}};
 }
}

export function clientAddress(request,trustProxy=false){
 // A trusted single ingress appends the real peer at the right of X-Forwarded-For.
 // Taking the leftmost value lets a client invent addresses to bypass limits.
 const forwarded=trustProxy?String(request.headers['x-forwarded-for']||'').split(',').at(-1)?.trim():'';
 return (forwarded||request.socket.remoteAddress||'unknown').slice(0,128);
}
