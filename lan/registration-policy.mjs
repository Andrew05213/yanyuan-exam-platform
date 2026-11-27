import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
const digest=code=>createHash('sha256').update(code).digest('hex');
const token=()=>randomBytes(16).toString('hex');
function tx(db,fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
export function initRegistration(db){
 db.exec("CREATE TABLE IF NOT EXISTS registration_settings(id INTEGER PRIMARY KEY CHECK(id=1),mode TEXT NOT NULL CHECK(mode IN ('open','invite'))); INSERT OR IGNORE INTO registration_settings(id,mode) VALUES(1,'open'); CREATE TABLE IF NOT EXISTS registration_invites(id TEXT PRIMARY KEY,code_hash TEXT UNIQUE NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,revoked_at INTEGER,used_at INTEGER,used_by TEXT); CREATE TABLE IF NOT EXISTS disabled_accounts(user_id TEXT PRIMARY KEY,reason TEXT NOT NULL,disabled_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS account_governance_log(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,target_id TEXT NOT NULL,reason TEXT NOT NULL,created_at INTEGER NOT NULL);");
}
const reasonText=reason=>{if(typeof reason!=='string'||!reason.trim()||reason.length>500)throw Error('处理依据无效。');return reason.trim();};
const log=(db,actor,action,target,reason,now)=>db.prepare('INSERT INTO account_governance_log VALUES(?,?,?,?,?,?)').run(token(),actor,action,target,reason,now);
export function registrationMode(db){const mode=db.prepare('SELECT mode FROM registration_settings WHERE id=1').get()?.mode;if(!['open','invite'].includes(mode))throw Error('Registration mode unavailable');return mode;}
export function setRegistrationMode(db,actor,mode,reason,now=Date.now()){
 if(!['open','invite'].includes(mode))throw Error('注册模式无效。');
 return tx(db,()=>{const why=reasonText(reason);db.prepare('UPDATE registration_settings SET mode=? WHERE id=1').run(mode);log(db,actor,'registration-mode',mode,why,now);});
}
export function createRegistrationInvite(db,actor,days=7,now=Date.now()){
 if(!Number.isInteger(days)||days<1||days>30)throw Error('有效期须为1至30天。');
 const code=randomBytes(32).toString('hex'),id=token(),expiresAt=now+days*86400000;
 tx(db,()=>{db.prepare('INSERT INTO registration_invites(id,code_hash,created_at,expires_at) VALUES(?,?,?,?)').run(id,digest(code),now,expiresAt);log(db,actor,'registration-invite-create',id,'单次注册邀请',now);});
 return {id,code,expiresAt};
}
export function revokeRegistrationInvite(db,actor,id,now=Date.now()){
 return tx(db,()=>{const result=db.prepare('UPDATE registration_invites SET revoked_at=? WHERE id=? AND used_at IS NULL AND revoked_at IS NULL').run(now,id);if(!result.changes)throw Error('邀请不可撤销。');log(db,actor,'registration-invite-revoke',id,'撤销未使用邀请',now);});
}
// Read the current registration policy and consume invitations in the same transaction as account creation.
export function registerAccount(db,code,{id,email,salt,hash},now=Date.now()){
 return tx(db,()=>{
  if(db.prepare('SELECT count(*) AS n FROM accounts').get().n>=1000)throw Error('账号上限。');
  const mode=registrationMode(db);let invite;
  if(mode==='invite'){
   if(typeof code!=='string'||!/^[a-f0-9]{64}$/.test(code))throw Error('邀请码无效。');
   invite=db.prepare('SELECT id FROM registration_invites WHERE code_hash=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>?').get(digest(code),now);
   if(!invite)throw Error('邀请码无效或过期。');
  }
  db.prepare('INSERT INTO accounts(id,email,salt,hash,created) VALUES(?,?,?,?,?)').run(id,email,salt,hash,now);
  if(invite){const used=db.prepare('UPDATE registration_invites SET used_at=?,used_by=? WHERE id=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>?').run(now,id,invite.id,now);if(!used.changes)throw Error('邀请码不可使用。');log(db,id,'registration-invite-redeem',invite.id,'注册邀请兑换',now);}
  return id;
 });
}
export function accountDisabled(db,id){return !!db.prepare('SELECT 1 FROM disabled_accounts WHERE user_id=?').get(id);}
export function changeAccountState(db,actor,id,disable,reason,reserved=new Set(),now=Date.now()){
 if(actor===id||typeof disable!=='boolean')throw Error('处理对象无效。');
 const why=reasonText(reason);
 return tx(db,()=>{
  const account=db.prepare('SELECT email FROM accounts WHERE id=?').get(id);if(!account||reserved.has(account.email.toLowerCase()))throw Error('账号不存在或受保护。');
  if(disable){db.prepare('INSERT INTO disabled_accounts VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET reason=excluded.reason,disabled_at=excluded.disabled_at').run(id,why,now);db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);}
  else db.prepare('DELETE FROM disabled_accounts WHERE user_id=?').run(id);
  log(db,actor,disable?'account-disable':'account-enable',id,why,now);
 });
}
// Verify that the credential has not changed while password verification was awaiting scrypt.
export function issueSession(db,id,verifiedHash,tokenHash,expires,now=Date.now()){
 return tx(db,()=>{const row=db.prepare('SELECT hash FROM accounts WHERE id=?').get(id);if(!row||accountDisabled(db,id)||!verifiedHash||row.hash.length!==verifiedHash.length||!timingSafeEqual(row.hash,verifiedHash))throw Error('账号状态或凭据已变化。');db.prepare('DELETE FROM sessions WHERE expires<?').run(now);db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(tokenHash,id,expires);});
}
