import {env} from 'cloudflare:workers';
import {principal,sameOrigin,fail,AccessError,privateHeaders,readLimitedText} from './user-access';
import {adminDb,rememberUser} from './admin-access';
import {providerForExecution} from './admin-providers';
import {getRecord,updateRecord} from './study-store';
import {textHash} from './study-contracts';
import {gradingSource,applyWrittenGrade} from './grading-contracts';
import {executeGrading} from './grading-upstream';
import {recordAIUsage,finalizeAIUsage} from './ai-usage';
import {AdminInputError} from './admin-contracts';
import {modelListUrl} from './provider-models';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders});
const present=(row:any)=>({jobId:row.id,status:row.status,recordId:row.record_id,questionId:row.question_id,kind:row.kind,result:row.result?JSON.parse(row.result):null,error:row.error});
async function expire(userId:string){await adminDb().prepare("UPDATE ai_grading_jobs SET status='unknown',error='上次请求状态无法确认，请核对用量后再决定是否重新批改。',updated_at=? WHERE owner_id=? AND status='pending' AND created_at<?").bind(new Date().toISOString(),userId,new Date(Date.now()-300000).toISOString()).run();}
export async function GET(request:Request){try{
 const id=new URL(request.url).searchParams.get('jobId');if(id){const user=principal(request);await expire(user.id);const row=await adminDb().prepare('SELECT * FROM ai_grading_jobs WHERE id=? AND owner_id=?').bind(id,user.id).first();if(!row)throw new AccessError('批改记录不存在。',404);return reply(present(row));}
 const row=await adminDb().prepare('SELECT protocol,base_url FROM ai_providers WHERE is_default=1 AND enabled=1 AND encrypted_key IS NOT NULL').first<any>();
 let enabled=false;if(row?.protocol==='openai-compatible'){try{modelListUrl(row.base_url,env.AI_MODEL_HOSTS);enabled=true;}catch{}}
 return reply({enabled,status:enabled?'ready':'not_configured',message:enabled?'AI 批改已就绪':'请管理员配置默认 Provider、模型及密钥（OpenAI 兼容协议）。',kinds:['writing','translation','oral'],score:null});
}catch(e){return fail(e);}}
export async function POST(request:Request){
 let jobId='',userId='',created=false;
 try{
  const user=principal(request);userId=user.id;sameOrigin(request);const body=JSON.parse(await readLimitedText(request,4096));
  if(!body||typeof body!=='object'||Object.keys(body).some(k=>!['recordId','questionId','requestId','expectedRevision'].includes(k))||typeof body.recordId!=='string'||typeof body.requestId!=='string'||!/^[-\w]{10,100}$/.test(body.requestId)||!Number.isSafeInteger(body.expectedRevision)||body.questionId!==undefined&&typeof body.questionId!=='string')throw new AdminInputError('请先保存当前作答再发起批改。');
  jobId='grade-'+await textHash(user.id+'|'+body.requestId);const db=adminDb();await expire(user.id);
  const prior=await db.prepare('SELECT * FROM ai_grading_jobs WHERE id=? AND owner_id=?').bind(jobId,user.id).first<any>();if(prior){if(prior.record_id!==body.recordId||prior.question_id!==(body.questionId||''))throw new AccessError('请求编号不能用于另一份作答。',409);return reply(present(prior),prior.status==='pending'?202:200);}
  const record=await getRecord(body.recordId,user);if(record.revision!==body.expectedRevision)throw new AccessError('作答已更新，请刷新后重新发起批改。',409);
  const source=gradingSource(record,body.questionId||''),sourceHash=await textHash(JSON.stringify(source)),provider=await providerForExecution();
  if(provider.protocol!=='openai-compatible')throw new AdminInputError('默认 Provider 须使用 OpenAI 兼容协议（支持 DeepSeek）。');modelListUrl(provider.baseUrl,env.AI_MODEL_HOSTS);
  const now=new Date().toISOString();try{await db.prepare("INSERT INTO ai_grading_jobs(id,owner_id,record_id,question_id,source_hash,kind,status,provider_id,model,created_at,updated_at) VALUES(?,?,?,?,?,?,'pending',?,?,?,?)").bind(jobId,user.id,record.id,body.questionId||'',sourceHash,source.kind,provider.id,provider.model,now,now).run();}catch{const concurrent=await db.prepare('SELECT * FROM ai_grading_jobs WHERE id=? AND owner_id=?').bind(jobId,user.id).first<any>();if(concurrent)return reply(present(concurrent),202);throw new AccessError('当前已有批改在进行，请等待完成。',429);}
  created=true;const task=source.kind as 'writing'|'translation'|'oral';
  await recordAIUsage(user,provider,{requestId:jobId,task,status:'unknown',counts:{inputTokens:null,cachedInputTokens:null,outputTokens:null}});
  const execution=await executeGrading(provider,source,record.kind==='essay',env.AI_MODEL_HOSTS);
  await finalizeAIUsage(user,provider,{requestId:jobId,task,status:execution.status,counts:execution.counts,elapsedMs:execution.elapsedMs});
  if(execution.error){await db.prepare("UPDATE ai_grading_jobs SET status='failed',error=?,updated_at=? WHERE id=? AND owner_id=?").bind(execution.error,new Date().toISOString(),jobId,user.id).run();return reply({jobId,status:'failed',error:execution.error});}
  const result={assessment:execution.result,provider:{name:provider.name,model:provider.model},usage:execution.counts,gradedAt:new Date().toISOString(),sourceHash,applied:false};
  let current:any=null,sourceUnchanged=false;
  try{current=await getRecord(record.id,user);sourceUnchanged=await textHash(JSON.stringify(gradingSource(current,body.questionId||'')))===sourceHash;}catch{/* Deleted records or cleared answers retain their result in the job only. */}
  if(sourceUnchanged){
   try{
    if(record.kind==='essay'){const completed={...execution.result,sourceHash:await textHash(source.answer),reviewedAt:result.gradedAt,reviewer:'AI · '+provider.name+' / '+provider.model};await updateRecord(current,{...current.payload,firstReview:current.payload.firstReview||completed,latestReview:completed,reviews:[...(current.payload.reviews||[]),completed].slice(-30),status:'reviewed'},user);}
    else if(record.kind==='written-attempt')await updateRecord(current,applyWrittenGrade(current.payload,body.questionId,{...result,applied:true,answer:source.answer,questionIdentity:source.questionIdentity}),user,true);
    else await updateRecord(current,{...current.payload,aiAssessment:{...result,applied:true,answer:source.answer}},user,true);
    result.applied=true;
   }catch{/* Concurrent edits are never overwritten; the job retains the result. */}
  }
  await db.prepare("UPDATE ai_grading_jobs SET status='succeeded',result=?,updated_at=? WHERE id=? AND owner_id=?").bind(JSON.stringify(result),new Date().toISOString(),jobId,user.id).run();
  try{await rememberUser(request,user.id);}catch{}
  return reply({jobId,status:'succeeded',recordId:record.id,result});
 }catch(e){if(created&&jobId&&userId)try{await adminDb().prepare("UPDATE ai_grading_jobs SET status='failed',error='批改或保存未完成，请核对记录后重试。',updated_at=? WHERE id=? AND owner_id=? AND status='pending'").bind(new Date().toISOString(),jobId,userId).run();}catch{}
  if(e instanceof AdminInputError)return reply({error:e.message},400);if(e instanceof SyntaxError)return reply({error:'批改请求格式无效。'},400);return fail(e,'批改或记账未完成，请保留作答后重试。');
 }
}

