import {storage} from "../../../db/store";
import {principal,AccessError,privateHeaders,sameOrigin,readLimitedText,fail} from "../../../lib/user-access";
import {readLibrary,referenceContext} from "../../../lib/references/store";
import {mutate,query,citation} from "../../../lib/references/core.mjs";
export const dynamic="force-dynamic";
const reply=(value:unknown)=>Response.json(value,{headers:privateHeaders});
function error(e:unknown){if(e instanceof AccessError)return fail(e);const code=e instanceof Error?e.message:"";if(code==="not_found")return fail(new AccessError("文献或关联对象不可用。",404));if(code==="duplicate"||code==="limit"||code==="needs_metadata")return fail(new AccessError(code==="duplicate"?"可能存在重复文献，请先检索已有记录。":code==="needs_metadata"?"目录原始引文需要补充并核对结构化元数据后再导出。":"达到文献库容量上限。",409));if(code==="invalid_input"||e instanceof SyntaxError)return fail(new AccessError("请检查文献字段。",400));return fail(e,"文献库暂不可用。");}
export async function GET(request:Request){try{
 const {id}=principal(request),db=storage(),p=new URL(request.url).searchParams;
 const [saved,source]=await Promise.all([readLibrary(db,id),referenceContext(db,id)]);
 const fmt=p.get("format");if(fmt){
  const refId=p.get("id"),items=refId?saved.state.items.filter(r=>r.id===refId):saved.state.items;
  if(refId&&!items.length)throw new AccessError("文献不可用。",404);
  if(!["source","gbt","apa","bibtex","ris"].includes(fmt))throw new AccessError("格式不支持。",400);
  const included=items.filter(r=>fmt==="source"||r.origin!=="catalog");
  if(refId&&!included.length)throw new Error("needs_metadata");
  return reply({text:included.map(r=>citation(r,fmt)).join("\n\n"),included:included.length,skipped:items.length-included.length});
 }
 return reply({...query(saved.state,source.context,{q:p.get("q")??"",kind:p.get("kind")??"",status:p.get("status")??"",tag:p.get("tag")??"",offset:Number(p.get("offset")??0),mode:p.get("mode")??"library",id:p.get("id")??""}),version:saved.version,limits:source.limits});
}catch(e){return error(e);}}
export async function POST(request:Request){try{
 const {id}=principal(request);sameOrigin(request);const db=storage(),b=JSON.parse(await readLimitedText(request,32000));
 if(!b||typeof b!=="object"||(b.version!==null&&(typeof b.version!=="string"||b.version.length>64)))throw new AccessError("缺少有效版本。",400);
 const saved=await readLibrary(db,id);if(saved.version!==b.version)throw new AccessError("文献库已修改，请重新读取。",409);
 const source=await referenceContext(db,id),next=mutate(saved.state,b,source.context,crypto.randomUUID(),new Date().toISOString()),payload=JSON.stringify(next),version=crypto.randomUUID(),stamp=new Date().toISOString();
 if(new TextEncoder().encode(payload).length>750000)throw new AccessError("文献库容量达到上限。",409);
 const stmt=saved.version===null?db.prepare("INSERT INTO private_reference_libraries(user_id,version,payload,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO NOTHING").bind(id,version,payload,stamp):db.prepare("UPDATE private_reference_libraries SET version=?,payload=?,updated_at=? WHERE user_id=? AND version=?").bind(version,payload,stamp,id,saved.version);
 if(!(await stmt.run()).meta.changes)throw new AccessError("文献库已修改，请重新读取。",409);
 return reply({ok:true,version});
}catch(e){return error(e);}}
