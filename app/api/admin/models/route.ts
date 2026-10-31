import {env} from 'cloudflare:workers';
import {adminWrite,adminReply,adminFail} from '../../../../lib/admin-http';
import {providerForExecution} from '../../../../lib/admin-providers';
import {AdminInputError} from '../../../../lib/admin-contracts';
import {AccessError} from '../../../../lib/user-access';
import {fetchModelList} from '../../../../lib/provider-models';
import {adminDb} from '../../../../lib/admin-access';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{
 const {user,body}=await adminWrite(request);
 if(!body||Object.keys(body).some(k=>!['id','expectedRevision'].includes(k))||!/^provider-[a-f0-9-]{36}$/.test(body.id)||!Number.isSafeInteger(body.expectedRevision))throw new AdminInputError('请先保存 Provider 配置再获取模型。');
 const provider=await providerForExecution(body.id);
 if(provider.revision!==body.expectedRevision)throw new AccessError('配置已更新，请刷新后重试。',409);
 const models=await fetchModelList(provider,env.AI_MODEL_HOSTS);
 await adminDb().prepare('INSERT INTO admin_audit_events(id,actor_id,action,provider_id,created_at) VALUES(?,?,?,?,?)').bind('audit-'+crypto.randomUUID(),user.id,'provider.models_fetched',provider.id,new Date().toISOString()).run();
 return adminReply({models,fetchedAt:new Date().toISOString()});
}catch(e){return adminFail(e);}}
