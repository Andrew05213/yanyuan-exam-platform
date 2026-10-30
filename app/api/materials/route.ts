import {and,desc,eq,sql} from 'drizzle-orm';
import {getDb} from '../../../db/index';
import {communityMaterials,materialFiles} from '../../../db/schema';
import {principal,sameOrigin,AccessError,fail,privateHeaders} from '../../../lib/user-access';
import {validateMaterial,publicMaterial,materialUnits} from '../../../lib/material-contracts';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders});
export async function GET(request:Request){try{
 const params=new URL(request.url).searchParams,mine=params.get('mine')==='1',id=params.get('id'),db=getDb(),user=mine?principal(request):null;
 if(id){const r=await db.select().from(communityMaterials).where(and(eq(communityMaterials.id,id),mine?eq(communityMaterials.ownerId,user!.id):eq(communityMaterials.active,1))).get();if(!r)return reply({error:'资料不存在。'},404);return reply({material:publicMaterial(r)});}
 const rows=await db.select().from(communityMaterials).where(mine?eq(communityMaterials.ownerId,user!.id):eq(communityMaterials.active,1)).orderBy(desc(communityMaterials.updatedAt)).limit(200);
 return reply({materials:rows.map(r=>({...publicMaterial(r),questions:undefined,text:undefined,questionCount:JSON.parse(r.payload).questions.length})),...(params.get('catalog')==='1'?{items:rows.flatMap(materialUnits)}:{}),limit:200});
 }catch(error){return fail(error,'共享资料暂时无法读取。');}}
export async function POST(request:Request){try{
 const user=principal(request);sameOrigin(request);const raw=await request.text();if(raw.length>750000)throw new AccessError('单份资料请控制在750KB文字以内。',413);const body=JSON.parse(raw),db=getDb(),id=body.id||'material-'+crypto.randomUUID();if(!/^material-[a-f0-9-]{36}$/.test(id))throw new AccessError('资料编号无效。',400);
 const existing=await db.select().from(communityMaterials).where(eq(communityMaterials.id,id)).get();if(existing&&existing.ownerId!==user.id)throw new AccessError('资料不存在。',404);
 if(existing&&body.expectedRevision!==existing.revision)throw new AccessError('资料已在另一处更新，请重新打开。',409);
 if(body.action==='withdraw'){if(!existing)throw new AccessError('资料不存在。',404);const r=await db.update(communityMaterials).set({active:0,updatedAt:new Date().toISOString(),revision:existing.revision+1}).where(and(eq(communityMaterials.id,id),eq(communityMaterials.ownerId,user.id),eq(communityMaterials.revision,existing.revision))).returning().get();if(!r)throw new AccessError('版本已变化，请刷新。',409);return reply({material:publicMaterial(r)});}
 let input;try{input=validateMaterial(body);}catch(error){throw new AccessError((error as Error).message,400);}
 const files=[];for(const fileId of input.payload.fileIds){const f=await db.select().from(materialFiles).where(and(eq(materialFiles.id,fileId),eq(materialFiles.ownerId,user.id))).get();if(!f||(f.materialId&&f.materialId!==id))throw new AccessError('附件不属于当前用户，或已关联另一份资料。',400);files.push(f);}
 if(!existing){const today=new Date().toISOString().slice(0,10);const count=await db.select({count:sql<number>`count(*)`}).from(communityMaterials).where(and(eq(communityMaterials.ownerId,user.id),sql`${communityMaterials.createdAt} >= ${today}`)).get();if((count?.count||0)>=20)throw new AccessError('今天已发布20份资料，请稍后继续。',429);}
 const now=new Date().toISOString(),{payload,...meta}=input;
 const r=existing?await db.update(communityMaterials).set({...meta,payload:JSON.stringify(payload),active:1,revision:existing.revision+1,updatedAt:now}).where(and(eq(communityMaterials.id,id),eq(communityMaterials.ownerId,user.id),eq(communityMaterials.revision,existing.revision))).returning().get():await db.insert(communityMaterials).values({id,ownerId:user.id,...meta,payload:JSON.stringify(payload),active:1,createdAt:now,updatedAt:now,revision:1}).returning().get();
 if(!r)throw new AccessError('资料版本已变化，请刷新后重试。',409);
 for(const f of files)await db.update(materialFiles).set({materialId:id}).where(and(eq(materialFiles.id,f.id),eq(materialFiles.ownerId,user.id)));
 return reply({material:publicMaterial(r)},existing?200:201);
 }catch(error){return fail(error,'发布未完成，请保留原稿后重试。');}}
