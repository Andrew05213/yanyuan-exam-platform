import {env} from 'cloudflare:workers';
import {and,eq,sql} from 'drizzle-orm';
import {getDb} from '../../../db/index';
import {communityMaterials,materialFiles} from '../../../db/schema';
import {principal,sameOrigin,AccessError,fail,privateHeaders} from '../../../lib/user-access';
export const dynamic='force-dynamic';const MAX=8*1024*1024;
export async function GET(request:Request){try{
 const id=new URL(request.url).searchParams.get('id')||'',db=getDb();const f=await db.select().from(materialFiles).where(eq(materialFiles.id,id)).get();if(!f||!env.BUCKET)throw new AccessError('文件不存在。',404);
 const m=f.materialId?await db.select({id:communityMaterials.id,payload:communityMaterials.payload}).from(communityMaterials).where(and(eq(communityMaterials.id,f.materialId),eq(communityMaterials.active,1))).get():null;
 let publicFile=!!m&&JSON.parse(m.payload).fileIds.includes(f.id);if(!publicFile){let user;try{user=principal(request);}catch{throw new AccessError('文件不存在。',404);}if(user.id!==f.ownerId)throw new AccessError('文件不存在。',404);}
 const object=await env.BUCKET.get(f.objectKey);if(!object)throw new AccessError('文件不存在。',404);return new Response(object.body,{headers:{...privateHeaders,'Content-Type':f.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`,'Content-Security-Policy':"sandbox; default-src 'none'"}});
 }catch(error){return fail(error,'文件暂时无法读取。');}}
export async function POST(request:Request){try{
 const user=principal(request);sameOrigin(request);if(!env.BUCKET)throw Error();if(Number(request.headers.get('Content-Length'))>MAX)throw new AccessError('单个附件最多8MB。',413);
 const reader=request.body?.getReader();if(!reader)throw new AccessError('没有文件内容。',400);const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX){await reader.cancel();throw new AccessError('单个附件最多8MB。',413);}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const b of chunks){bytes.set(b,offset);offset+=b.length;}
 let filename;try{filename=decodeURIComponent(request.headers.get('X-File-Name')||'资料').replace(/[\r\n\0]/g,'').slice(0,180);}catch{throw new AccessError('文件名无效。',400);}const ext=filename.split('.').pop()?.toLowerCase();let mime='';const head=String.fromCharCode(...bytes.slice(0,5));
 if(ext==='pdf'&&head==='%PDF-')mime='application/pdf';else if(ext==='docx'&&bytes[0]===80&&bytes[1]===75)mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';else if(['jpg','jpeg'].includes(ext||'')&&bytes[0]===255&&bytes[1]===216)mime='image/jpeg';else if(ext==='png'&&bytes[0]===137&&bytes[1]===80)mime='image/png';else if(ext==='txt'){try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);mime='text/plain;charset=utf-8';}catch{}}
 if(!mime)throw new AccessError('请上传PDF、DOCX、JPG、PNG或UTF-8 TXT。',415);
 const db=getDb(),today=new Date().toISOString().slice(0,10);const n=await db.select({n:sql<number>`count(*)`}).from(materialFiles).where(and(eq(materialFiles.ownerId,user.id),sql`${materialFiles.createdAt} >= ${today}`)).get();if((n?.n||0)>=30)throw new AccessError('今天已上传30个附件，请稍后继续。',429);
 const id='material-file-'+crypto.randomUUID(),objectKey='community/'+id;await env.BUCKET.put(objectKey,bytes,{httpMetadata:{contentType:mime}});try{await db.insert(materialFiles).values({id,ownerId:user.id,objectKey,filename,mime,size,createdAt:new Date().toISOString()});}catch(e){await env.BUCKET.delete(objectKey);throw e;}return Response.json({id,filename,size,mime},{status:201,headers:privateHeaders});
 }catch(error){return fail(error,'附件上传未完成，请重试。');}}
