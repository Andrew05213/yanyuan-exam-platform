import {env} from 'cloudflare:workers';
import {principal,sameOrigin,AccessError,privateHeaders,readLimitedText,fail} from './user-access';
import {adminDb} from './admin-access';
import {audioProviderForExecution} from './oral-audio-settings';
import {getRecord} from './study-store';
import {textHash} from './study-contracts';
import {modelListUrl} from './provider-models';
import {recordAIUsage,finalizeAIUsage} from './ai-usage';
import {wavMetrics,audioRate,AUDIO_MAX_BYTES} from './oral-audio-contracts';
import {analyzeAudio} from './oral-audio-upstream';
import {configuredAIFetch} from './configured-ai-fetch';
type AudioRow={object_key:string;mime:string;size:number};
type JobRow={id:string;record_id:string;status:string;result:string|null;error:string|null;source_hash:string;kind:string};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders});
async function configured(){
 const p=await audioProviderForExecution();
 const url=modelListUrl(p.baseUrl,env.AI_MODEL_HOSTS);return {...p,host:new URL(url).hostname,consentToken:await textHash(JSON.stringify([p.id,p.revision,p.baseUrl,p.model,p.audioConfigRevision]))};
}
async function target(recordId:string,user:ReturnType<typeof principal>){
 const record=await getRecord(recordId,user);if(record.kind!=='oral-attempt')throw new AccessError('请选择已保存的口试录音。',400);
 const audioId=record.payload.audioId,prompt=JSON.stringify(record.payload.item||{});if(typeof audioId!=='string'||!/^oral-audio-[a-f0-9-]{36}$/.test(audioId)||prompt.length>20000)throw new AccessError('录音或口试题目不完整。',400);
 const row=await adminDb().prepare('SELECT object_key,mime,size FROM oral_audio WHERE id=? AND owner_id=?').bind(audioId,user.id).first<AudioRow>();if(!row)throw new AccessError('录音不存在。',404);
 return {record,audioId,prompt,row,sourceHash:await textHash(JSON.stringify({audioId,prompt}))};
}
const present=(r:JobRow)=>({jobId:r.id,recordId:r.record_id,status:r.status,result:r.result?JSON.parse(r.result):null,error:r.error});
async function expire(userId:string){await adminDb().prepare("UPDATE ai_grading_jobs SET status='unknown',error='上次请求状态未知，请核对用量后再决定是否重试。',updated_at=? WHERE owner_id=? AND status='pending' AND created_at<?").bind(new Date().toISOString(),userId,new Date(Date.now()-300000).toISOString()).run();}
export async function GET(request:Request){try{
 const user=principal(request),q=new URL(request.url).searchParams;await expire(user.id);
 if(q.get('jobId')){const r=await adminDb().prepare("SELECT * FROM ai_grading_jobs WHERE id=? AND owner_id=? AND kind='oral-audio'").bind(q.get('jobId'),user.id).first<JobRow>();if(!r)throw new AccessError('分析记录不存在。',404);const t=await target(r.record_id,user);return reply({...present(r),current:r.source_hash===t.sourceHash});}
 if(q.get('recordId')){const t=await target(q.get('recordId')!,user),r=await adminDb().prepare("SELECT * FROM ai_grading_jobs WHERE owner_id=? AND record_id=? AND source_hash=? AND kind='oral-audio' ORDER BY created_at DESC,id DESC LIMIT 1").bind(user.id,t.record.id,t.sourceHash).first<JobRow>();return reply(r?{...present(r),current:true}:{status:'none',result:null});}
 try{const p=await configured();return reply({enabled:true,providerName:p.name,host:p.host,model:p.model,consentToken:p.consentToken});}catch{return reply({enabled:false,message:'原音分析尚未配置；录音保存、播放和文字批改继续可用。'});}
 }catch(e){return fail(e,'原音状态读取失败。');}}
