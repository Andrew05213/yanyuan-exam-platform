import {env} from 'cloudflare:workers';
import {adminDb} from './admin-access';
import {listProviders,providerForExecution} from './admin-providers';
import {AdminInputError,isOpenAIProtocol} from './admin-contracts';
import {AccessError} from './user-access';
import {modelListUrl} from './provider-models';

type SettingsRow={provider_id:string|null;model:string|null;revision:number;updated_at:string};
const conflict=()=>new AccessError('原音配置或 Provider 已更新，请刷新后重试。',409);

export async function audioSettings(){
 const row=await adminDb().prepare("SELECT provider_id,model,revision,updated_at FROM ai_task_settings WHERE task='oral-audio'").first<SettingsRow>();
 if(row)return {providerId:row.provider_id,model:row.model,revision:row.revision,source:'database',updatedAt:row.updated_at};
 // Existing deployments retain their environment selection until explicitly saved/disabled in the UI.
 const providerId=env.ORAL_AUDIO_PROVIDER_ID||null;
 const provider=providerId?(await listProviders()).find(p=>p.id===providerId):null;
 return {providerId,model:provider?.model||null,revision:0,source:providerId?'environment':'none',updatedAt:null};
}

export async function saveAudioSettings(body:any,actorId:string){
 if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['providerId','model','expectedRevision','expectedProviderRevision'].includes(k))||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||body.expectedRevision>=Number.MAX_SAFE_INTEGER)throw new AdminInputError('原音分析配置不正确。');
 const disabled=body.providerId===null;
 if(disabled){
  if(body.model!==null||body.expectedProviderRevision!==null)throw new AdminInputError('停用原音分析时请清空 Provider 和模型。');
 }else{
  if(typeof body.providerId!=='string'||!/^provider-[a-f0-9-]{36}$/.test(body.providerId)||typeof body.model!=='string'||!body.model.trim()||body.model.length>150||/[\u0000-\u001f\u007f]/.test(body.model)||!Number.isSafeInteger(body.expectedProviderRevision)||body.expectedProviderRevision<1)throw new AdminInputError('请选择已保存的 Provider，并填写音频模型。');
  const p=(await listProviders()).find(p=>p.id===body.providerId);
  if(!p)throw new AdminInputError('Provider 不存在。');
  if(p.revision!==body.expectedProviderRevision)throw conflict();
  if(!p.enabled||!p.hasKey||!isOpenAIProtocol(p.protocol))throw new AdminInputError('请选择已启用、已设置密钥的 OpenAI 兼容 Provider。');
  modelListUrl(p.baseUrl,env.AI_MODEL_HOSTS);
 }
 const now=new Date().toISOString(),db=adminDb();
 // One conditional UPSERT protects both first-save and subsequent concurrent edits.
 const guard=disabled?'1=1':"EXISTS(SELECT 1 FROM ai_providers WHERE id=? AND revision=? AND enabled=1 AND encrypted_key IS NOT NULL AND protocol IN ('openai-compatible','openai-responses'))";
 const args:unknown[]=[body.providerId,disabled?null:body.model.trim(),now,actorId];
 if(!disabled)args.push(body.providerId,body.expectedProviderRevision);
 args.push(body.expectedRevision,body.expectedRevision,body.expectedRevision);
 const result=await db.prepare(`INSERT INTO ai_task_settings(task,provider_id,model,revision,updated_at,updated_by)
 SELECT 'oral-audio',?,?,1,?,? WHERE ${guard} AND
 (EXISTS(SELECT 1 FROM ai_task_settings WHERE task='oral-audio' AND revision=?) OR (?=0 AND NOT EXISTS(SELECT 1 FROM ai_task_settings WHERE task='oral-audio')))
 ON CONFLICT(task) DO UPDATE SET provider_id=excluded.provider_id,model=excluded.model,revision=ai_task_settings.revision+1,updated_at=excluded.updated_at,updated_by=excluded.updated_by WHERE ai_task_settings.revision=?`).bind(...args).run();
 if(!result.meta.changes)throw conflict();
 await db.prepare('INSERT INTO admin_audit_events(id,actor_id,action,provider_id,created_at) VALUES(?,?,?,?,?)').bind('audit-'+crypto.randomUUID(),actorId,disabled?'oral_audio.disabled':'oral_audio.config_saved',body.providerId||'',now).run();
 return audioSettings();
}

export async function audioProviderForExecution(){
 const settings=await audioSettings();
 if(!settings.providerId||!settings.model)throw new AccessError('原音分析尚未配置。',503);
 const provider=await providerForExecution(settings.providerId);
 if(!isOpenAIProtocol(provider.protocol))throw new AccessError('请配置支持音频输入的 OpenAI 兼容 Provider。',503);
 return {...provider,model:settings.model,audioConfigRevision:settings.revision};
}
