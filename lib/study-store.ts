import {and,eq} from 'drizzle-orm';
import {getDb} from '../db/index';
import {archiveRecords,attachments} from '../db/schema';
import {env} from 'cloudflare:workers';
import {textHash,validateReview,validateStudyPayload} from './study-contracts';
import {type Principal,owned,AccessError} from './user-access';
export async function getRecord(id:string,user:Principal){
 if(!/^[a-zA-Z0-9_-]{1,90}$/.test(id))throw new AccessError('档案不存在。',404);
 const r=await getDb().select().from(archiveRecords).where(and(eq(archiveRecords.id,id),owned(archiveRecords.ownerId,user))).get();
 if(!r)throw new AccessError('档案不存在。',404);return {...r,payload:JSON.parse(r.payload)};
}
export async function checkPrivateReferences(kind:string,payload:any,user:Principal){
 if(kind==='essay'&&Array.isArray(payload.images))for(const image of payload.images){const r=await getDb().select({id:attachments.id}).from(attachments).where(and(eq(attachments.id,String(image?.id||'')),owned(attachments.ownerId,user))).get();if(!r)throw new AccessError('原稿图片不存在或不属于当前用户。',400);}
 if(kind==='review-attempt'&&payload.parentId)await getRecord(payload.parentId,user);
}
export async function updateRecord(record:any,payload:any,user:Principal){
 validateStudyPayload(record.kind,payload,record.payload);await checkPrivateReferences(record.kind,payload,user);
 const r=await getDb().update(archiveRecords).set({ownerId:user.id,payload:JSON.stringify(payload),revision:record.revision+1,updatedAt:new Date().toISOString()}).where(and(eq(archiveRecords.id,record.id),eq(archiveRecords.revision,record.revision),owned(archiveRecords.ownerId,user))).returning().get();
 if(!r)throw Error('档案刚在另一处更新，请重新读取后再写入。');return {id:r.id,revision:r.revision,updatedAt:r.updatedAt};
}
export async function getAttachment(id:string,user:Principal){
 if(!/^asset-[a-f0-9-]{36}$/.test(id))throw new AccessError('图片不存在。',404);
 const meta=await getDb().select().from(attachments).where(and(eq(attachments.id,id),owned(attachments.ownerId,user))).get();
 if(!meta||!env.BUCKET)throw new AccessError('图片不存在。',404);const object=await env.BUCKET.get(meta.objectKey);if(!object)throw new AccessError('图片不存在。',404);return {meta,object};
}
export async function saveTranscription(user:Principal,id:string,text:string,verification:string){
 const record=await getRecord(id,user);if(record.kind!=='essay')throw Error('请选择作文原稿。');if(typeof text!=='string'||!text.trim()||text.length>40000)throw Error('原稿文字不完整或过长。');
 const confirmed=verification==='checked-against-images'&&!text.includes('[辨认不清]');return updateRecord(record,{...record.payload,originalText:text,textConfirmed:confirmed,verification:confirmed?'对话中对照原图辨认':'等待核对',status:confirmed?'ready':'transcription-check',transcribedAt:new Date().toISOString()},user);
}
export async function saveEssayReview(user:Principal,id:string,sourceHash:string,review:any,reviewer='ChatGPT 当前对话'){
 const record=await getRecord(id,user);if(record.kind!=='essay')throw Error('请选择作文原稿。');const p=record.payload;if(!p.originalText?.trim())throw Error('请先识别原稿。');if(await textHash(p.originalText)!==sourceHash)throw Error('原稿已变化，请重新读取并对当前原稿批改。');if(!p.textConfirmed&&review.total!==null)throw Error('原稿尚未核对，只能保存部分评语，不得给出完整总分。');validateReview(review,p.originalText);
 const completed={...review,sourceHash,reviewedAt:new Date().toISOString(),reviewer};return updateRecord(record,{...p,firstReview:p.firstReview||completed,latestReview:completed,reviews:[...(p.reviews||[]),completed].slice(-30),status:'reviewed'},user);
}
