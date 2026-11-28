import https from 'node:https';
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {readFileSync, mkdirSync, chmodSync, writeFileSync, realpathSync, statSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {allowedOrigin,AuthLimiter} from './auth-policy.mjs';
import {createPublicAssetHandler} from './public-assets.mjs';
import {initRegistration,registrationMode,setRegistrationMode,createRegistrationInvite,revokeRegistrationInvite,registerAccount,accountDisabled,changeAccountState,issueSession} from './registration-policy.mjs';

const scrypt=promisify(scryptCallback), dir=process.env.YANYUAN_DATA_DIR||join(homedir(),'.local/share/yanyuan-lan');
mkdirSync(dir,{recursive:true,mode:0o700});chmodSync(dir,0o700);
const db=new DatabaseSync(join(dir,'accounts.sqlite'));
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,salt BLOB NOT NULL,hash BLOB NOT NULL,created INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL);');
chmodSync(join(dir,'accounts.sqlite'),0o600);
initRegistration(db);
const reserved=new Set((process.env.YANYUAN_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));
if(!reserved.size)throw Error('YANYUAN_ADMIN_EMAILS must be configured.');
const validEmail=e=>typeof e==='string'&&e.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const passwordOK=p=>typeof p==='string'&&p.length>=12&&Buffer.byteLength(p)<=256;
const hashToken=t=>createHash('sha256').update(t).digest('hex');
const derive=(p,s)=>scrypt(p,s,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
async function createAccount(email,password){const salt=randomBytes(16),hash=await derive(password,salt),id='lan-'+randomBytes(16).toString('hex');db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?)').run(id,email,salt,hash,Date.now());return id;}
if(process.argv[2]==='bootstrap-admins'){
 const credentials=[];for(const email of reserved){let user=db.prepare('SELECT id FROM accounts WHERE email=?').get(email);if(user)throw Error('Admin already exists; refusing to overwrite.');const password=randomBytes(18).toString('base64url');await createAccount(email,password);credentials.push(`${email}  ${password}`);}
 const output=join(dir,'initial-admin-passwords.txt');writeFileSync(output,credentials.join('\n')+'\n',{mode:0o600,flag:'wx'});console.log('Initial admin accounts created; credentials saved to private file.');process.exit(0);
}
const certDir=process.env.YANYUAN_TLS_DIR||dir;
const options={key:readFileSync(join(certDir,'server.key')),cert:readFileSync(join(certDir,'server.crt'))};
const lanPrefix=process.env.YANYUAN_LAN_PREFIX||'192.168.100.';
if(!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.$/.test(lanPrefix))throw Error('Invalid LAN prefix.');
const publicRoot=realpathSync(join(process.cwd(),'public'));
const servePublicAsset=createPublicAssetHandler(publicRoot);
const literaturePages=new Set(['/literature','/literature/','/reading-notes','/reading-notes/']);
const apiPaths=new Set(['/api/literature/entries','/api/literature/community','/api/literature/governance','/api/literature/interactions','/api/literature/network','/api/literature/research-ai','/api/literature/materials','/api/literature/feedback','/api/ai-questions','/api/question-bank','/api/session','/api/archive','/api/attachments','/api/essays/review','/api/materials','/api/material-files','/api/study-state','/api/oral-audio','/api/oral-analysis','/api/feedback','/api/learning-report','/api/today','/api/study-plans','/api/knowledge-graph','/api/references','/api/deep-research','/api/exam-imports','/api/admissions','/api/admissions/followup','/api/research-projects','/api/ai-grading','/api/admin/session','/api/admin/providers','/api/admin/usage','/api/admin/models','/api/admin/oral-audio']);
function permittedPath(path){
 if(path==='/'||path==='/admin'||path==='/mcp'||literaturePages.has(path)||apiPaths.has(path))return true;
 try{const decoded=decodeURIComponent(path);if(decoded.includes('\\')||decoded.split('/').some(x=>x.startsWith('.')))return false;const file=realpathSync(join(publicRoot,decoded));return file.startsWith(publicRoot+'/')&&statSync(file).isFile();}catch{return false;}
}
const limiter=new AuthLimiter(),publicOrigins=new Set((process.env.YANYUAN_PUBLIC_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean));let busy=0;
for(const origin of publicOrigins)if(new URL(origin).origin!==origin||new URL(origin).protocol!=='https:')throw Error('Invalid public origin.');
function originOK(req,url){const ok=allowedOrigin(req.headers.origin,url.origin,publicOrigins);if(!ok)console.warn(JSON.stringify({event:'origin-rejected',origin:req.headers.origin||null,host:req.headers.host}));return ok;}
function retry(res,status,message,ret='/'){res.setHeader('Retry-After',status===429?'60':'3');return respond(res,status,page(message,ret));}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function safeReturn(value){try{if(!value?.startsWith('/')||value.startsWith('//'))return '/';const u=new URL(value,'https://local');if(u.origin!=='https://local'||u.pathname.startsWith('/auth/')||u.pathname.includes('signin-with-chatgpt'))return '/';return u.pathname+u.search+u.hash;}catch{return '/';}}
function respond(res,status,body,type='text/html; charset=utf-8'){res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(body);}
function page(message='',ret='/'){const invited=registrationMode(db)==='invite';return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>登录 · 和知 AI</title><style>body{font:16px system-ui;margin:0;background:#f4f0e7;color:#1c2721}main{max-width:470px;margin:5vh auto;padding:24px}section{background:#fffdf8;border:1px solid #d9d1c2;padding:24px;margin:16px 0}h1,h2{font-weight:600}label{display:block;margin:14px 0}input{box-sizing:border-box;display:block;width:100%;padding:12px;margin-top:6px;font:inherit}button{background:#1c2721;color:white;border:0;padding:12px 22px;font:inherit;cursor:pointer}.notice{color:#9b4248}a{color:#7c3339}</style><main><h1>和知 AI</h1><p class="notice">${esc(message)}</p><section><h2>登录</h2><form method="post" action="/auth/login"><input type="hidden" name="return_to" value="${esc(ret)}"><label>邮箱<input type="email" name="email" required maxlength="254" autocomplete="username"></label><label>密码<input type="password" name="password" required maxlength="128" autocomplete="current-password"></label><button>登录</button></form></section><section><h2>注册</h2><p>试用版不验证邮箱，暂不支持密码找回。${invited?'当前注册需管理员提供的单次邀请。':'当前允许自行注册；研究社区仍需独立邀请。'}</p><form method="post" action="/auth/register"><input type="hidden" name="return_to" value="${esc(ret)}"><label>邮箱<input type="email" name="email" required maxlength="254" autocomplete="username"></label><label>密码（至少 12 个字符）<input type="password" name="password" required minlength="12" maxlength="128" autocomplete="new-password"></label>${invited?'<label>注册邀请码<input name="invite" required pattern="[a-f0-9]{64}" maxlength="64" autocomplete="off"></label>':''}<button>创建账号</button></form></section><a href="/">返回首页</a></main></html>`;}
function session(req){const pairs=(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith('yanyuan_session='));if(pairs.length!==1)return null;const token=pairs[0].slice('yanyuan_session='.length);if(!/^[a-f0-9]{64}$/.test(token))return null;return db.prepare('SELECT accounts.id,accounts.email FROM sessions JOIN accounts ON accounts.id=sessions.user_id WHERE token_hash=? AND expires>? AND NOT EXISTS(SELECT 1 FROM disabled_accounts d WHERE d.user_id=accounts.id)').get(hashToken(token),Date.now())||null;}
async function formBody(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>4096)throw Error('large');chunks.push(chunk);}return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));}
function governancePage(user,message='',code=''){
 const mode=registrationMode(db),invites=db.prepare('SELECT id,expires_at,used_at,revoked_at FROM registration_invites ORDER BY created_at DESC LIMIT 100').all();
 const accounts=db.prepare("SELECT a.id,a.email,CASE WHEN d.user_id IS NULL THEN 0 ELSE 1 END AS disabled FROM accounts a LEFT JOIN disabled_accounts d ON d.user_id=a.id ORDER BY a.created DESC LIMIT 1000").all();
 const logs=db.prepare("SELECT action,target_id,reason,created_at FROM account_governance_log ORDER BY created_at DESC LIMIT 100").all();
 const date=n=>n?new Date(n).toISOString().slice(0,16).replace('T',' ')+' UTC':'—';
 return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>账号安全 · 和知 AI</title><style>body{font:15px system-ui;background:#f9f6ee;color:#0f2742;max-width:1000px;margin:auto;padding:20px}section{background:#fffefa;border:1px solid #e0d8c9;padding:16px;margin:16px 0;border-radius:8px}button{background:#0f2742;color:#fffefa;border:0;padding:9px;border-radius:5px}input,select{max-width:100%;font:inherit;margin:5px}article{border-top:1px solid #e0d8c9;padding:12px;overflow-wrap:anywhere}code{overflow-wrap:anywhere}a{color:#755524}</style><h1>账号安全管理</h1><p role="status">${esc(message)}</p><p>仅限中国版网关系统管理员。不会读取私人笔记，社区资格由原治理中心管理。</p>${code?'<section><h2>仅本次显示的单次注册邀请</h2><code>'+esc(code)+'</code><p>请通过可信渠道交付，不要公开。</p></section>':''}<section><h2>注册策略</h2><p>当前：${mode==='invite'?'邀请注册':'自行注册'}。切换不影响已有账号。</p><form method="post" action="/auth/governance"><input type="hidden" name="action" value="mode"><label>注册模式<select name="mode"><option value="open"${mode==='open'?' selected':''}>自行注册</option><option value="invite"${mode==='invite'?' selected':''}>单次邀请注册</option></select></label><label>变更依据<input name="reason" required maxlength="500"></label><button>保存注册策略</button></form></section><section><h2>生成注册邀请</h2><form method="post" action="/auth/governance"><input type="hidden" name="action" value="create"><label>有效期（天）<input type="number" name="days" min="1" max="30" value="7" required></label><button>生成</button></form>${invites.map(i=>'<article>'+esc(i.id)+' · 到期 '+date(i.expires_at)+' · '+(i.used_at?'已使用':i.revoked_at?'已撤销':i.expires_at<=Date.now()?'已过期':'有效')+(!i.used_at&&!i.revoked_at?'<form method="post" action="/auth/governance"><input type="hidden" name="action" value="revoke"><input type="hidden" name="id" value="'+esc(i.id)+'"><button>撤销</button></form>':'')+'</article>').join('')}</section><section><h2>账号状态</h2><p>停用撤销已有会话，不删除学习资料。恢复后必须重新登录。</p>${accounts.map(a=>'<article>'+esc(a.email)+' · '+(a.disabled?'停用':'有效')+(a.id===user.id||reserved.has(a.email)?' · 受保护管理员账号':'<form method="post" action="/auth/governance"><input type="hidden" name="action" value="'+(a.disabled?'enable':'disable')+'"><input type="hidden" name="id" value="'+esc(a.id)+'"><label>处理依据<input name="reason" maxlength="500" required></label><button>'+(a.disabled?'恢复账号':'停用账号')+'</button></form>')+'</article>').join('')}</section><section><h2>近期操作记录（最多100条）</h2>${logs.map(l=>'<article>'+esc(l.action)+' · '+esc(l.target_id)+' · '+esc(l.reason)+' · '+date(l.created_at)+'</article>').join('')}</section><p><a href="/literature#community">研究社区</a> · <a href="/">返回首页</a></p></html>`;
}
const server=https.createServer(options,async(req,res)=>{try{
 const url=new URL(req.url,'https://'+req.headers.host),path=url.pathname,ip=req.socket.remoteAddress||'';
 const peer=ip.replace(/^::ffff:/,'');if(peer!=='127.0.0.1'&&peer!=='::1'&&!(peer.startsWith(lanPrefix)&&/^\d{1,3}$/.test(peer.slice(lanPrefix.length))))return respond(res,403,'仅限局域网访问。');
 if(path==='/signin-with-chatgpt'&&req.method==='GET')return respond(res,200,page('',safeReturn(url.searchParams.get('return_to'))));
 if(path==='/auth/governance'){
  const user=session(req);if(!user||!reserved.has(user.email))return respond(res,403,'仅网关系统管理员可访问账号安全管理。');
  if(req.method==='GET')return respond(res,200,governancePage(user));
  if(req.method!=='POST')return respond(res,405,'不支持的请求');
  if(!originOK(req,url))return respond(res,403,'请求来源不匹配。');
  if(!limiter.password('governance:'+user.id))return retry(res,429,'操作过于频繁。');
  const f=await formBody(req),action=f.get('action'),id=String(f.get('id')||'');
  // Session may have changed while reading the form. Never trust client-provided actor/role.
  const fresh=session(req);if(!fresh||fresh.id!==user.id||!reserved.has(fresh.email))return respond(res,403,'管理员会话已变化。');
  try{
   if(action==='mode')setRegistrationMode(db,user.id,String(f.get('mode')||''),String(f.get('reason')||''));
   else if(action==='create'){const invitation=createRegistrationInvite(db,user.id,Number(f.get('days')));return respond(res,201,governancePage(user,'注册邀请已生成。',invitation.code));}
   else if(action==='revoke')revokeRegistrationInvite(db,user.id,id);
   else if(action==='disable'||action==='enable')changeAccountState(db,user.id,id,action==='disable',String(f.get('reason')||''),reserved);
   else throw Error('未知操作。');
   return respond(res,200,governancePage(user,'操作已记录。'));
  }catch{return respond(res,400,governancePage(user,'操作失败，请检查账号状态和输入。'));}
 }
 if(path==='/auth/account'&&req.method==='GET'){if(!session(req)){res.writeHead(302,{location:'/signin-with-chatgpt'});return res.end();}return respond(res,200,'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>修改密码</title><style>body{font:16px system-ui;background:#f4f0e7;max-width:440px;margin:5vh auto;padding:20px}label{display:block;margin:20px 0}input{display:block;box-sizing:border-box;width:100%;padding:12px;font:inherit}button{padding:12px;background:#1c2721;color:white;border:0;font:inherit}</style><h1>修改密码</h1><form method="post" action="/auth/password"><label>原密码<input type="password" name="old" required autocomplete="current-password"></label><label>新密码（至少 12 个字符）<input type="password" name="password" required minlength="12" maxlength="128" autocomplete="new-password"></label><button>保存并重新登录</button></form><p><a href="/">返回首页</a></p>'+ (reserved.has(session(req)?.email)?'<p><a href="/auth/governance">账号安全管理</a></p>':'')+'</html>');}
 if(path==='/auth/password'&&req.method==='POST'){
  const user=session(req);if(!user)return respond(res,401,'请先登录');if(!originOK(req,url))return respond(res,403,'请求来源不匹配，请从网站页面重新进入。');if(!limiter.password(user.id))return retry(res,429,'修改密码过于频繁，请稍后重试。');if(busy>=4)return retry(res,503,'登录服务繁忙，请稍后重试。');
  const form=await formBody(req),old=String(form.get('old')||''),password=String(form.get('password')||'');if(!passwordOK(old)||!passwordOK(password))return respond(res,400,'密码格式无效。');
  busy++;try{const row=db.prepare('SELECT * FROM accounts WHERE id=?').get(user.id),actual=await derive(old,row.salt);if(!timingSafeEqual(actual,row.hash))return respond(res,401,'原密码不正确。');const salt=randomBytes(16),hash=await derive(password,salt);db.exec('BEGIN IMMEDIATE');try{const current=db.prepare('SELECT hash FROM accounts WHERE id=?').get(user.id);if(!current||accountDisabled(db,user.id)||!timingSafeEqual(current.hash,row.hash))throw Error('Account changed');db.prepare('UPDATE accounts SET salt=?,hash=? WHERE id=?').run(salt,hash,user.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}res.writeHead(303,{'location':'/signin-with-chatgpt','set-cookie':'yanyuan_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict','cache-control':'no-store'});return res.end();}finally{busy--;}
 }
 if(path==='/signout-with-chatgpt'&&req.method==='GET'){const p=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('yanyuan_session='));if(p)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(p.slice('yanyuan_session='.length)));res.writeHead(302,{'location':'/','set-cookie':'yanyuan_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict','cache-control':'no-store'});return res.end();}
 if(['/auth/login','/auth/register'].includes(path)){
  if(req.method!=='POST')return respond(res,405,'不支持的请求');
  if(!originOK(req,url))return respond(res,403,page('请求来源不匹配，请从网站页面重新进入。'));
  const form=await formBody(req),email=String(form.get('email')||'').trim().toLowerCase(),password=String(form.get('password')||''),ret=safeReturn(form.get('return_to'));
  if(!validEmail(email)||!passwordOK(password))return respond(res,400,page('邮箱格式无效，或密码少于 12 个字符。',ret));
  if(!(path==='/auth/login'?limiter.login(ip,email):limiter.register(ip)))return retry(res,429,'尝试次数过多，请稍后重试。',ret);
  if(busy>=4)return retry(res,503,'登录服务繁忙，请稍后重试。',ret);
  busy++;try{
   let user=db.prepare('SELECT * FROM accounts WHERE email=?').get(email);
   if(path==='/auth/register'){
    if(reserved.has(email))return respond(res,403,page('该邮箱保留给管理员，请联系管理员。',ret));
    if(user||db.prepare('SELECT count(*) AS n FROM accounts').get().n>=1000)return respond(res,400,page('账号无法创建，请检查邮箱或联系管理员。',ret));
    try{const salt=randomBytes(16),hash=await derive(password,salt),id='lan-'+randomBytes(16).toString('hex');registerAccount(db,String(form.get('invite')||''),{id,email,salt,hash});user={id,email,hash};}catch{return respond(res,400,page('账号无法创建，请检查注册要求或联系管理员。',ret));}
   }else{const salt=user?.salt||Buffer.alloc(16),expected=user?.hash||Buffer.alloc(64),actual=await derive(password,salt);if(!user||!timingSafeEqual(actual,expected)||accountDisabled(db,user.id)){limiter.failed(ip,email);return respond(res,401,page('邮箱或密码不正确。',ret));}limiter.success(ip,email);}
   const token=randomBytes(32).toString('hex'),expires=Date.now()+7*86400000;try{issueSession(db,user.id,user.hash,hashToken(token),expires);}catch{return respond(res,401,page('账号或登录状态已变化，请重新登录。',ret));}
   res.writeHead(303,{'location':ret,'cache-control':'no-store','set-cookie':'yanyuan_session='+token+'; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Strict'});return res.end();
  }finally{busy--;}
 }
 if(!permittedPath(path))return respond(res,404,'不存在');
 if(req.method!=='GET'&&req.method!=='HEAD'&&req.headers.origin&&!originOK(req,url))return respond(res,403,'请求来源不匹配');
 if(literaturePages.has(path)&&(req.method==='GET'||req.method==='HEAD')){
  let page;
  try{page=readFileSync(join(publicRoot,'literature-app','index.html'));}
  catch{return respond(res,503,'文学研习暂时不可用');}
  res.writeHead(200,{
   'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',
   'content-security-policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  });
  return res.end(req.method==='HEAD'?undefined:page);
 }
 if(servePublicAsset(req,res,url))return;
 const user=session(req),headers={...req.headers};for(const key of Object.keys(headers))if(key.startsWith('oai-authenticated-user-')||key.startsWith('x-forwarded-')||['forwarded','x-real-ip','cf-connecting-ip','x-yanyuan-lan'].includes(key))delete headers[key];headers['x-yanyuan-lan']='1';
 if(user){headers['oai-authenticated-user-id']=user.id;headers['oai-authenticated-user-email']=user.email;}
 if(headers.origin)headers.origin='http://'+req.headers.host;
 headers.cookie=(headers.cookie||'').split(';').filter(x=>!x.trim().startsWith('yanyuan_session=')).join(';');
 const upstream=http.request({host:'127.0.0.1',port:5173,path:req.url,method:req.method,headers},up=>{res.writeHead(up.statusCode||502,up.headers);up.pipe(res);});upstream.on('error',()=>{if(!res.headersSent)respond(res,502,'服务暂时不可用');else res.destroy();});req.pipe(upstream);
 }catch{if(!res.headersSent)respond(res,400,'请求无效');else res.destroy();}});
server.on('clientError',(_err,socket)=>socket.destroy());server.listen(8443,process.env.YANYUAN_BIND||'127.0.0.1',()=>console.log('LAN gateway listening on port 8443'));