export async function POST(request:Request){let jobId='',owner='',created=false;try{
 const user=principal(request);owner=user.id;sameOrigin(request);const b=JSON.parse(await readLimitedText(request,4096));
 if(!b||Object.keys(b).some(k=>!['recordId','expectedRevision','requestId','consent','consentToken'].includes(k))||typeof b.recordId!=='string'||typeof b.requestId!=='string'||!/^[-\w]{10,100}$/.test(b.requestId)||!Number.isSafeInteger(b.expectedRevision)||b.consent!==true||typeof b.consentToken!=='string')throw new AccessError('请确认发送录音，并保存当前作答。',400);
 const t=await target(b.recordId,user),db=adminDb();await expire(user.id);jobId='audio-grade-'+await textHash(user.id+'|'+b.requestId);
 const prior=await db.prepare('SELECT * FROM ai_grading_jobs WHERE id=? AND owner_id=?').bind(jobId,user.id).first<JobRow>();
 if(prior){if(prior.record_id!==t.record.id||prior.source_hash!==t.sourceHash||prior.kind!=='oral-audio')throw new AccessError('请求编号已用于其他录音版本。',409);return reply(present(prior),prior.status==='pending'?202:200);}
 if(t.record.revision!==b.expectedRevision)throw new AccessError('作答已更新，请刷新重试。',409);
 if(t.row.mime!=='audio/wav'||t.row.size>AUDIO_MAX_BYTES||!env.BUCKET)throw new AccessError('请上传5分钟、10 MB以内的16位PCM WAV。',415);
 const object=await env.BUCKET.get(t.row.object_key);if(!object)throw new AccessError('录音不存在。',404);if(object.size>AUDIO_MAX_BYTES||object.size!==t.row.size)throw new AccessError('录音大小无效。',415);
 const bytes=new Uint8Array(await object.arrayBuffer()),metrics=wavMetrics(bytes);if(metrics.nearSilent)throw new AccessError('录音近乎静音，请重新录制。',422);
 const provider=await configured();if(provider.consentToken!==b.consentToken)throw new AccessError('音频配置已变化，请刷新并重新同意。',409);const now=new Date().toISOString();
 try{const r=await db.prepare("INSERT INTO ai_grading_jobs(id,owner_id,record_id,question_id,source_hash,kind,status,provider_id,model,created_at,updated_at) SELECT ?,?,?, '',?,'oral-audio','pending',?,?,?,? WHERE (SELECT count(*) FROM ai_grading_jobs WHERE owner_id=? AND kind='oral-audio' AND created_at>=?)<20").bind(jobId,user.id,t.record.id,t.sourceHash,provider.id,provider.model,now,now,user.id,now.slice(0,10)).run();if(!r.meta.changes)throw Error();}
 catch{const r=await db.prepare('SELECT * FROM ai_grading_jobs WHERE id=? AND owner_id=?').bind(jobId,user.id).first<JobRow>();if(r){if(r.record_id!==t.record.id||r.source_hash!==t.sourceHash||r.kind!=='oral-audio')throw new AccessError('请求编号已用于其他录音版本。',409);return reply(present(r),r.status==='pending'?202:200);}throw new AccessError('已有批改进行中，或达到每天20次原音分析上限（UTC日）。',429);}
 created=true;
 // Audio pricing differs from text. Never apply text-only prices to mixed usage.
 const billing={...provider,pricing:{inputPriceMicros:null,cachedInputPriceMicros:null,outputPriceMicros:null}};
 await recordAIUsage(user,billing,{requestId:jobId,task:'oral-audio',status:'unknown',counts:{inputTokens:null,cachedInputTokens:null,outputTokens:null}});
 const out=await analyzeAudio(provider,bytes,metrics.durationSeconds,t.prompt,env.AI_MODEL_HOSTS,configuredAIFetch());await finalizeAIUsage(user,billing,{requestId:jobId,task:'oral-audio',status:out.status,counts:out.counts,elapsedMs:out.elapsedMs});
 if(out.error||!out.result){await db.prepare("UPDATE ai_grading_jobs SET status='failed',error=?,updated_at=? WHERE id=? AND owner_id=?").bind(out.error,new Date().toISOString(),jobId,user.id).run();return reply({jobId,status:'failed',error:out.error});}
 const result={feedback:out.result,metrics:{...metrics,...audioRate(out.result.transcript,metrics.durationSeconds,t.record.payload.item?.language||'')},audioId:t.audioId,sourceHash:t.sourceHash,provider:{name:provider.name,model:provider.model},usage:out.counts,analyzedAt:new Date().toISOString(),scope:'原音训练参考；转写与时间可能有误，不计入总分。'};
 await db.prepare("UPDATE ai_grading_jobs SET status='succeeded',result=?,updated_at=? WHERE id=? AND owner_id=?").bind(JSON.stringify(result),new Date().toISOString(),jobId,user.id).run();let current=false;try{current=(await target(t.record.id,user)).sourceHash===t.sourceHash;}catch{}return reply({jobId,status:'succeeded',result,current});
 }catch(e){if(created)try{await adminDb().prepare("UPDATE ai_grading_jobs SET status='failed',error='分析或记账未完成，请核对用量后再重试。',updated_at=? WHERE id=? AND owner_id=? AND status='pending'").bind(new Date().toISOString(),jobId,owner).run();}catch{}if(e instanceof SyntaxError)return reply({error:'请求格式不正确。'},400);return fail(e,'分析或记账未完成，请保留录音并核对用量。');}}
