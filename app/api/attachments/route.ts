import {principal,fail} from '../../../lib/user-access';
import {env} from "cloudflare:workers";
import {getDb} from "../../../db/index";
import {attachments} from "../../../db/schema";
import {getAttachment} from "../../../lib/study-store";

export const dynamic='force-dynamic';
const MAX=8*1024*1024;
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){
  try{const user=principal(request);const id=new URL(request.url).searchParams.get('id');if(!id)return reply({error:'缺少图片编号'},400);const {meta,object}=await getAttachment(id,user);return new Response(object.body,{headers:{'Content-Type':meta.mime,'Content-Length':String(meta.size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(meta.filename)}`}});}catch(error){return fail(error,'图片暂时无法读取。');}
}
export async function POST(request:Request){
  let user;try{user=principal(request);}catch(error){return fail(error);}
  const origin=request.headers.get('Origin'),url=new URL(request.url),host=request.headers.get('Host')||url.host;
  try{if(request.headers.get('Sec-Fetch-Site')==='cross-site'||(origin&&new URL(origin).host!==host&&new URL(origin).host!==url.host))return reply({error:'请从本站页面上传'},403);}catch{return reply({error:'无效的请求来源'},403);}
  if(!env.BUCKET)return reply({error:'图片存储暂未就绪，请保留原图稍后重试。'},503);
  const declared=Number(request.headers.get('Content-Length'));if(declared>MAX)return reply({error:'单张图片请控制在8 MB以内。'},413);
  try{
    const reader=request.body?.getReader();if(!reader)return reply({error:'没有图片内容'},400);
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX){await reader.cancel();return reply({error:'单张图片超过8 MB。'},413);}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const mime=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff?'image/jpeg':bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47?'image/png':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':null;
    if(!mime)return reply({error:'请上传JPEG、PNG或WebP图片。'},415);
    const id='asset-'+crypto.randomUUID(),objectKey='essays/'+id,now=new Date().toISOString();
    let filename='作文原稿';try{filename=decodeURIComponent(request.headers.get('X-File-Name')||filename).replace(/[\r\n\u0000]/g,'').slice(0,180);}catch{}
    await env.BUCKET.put(objectKey,bytes,{httpMetadata:{contentType:mime}});
    try{await getDb().insert(attachments).values({id,ownerId:user.id,objectKey,filename,mime,size,createdAt:now});}catch(error){await env.BUCKET.delete(objectKey);throw error;}
    return reply({id,filename,mime,size,createdAt:now,url:'/api/attachments?id='+id},201);
  }catch{return reply({error:'图片上传未完成，请重试；原图仍保留在你的设备中。'},503);}
}
