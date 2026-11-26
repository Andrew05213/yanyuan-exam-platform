import {and,desc,eq,lt,or,sql} from 'drizzle-orm';
import {getDb} from '../../../db/index';
import {qualityFeedback,adminAccessLog,archiveRecords,communityMaterials} from '../../../db/schema';
import {principal,sameOrigin,readLimitedText,AccessError,fail,privateHeaders,owned} from '../../../lib/user-access';
import {adminPrincipal as requireAdmin} from '../../../lib/admin-access';
import {communityAccess} from '../../../lib/community-access';
import {sharedMaterialVisible} from '../../../lib/shared-material-access';
import bank from '../../../public/bank.json';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 const url=new URL(request.url),admin=url.searchParams.get('admin')==='1',user=admin?requireAdmin(request):principal(request),db=getDb();
 const time=url.searchParams.get('beforeTime'),id=url.searchParams.get('beforeId'),status=url.searchParams.get('status');
 if((!!time!==!!id)||(time&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(time))||(id&&!/^feedback-[a-f0-9]{64}$/.test(id))||(status&&!['open','resolved','declined'].includes(status)))throw new AccessError('筛选或分页参数无效。',400);
 const rows=await db.select().from(qualityFeedback).where(and(admin?undefined:eq(qualityFeedback.ownerId,user.id),status?eq(qualityFeedback.status,status):undefined,time&&id?or(lt(qualityFeedback.updatedAt,time),and(eq(qualityFeedback.updatedAt,time),lt(qualityFeedback.id,id))):undefined)).orderBy(desc(qualityFeedback.updatedAt),desc(qualityFeedback.id)).limit(51);
 if(admin)await db.insert(adminAccessLog).values({id:crypto.randomUUID(),actorId:user.id,action:'feedback-list',targetId:null,createdAt:new Date().toISOString()});
 const records=rows.slice(0,50).map(r=>({...r,payload:JSON.parse(r.payload)})),last=records.at(-1);
 return Response.json({records,next:rows.length>50&&last?{time:last.updatedAt,id:last.id}:null},{headers:privateHeaders});
}catch(e){return fail(e,'反馈暂时无法读取。');}}
export async function POST(request:Request){try{
 const user=principal(request);sameOrigin(request);const b=JSON.parse(await readLimitedText(request,16000)),db=getDb();
 if(!b||typeof b!=='object'||Array.isArray(b))throw new AccessError('反馈格式无效。',400);
 if(b.action==='handle'){
  requireAdmin(request);if(typeof b.id!=='string'||!/^feedback-[a-f0-9]{64}$/.test(b.id)||!['open','resolved','declined'].includes(b.status)||typeof b.note!=='string'||!b.note.trim()||b.note.length>2000||typeof b.expectedUpdatedAt!=='string')throw new AccessError('请填写处理说明并保留反馈版本。',400);
  // Stale admin tabs cannot overwrite each other.
  const now=new Date(Math.max(Date.now(),(Date.parse(b.expectedUpdatedAt)||0)+1)).toISOString();
  const [updated]=await db.batch([
   db.update(qualityFeedback).set({status:b.status,adminNote:b.note.trim(),handledBy:user.id,updatedAt:now}).where(and(eq(qualityFeedback.id,b.id),eq(qualityFeedback.updatedAt,b.expectedUpdatedAt))).returning(),
   db.insert(adminAccessLog).values({id:crypto.randomUUID(),actorId:user.id,action:'feedback-handle-attempt-'+b.status,targetId:b.id,createdAt:now})
  ]);
  if(!updated.length)throw new AccessError('反馈已更新或不存在，请刷新后重试。',409);
  return Response.json({saved:true},{headers:privateHeaders});
 }
 if(!['paper','question'].includes(b.kind)||!['base','record','material'].includes(b.source)||typeof b.sourceId!=='string'||b.sourceId.length>90||typeof b.comment!=='string'||b.comment.length>3000)throw new AccessError('反馈格式不完整。',400);
 let packet:any,version:string,attemptId:string|null=null;
 if(b.source==='base'){
  const paper=[...bank.papers,...(bank.archivedPapers||[])].find(p=>p.id===b.sourceId);if(!paper)throw new AccessError('试卷不存在。',404);
  packet={title:paper.title,blocks:paper.sections.flatMap((s:any)=>s.blocks)};version=paper.version;
 }else if(b.source==='material'){
  if(b.kind!=='question')throw new AccessError('共享资料请逐题反馈。',400);
  const owner=eq(communityMaterials.ownerId,user.id);
  const access=await communityAccess(request,user.id);
  const visible=access.read?or(owner,and(eq(communityMaterials.active,1),sharedMaterialVisible(user.id))):owner;
  const m=await db.select().from(communityMaterials).where(and(eq(communityMaterials.id,b.sourceId),visible)).get();if(!m)throw new AccessError('资料不存在。',404);
  packet={title:m.title,blocks:[{questions:JSON.parse(m.payload).questions}]};version=String(m.revision);
 }else{
  const r=await db.select().from(archiveRecords).where(and(eq(archiveRecords.id,b.sourceId),owned(archiveRecords.ownerId,user))).get();if(!r||!['packet','written-attempt','oral-attempt'].includes(r.kind))throw new AccessError('练习不存在。',404);
  const p=JSON.parse(r.payload);packet=r.kind==='packet'?p:p.packet||{title:r.title,items:[p.item]};version=String(packet.sourceVersion||packet.version||packet.createdAt||r.createdAt);if(r.kind!=='packet')attemptId=r.id;
 }
 const categories=['answer','analysis','difficulty','format','wording','other'];let question=null;
 if(b.kind==='question'){
  question=(packet.blocks||[]).flatMap((x:any)=>x.questions||[]).find((q:any)=>String(q.id)===String(b.questionId));
  if(!question||!categories.includes(b.category)||!b.comment.trim())throw new AccessError('请选择实际题目、问题类型并说明原因。',400);
 }else if(![1,2,3,4,5].includes(b.rating)||!['easy','suitable','hard'].includes(b.difficulty)||b.completed!==true)throw new AccessError('请完成练习后填写评分、难度感受并确认。',400);
 const targetKey=[b.source,b.sourceId,version,b.kind,question?.id||''].join('|');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(user.id+'|'+targetKey));const id='feedback-'+[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
 const payload={source:b.source,sourceId:b.sourceId,version,attemptId,category:question?b.category:null,questionId:question?.id||null,questionSnapshot:question,rating:question?null:b.rating,difficulty:question?null:b.difficulty,completed:!question,completionEvidence:attemptId?'saved-attempt':'user-confirmed',comment:b.comment.trim()};
 const now=new Date().toISOString();
 await db.insert(qualityFeedback).values({id,ownerId:user.id,targetKey,kind:b.kind,title:String(packet.title||'训练卷').slice(0,180),payload:JSON.stringify(payload),createdAt:now,updatedAt:now}).onConflictDoUpdate({target:qualityFeedback.id,set:{payload:JSON.stringify(payload),status:'open',adminNote:'',handledBy:null,updatedAt:now}});
 return Response.json({id,saved:true},{headers:privateHeaders});
}catch(e){if(e instanceof SyntaxError)return fail(new AccessError('反馈格式无效。',400));return fail(e,'反馈未保存，请保留内容后重试。');}}
