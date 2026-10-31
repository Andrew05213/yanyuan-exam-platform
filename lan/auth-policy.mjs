export function allowedOrigin(origin, requestOrigin, publicOrigins=new Set()) {
 try {
  const source=new URL(origin), target=new URL(requestOrigin);
  if(origin!==source.origin)return false;
  return source.origin===target.origin || (publicOrigins.has(source.origin)&&source.hostname===target.hostname);
 } catch { return false; }
}

export class AuthLimiter {
 constructor(now=Date.now){this.now=now;this.rows=new Map();}
 row(key,window){const now=this.now();let row=this.rows.get(key);if(!row||now>=row.until){row={count:0,until:now+window};this.rows.set(key,row);}if(this.rows.size>2000)for(const [k,v] of this.rows)if(now>=v.until)this.rows.delete(k);return row;}
 take(key,max,window){const row=this.row(key,window);return ++row.count<=max;}
 login(ip,email){return this.take('ip:'+ip,120,60000)&&this.row('fail:'+ip+':'+email,300000).count<8;}
 failed(ip,email){this.row('fail:'+ip+':'+email,300000).count++;}
 success(ip,email){this.rows.delete('fail:'+ip+':'+email);}
 register(ip){return this.take('register:'+ip,12,60000);}
 password(user){return this.take('password:'+user,10,60000);}
}
