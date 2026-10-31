import {env} from 'cloudflare:workers';
import {adminDb} from './admin-access';
import {AccessError} from './user-access';
import {providerInput,microsToPrice,AdminInputError} from './admin-contracts';
import {encryptProviderKey,encryptionReady,decryptProviderKey} from './secret-crypto';

const columns='id,name,protocol,base_url,model,currency,enabled,is_default,revision,key_updated_at,input_price_micros,cached_input_price_micros,output_price_micros,created_at,updated_at,(encrypted_key IS NOT NULL) AS has_key';
type Row=Record<string,any>;
const present=(r:Row)=>({id:r.id,name:r.name,protocol:r.protocol,baseUrl:r.base_url,model:r.model,currency:r.currency,enabled:!!r.enabled,isDefault:!!r.is_default,revision:r.revision,hasKey:!!r.has_key,keyUpdatedAt:r.key_updated_at,inputPrice:microsToPrice(r.input_price_micros),cachedInputPrice:microsToPrice(r.cached_input_price_micros),outputPrice:microsToPrice(r.output_price_micros),createdAt:r.created_at,updatedAt:r.updated_at});
export function keyStorageReady(){return encryptionReady(env.AI_CREDENTIALS_ENCRYPTION_KEY);}
export async function listProviders(){
 const rows=await adminDb().prepare('SELECT '+columns+' FROM ai_providers ORDER BY is_default DESC,created_at DESC,id').all<Row>();
 return rows.results.map(present);
}
async function providerMetadata(id:string){
 const r=await adminDb().prepare('SELECT '+columns+' FROM ai_providers WHERE id=?').bind(id).first<Row>();if(!r)throw new AccessError('Provider 不存在。',404);return present(r);
}
function audit(actorId:string,providerId:string,action:string){return adminDb().prepare('INSERT INTO admin_audit_events(id,actor_id,action,provider_id,created_at) VALUES(?,?,?,?,?)').bind('audit-'+crypto.randomUUID(),actorId,action,providerId,new Date().toISOString());}
export async function saveProvider(body:unknown,actorId:string){
 const p=providerInput(body),id=p.id||'provider-'+crypto.randomUUID(),db=adminDb(),now=new Date().toISOString();
 let encrypted:string|null|undefined;
 if(p.key){if(!keyStorageReady())throw new AccessError('服务器密钥存储尚未初始化。',503);encrypted=await encryptProviderKey(p.key,id,env.AI_CREDENTIALS_ENCRYPTION_KEY!);}
 if(p.clearKey)encrypted=null;
 if(p.id){
  const existing=await db.prepare('SELECT revision FROM ai_providers WHERE id=?').bind(id).first<{revision:number}>();if(!existing)throw new AccessError('Provider 不存在。',404);if(existing.revision!==p.revision)throw new AccessError('配置已被另一位管理员更新，请刷新后重试。',409);
  const keyFields=encrypted===undefined?'':',encrypted_key=?,key_updated_at=?';
  const values:unknown[]=[p.name,p.protocol,p.baseUrl,p.model,p.currency,p.enabled?1:0,p.enabled?1:0,p.inputPriceMicros,p.cachedInputPriceMicros,p.outputPriceMicros,now];
  if(encrypted!==undefined)values.push(encrypted,now);values.push(id,p.revision);
  const result=await db.prepare('UPDATE ai_providers SET name=?,protocol=?,base_url=?,model=?,currency=?,enabled=?,is_default=CASE WHEN ?=0 THEN 0 ELSE is_default END,input_price_micros=?,cached_input_price_micros=?,output_price_micros=?,updated_at=?,revision=revision+1'+keyFields+' WHERE id=? AND revision=?').bind(...values).run();
  if(!result.meta.changes)throw new AccessError('配置刚刚发生变化，请刷新后重试。',409);
 }else{
  await db.prepare('INSERT INTO ai_providers(id,name,protocol,base_url,model,currency,enabled,is_default,revision,encrypted_key,key_updated_at,input_price_micros,cached_input_price_micros,output_price_micros,created_at,updated_at) VALUES(?,?,?,?,?,?,?,0,1,?,?,?,?,?,?,?)').bind(id,p.name,p.protocol,p.baseUrl,p.model,p.currency,p.enabled?1:0,encrypted??null,encrypted?now:null,p.inputPriceMicros,p.cachedInputPriceMicros,p.outputPriceMicros,now,now).run();
 }
 await audit(actorId,id,p.key?'provider.key_replaced':p.clearKey?'provider.key_cleared':'provider.config_saved').run();
 return providerMetadata(id);
}
export async function selectDefaultProvider(body:any,actorId:string){
 if(!body||Object.keys(body).some(k=>!['action','id','expectedRevision'].includes(k))||typeof body.id!=='string'||!/^provider-[a-f0-9-]{36}$/.test(body.id)||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1)throw new AdminInputError('默认 Provider 配置不正确。');
 const p=await providerMetadata(body.id);if(!p.enabled)throw new AdminInputError('请先启用该 Provider。');if(p.revision!==body.expectedRevision)throw new AccessError('配置已更新，请刷新后重试。',409);
 const now=new Date().toISOString(),db=adminDb();
 const results=await db.batch([
  db.prepare('UPDATE ai_providers SET is_default=0,revision=revision+1,updated_at=? WHERE is_default=1 AND id!=? AND EXISTS(SELECT 1 FROM ai_providers WHERE id=? AND revision=? AND enabled=1)').bind(now,p.id,p.id,p.revision),
  db.prepare('UPDATE ai_providers SET is_default=1,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND enabled=1').bind(now,p.id,p.revision),
 ]);
 if(!results[1].meta.changes)throw new AccessError('配置已更新，请刷新后重试。',409);
 await audit(actorId,p.id,'provider.default_selected').run();return providerMetadata(p.id);
}

// A future model adapter can use this internally. It must never serialize apiKey
// into route responses, errors, logs, client state or usage/audit records.
export async function providerForExecution(id?:string){
 const query=adminDb().prepare(id?'SELECT * FROM ai_providers WHERE id=? AND enabled=1':'SELECT * FROM ai_providers WHERE is_default=1 AND enabled=1');
 const row=await (id?query.bind(id):query).first<Row>();
 if(!row||!row.encrypted_key)throw new AccessError('尚未配置可用的 AI Provider。',503);
 const apiKey=await decryptProviderKey(row.encrypted_key,row.id,env.AI_CREDENTIALS_ENCRYPTION_KEY||'');
 return {id:row.id,name:row.name,protocol:row.protocol,baseUrl:row.base_url,model:row.model,currency:row.currency,revision:row.revision,apiKey,pricing:{inputPriceMicros:row.input_price_micros,cachedInputPriceMicros:row.cached_input_price_micros,outputPriceMicros:row.output_price_micros}};
}
