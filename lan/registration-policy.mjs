import {randomBytes,createHash} from 'node:crypto';
const digest=code=>createHash('sha256').update(code).digest('hex');
export function initRegistration(db){
 db.exec("CREATE TABLE IF NOT EXISTS registration_invites(id TEXT PRIMARY KEY,code_hash TEXT UNIQUE NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,revoked_at INTEGER,used_at INTEGER,used_by TEXT); CREATE TABLE IF NOT EXISTS disabled_accounts(user_id TEXT PRIMARY KEY,reason TEXT NOT NULL,disabled_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS account_governance_log(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,target_id TEXT NOT NULL,reason TEXT NOT NULL,created_at INTEGER NOT NULL);");
}
const log=(db,actor,action,target,reason,now)=>db.prepare('INSERT INTO account_governance_log VALUES(?,?,?,?,?,?)').run(randomBytes(16).toString('hex'),actor,action,target,reason,now);
function tx(db,fn){db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}
export function createRegistrationInvite(db,actor,days=7,now=Date.now()){
 if(!Number.isInteger(days)||days<1||days>30)throw Error('有效期须为1至30天。');
 const code=randomBytes(32).toString('hex'),id=randomBytes(16).toString('hex'),expiresAt=now+days*86400000;
 tx(db,()=>{db.prepare('INSERT INTO registration_invites(id,code_hash,created_at,expires_at) VALUES(?,?,?,?)').run(id,digest(code),now,expiresAt);log(db,actor,'registration-invite-create',id,'单次注册邀请',now);});
 return {id,code,expiresAt};
}
export function revokeRegistrationInvite(db,actor,id,now=Date.now()){
 return tx(db,()=>{const result=db.prepare('UPDATE registration_invites SET revoked_at=? WHERE id=? AND used_at IS NULL AND revoked_at IS NULL').run(now,id);if(!result.changes)throw Error('邀请已使用、撤销或不存在。');log(db,actor,'registration-invite-revoke',id,'撤销未使用邀请',now);});
}
export function invitedAccount(db,code,{id,email,salt,hash},now=Date.now()){
 if(typeof code!=='string'||!/^[a-f0-9]{64}$/.test(code))throw Error('邀请码无效。');
 return tx(db,()=>{
  if(db.prepare('SELECT count(*) AS n FROM accounts').get().n>=1000)throw Error('账号上限。');
  const row=db.prepare('SELECT id FROM registration_invites WHERE code_hash=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>?').get(digest(code),now);
  if(!row)throw Error('邀请码无效或过期。');
  db.prepare('INSERT INTO accounts(id,email,salt,hash,created) VALUES(?,?,?,?,?)').run(id,email,salt,hash,now);
  const used=db.prepare('UPDATE registration_invites SET used_at=?,used_by=? WHERE id=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>?').run(now,id,row.id,now);
  if(!used.changes)throw Error('邀请码不可使用。');
  log(db,id,'registration-invite-redeem',row.id,'注册邀请兑换',now);return id;
 });
}
export function accountDisabled(db,id){return !!db.prepare('SELECT 1 FROM disabled_accounts WHERE user_id=?').get(id);}
export function changeAccountState(db,actor,id,disable,reason,now=Date.now()){
 if(actor===id||typeof reason!=='string'||!reason.trim()||reason.length>500)throw Error('处理对象或原因无效。');
 return tx(db,()=>{
  if(!db.prepare('SELECT id FROM accounts WHERE id=?').get(id))throw Error('账号不存在。');
  if(disable){db.prepare('INSERT INTO disabled_accounts VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET reason=excluded.reason,disabled_at=excluded.disabled_at').run(id,reason.trim(),now);db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);}
  else db.prepare('DELETE FROM disabled_accounts WHERE user_id=?').run(id);
  log(db,actor,disable?'account-disable':'account-enable',id,reason.trim(),now);
 });
}
