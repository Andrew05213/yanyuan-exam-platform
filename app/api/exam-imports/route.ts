import {env} from "cloudflare:workers";
import {storage} from "../../../db/store";
import {principal,sameOrigin,AccessError,fail,privateHeaders,readLimitedText} from "../../../lib/user-access";
import {field,origin,fileType,groups,units} from "../../../lib/exam-import";
export const dynamic="force-dynamic";
type Row={id:string;owner_id:string;sha256:string;filename:string;mime:string;size:number;object_key:string;source:string;source_url:string;rights:string;payload:string;revision:number;created_at:string;updated_at:string};
type Db=ReturnType<typeof storage>;
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:privateHeaders});
function checked<T>(fn:()=>T):T{try{return fn();}catch(e){throw new AccessError(e instanceof Error?e.message:"格式无效。",400);}}
async function own(db:Db,uid:string,id:string){if(!/^exam-[a-f0-9-]{36}$/.test(id))throw new AccessError("文件不存在。",404);const r=await db.prepare("SELECT * FROM private_exam_imports WHERE owner_id=? AND id=?").bind(uid,id).first<Row>();if(!r)throw new AccessError("文件不存在。",404);return r;}
function present(r:Row,detail=false){const p=JSON.parse(r.payload);return {id:r.id,filename:r.filename,mime:r.mime,size:r.size,sha256:r.sha256,source:r.source,sourceUrl:r.source_url,rights:r.rights,revision:r.revision,updatedAt:r.updated_at,approved:p.approved,questionCount:p.groups.reduce((n:number,g:any)=>n+g.questions.length,0),...(detail?{groups:p.groups}: {})};}
async function bytes(req:Request){const max=8*1024*1024;if(Number(req.headers.get("Content-Length"))>max)throw new AccessError("每份文件最多8MB。",413);const reader=req.body?.getReader();if(!reader)throw new AccessError("文件为空。",400);const parts:Uint8Array[]=[];let n=0;try{while(true){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>max){await reader.cancel();throw new AccessError("每份文件最多8MB。",413);}parts.push(value);}}finally{reader.releaseLock();}const b=new Uint8Array(n);let off=0;for(const p of parts){b.set(p,off);off+=p.length;}return b;}
export async function GET(req:Request){try{const {id}=principal(req),db=storage(),p=new URL(req.url).searchParams,record=p.get("id");
 if(record){const r=await own(db,id,record);if(p.get("mode")==="download"){const object=await env.BUCKET?.get(r.object_key);if(!object)throw new AccessError("原文件暂不可用。",404);return new Response(object.body,{headers:{...privateHeaders,"Content-Type":r.mime,"Content-Length":String(r.size),"Content-Disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(r.filename),"Content-Security-Policy":"sandbox; default-src 'none'"}});}return reply({file:present(r,true)});}
 const rows=(await db.prepare("SELECT * FROM private_exam_imports WHERE owner_id=? ORDER BY updated_at DESC,id LIMIT 30").bind(id).all<Row>()).results;
 if(p.get("mode")==="catalog")return reply({items:rows.flatMap(units)});
 return reply({files:rows.map(r=>present(r)),limit:30});
}catch(e){return fail(e,"私人试卷库暂不可用。");}}
export async function POST(req:Request){try{const {id}=principal(req);sameOrigin(req);const db=storage(),mode=new URL(req.url).searchParams.get("mode");
 if(mode==="upload"){
  if(!env.BUCKET)throw new AccessError("原文件存储未配置。",503);
  const meta=checked(()=>JSON.parse(decodeURIComponent(req.headers.get("X-Exam-Metadata")??""))),name=checked(()=>field(meta.filename,180)),src=checked(()=>origin(meta)),b=await bytes(req),mime=checked(()=>fileType(name,b));
  const sha=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",b))).map(x=>x.toString(16).padStart(2,"0")).join("");
  const existing=await db.prepare("SELECT id FROM private_exam_imports WHERE owner_id=? AND sha256=?").bind(id,sha).first();if(existing)throw new AccessError("原文件已存在，请从试卷库打开。",409);
  const key="exam-"+crypto.randomUUID(),objectKey="private-exam/"+key,now=new Date().toISOString();await env.BUCKET.put(objectKey,b,{httpMetadata:{contentType:mime}});
  try{const r=await db.prepare("INSERT INTO private_exam_imports(id,owner_id,sha256,filename,mime,size,object_key,source,source_url,rights,payload,revision,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,1,?,? WHERE (SELECT count(*) FROM private_exam_imports WHERE owner_id=?)<30 ON CONFLICT(owner_id,sha256) DO NOTHING").bind(key,id,sha,name,mime,b.length,objectKey,src.source,src.sourceUrl,src.rights,JSON.stringify({approved:false,groups:[]}),now,now,id).run();if(!r.meta.changes)throw new AccessError("文件重复或达到30份上限。",409);}catch(e){await env.BUCKET.delete(objectKey);throw e;}
  return reply({ok:true,id:key,revision:1},201);
 }
 const body=JSON.parse(await readLimitedText(req,650000));if(!body||typeof body!=="object")throw new AccessError("请求无效。",400);
 const r=await own(db,id,body.id);if(body.revision!==r.revision)throw new AccessError("试卷版本已变化，请刷新。",409);
 if(body.action==="delete"){const q=await db.prepare("DELETE FROM private_exam_imports WHERE id=? AND owner_id=? AND revision=?").bind(r.id,id,r.revision).run();if(!q.meta.changes)throw new AccessError("试卷版本已变化。",409);await env.BUCKET?.delete(r.object_key);return reply({ok:true});}
 if(body.action!=="save")throw new AccessError("操作无效。",400);
 const src=checked(()=>origin(body)),approved=body.approved===true;
 // Drafts may retain unclassified text/questions (bounded) but never enter the catalog.
 const gs=approved?checked(()=>groups(body.groups,src)):body.groups;if(!Array.isArray(gs)||gs.length>10||gs.some((g:any)=>!g||!Array.isArray(g.questions)||g.questions.length>50))throw new AccessError("题组格式无效。",400);
 if(approved&&(!gs.length||body.reviewConfirmed!==true))throw new AccessError("请逐题核对原卷、答案、位置及难度后确认。",400);
 const payload=JSON.stringify({approved,groups:gs});if(new TextEncoder().encode(payload).length>600000)throw new AccessError("题组内容超过600KB。",413);
 const q=await db.prepare("UPDATE private_exam_imports SET source=?,source_url=?,rights=?,payload=?,revision=revision+1,updated_at=? WHERE id=? AND owner_id=? AND revision=?").bind(src.source,src.sourceUrl,src.rights,payload,new Date().toISOString(),r.id,id,r.revision).run();if(!q.meta.changes)throw new AccessError("试卷版本已变化。",409);return reply({ok:true,id:r.id,revision:r.revision+1});
}catch(e){return fail(e instanceof SyntaxError?new AccessError("请求格式无效。",400):e,"导入未完成，请保留原件重试。");}}
