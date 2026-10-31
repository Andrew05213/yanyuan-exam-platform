import {env} from 'cloudflare:workers';
import {and,eq,sql} from 'drizzle-orm';
import {getDb} from '../../../db/index';
import {oralAudio} from '../../../db/schema';
import {principal,sameOrigin,AccessError,fail,privateHeaders} from '../../../lib/user-access';
export const dynamic='force-dynamic';
const MAX=20*1024*1024;
export async function GET(request:Request){try{
 const user=principal(request),id=new URL(request.url).searchParams.get('id')||'';
 if(!/^oral-audio-[a-f0-9-]{36}$/.test(id))throw new AccessError('录音不存在。',404);
 const row=await getDb().select().from(oralAudio).where(and(eq(oralAudio.id,id),eq(oralAudio.ownerId,user.id))).get();
 if(!row||!env.BUCKET)throw new AccessError('录音不存在。',404);
 const object=await env.BUCKET.get(row.objectKey);if(!object)throw new AccessError('录音不存在。',404);
 return new Response(object.body,{headers:{...privateHeaders,'Content-Type':row.mime,'Content-Length':String(row.size),'Content-Security-Policy':"sandbox; default-src 'none'",'Content-Disposition':'inline'}});
}catch(e){return fail(e,'录音读取失败。');}}
export async function POST(request:Request){try{
 const user=principal(request);sameOrigin(request);if(!env.BUCKET)throw Error('storage unavailable');
 if(Number(request.headers.get('Content-Length'))>MAX)throw new AccessError('录音最多20 MB。',413);
 const reader=request.body?.getReader();if(!reader)throw new AccessError('请先选择录音。',400);
 const chunks:Uint8Array[]=[];let length=0;while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX){await reader.cancel();throw new AccessError('录音最多20 MB。',413);}chunks.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const ascii=(start:number,n:number)=>String.fromCharCode(...bytes.slice(start,start+n));
 const mime=bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3?'audio/webm':ascii(0,4)==='OggS'?'audio/ogg':ascii(0,4)==='RIFF'&&ascii(8,4)==='WAVE'?'audio/wav':ascii(4,4)==='ftyp'?'audio/mp4':ascii(0,3)==='ID3'||(bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0)?'audio/mpeg':null;
 if(!mime)throw new AccessError('请上传 WebM、M4A、MP3、WAV 或 Ogg 录音。',415);
 const db=getDb(),today=new Date().toISOString().slice(0,10),count=await db.select({n:sql<number>`count(*)`}).from(oralAudio).where(and(eq(oralAudio.ownerId,user.id),sql`${oralAudio.createdAt} >= ${today}`)).get();
 if((count?.n||0)>=30)throw new AccessError('今天已上传30段录音，请稍后继续。',429);
 const id='oral-audio-'+crypto.randomUUID(),objectKey='oral/'+id,createdAt=new Date().toISOString();
 await env.BUCKET.put(objectKey,bytes,{httpMetadata:{contentType:mime}});
 try{await db.insert(oralAudio).values({id,ownerId:user.id,objectKey,mime,size:length,createdAt});}catch(e){await env.BUCKET.delete(objectKey);throw e;}
 return Response.json({id,mime,size:length,createdAt},{status:201,headers:privateHeaders});
}catch(e){return fail(e,'录音上传失败，请保留原文件后重试。');}}
