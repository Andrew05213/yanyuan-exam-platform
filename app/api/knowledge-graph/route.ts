import {storage} from "../../../db/store";
import {principal,AccessError,privateHeaders,sameOrigin,readLimitedText,fail} from "../../../lib/user-access";
import {works} from "../../literature/data";
import {mergeMaterials,type MaterialRow} from "../../literature/materials";
import {buildLearningReport} from "../../../lib/learning-report";
import {blank,graph,pageGraph,mutate,type Input,type State} from "../../../lib/knowledge-graph/core.mjs";
export const dynamic="force-dynamic";
type Db=ReturnType<typeof storage>;
const reply=(data:unknown)=>Response.json(data,{headers:privateHeaders});
const row=(db:Db,uid:string)=>db.prepare("SELECT version,payload FROM private_knowledge_graphs WHERE user_id=?").bind(uid).first<{version:string;payload:string}>();
const safe=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const hash=async (s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,"0")).join("");
async function sources(db:Db,uid:string){
 // Load every override/deletion of a built-in resource so truncation never resurrects one.
 const [builtins,custom,notes,projects,records]=await Promise.all([
  db.prepare("SELECT id,data,deleted FROM materials WHERE user_id=? AND id IN (SELECT value FROM json_each(?))").bind(uid,JSON.stringify(works.map(w=>w.id))).all<MaterialRow>(),
  db.prepare("SELECT id,data,deleted FROM materials WHERE user_id=? AND deleted=0 AND id NOT IN (SELECT value FROM json_each(?)) ORDER BY id LIMIT 201").bind(uid,JSON.stringify(works.map(w=>w.id))).all<MaterialRow>(),
  db.prepare("SELECT id,title,work_id AS workId,tags,discipline,revision FROM entries WHERE user_id=? AND folder='active' ORDER BY updated_at DESC,id LIMIT 501").bind(uid).all<Input["notes"][number]>(),
  db.prepare("SELECT id,payload,revision FROM research_projects WHERE owner_id=? AND status='active' ORDER BY updated_at DESC,id LIMIT 201").bind(uid).all<{id:string;payload:string;revision:number}>(),
  db.prepare("SELECT id,length(cast(payload AS blob)) AS size FROM archive_records WHERE owner_id=? AND kind IN ('error-set','written-attempt') ORDER BY updated_at DESC,id LIMIT 2001").bind(uid).all<{id:string;size:number}>(),
 ]);
 const resources=await Promise.all(mergeMaterials([...builtins.results,...custom.results.slice(0,200)]).map(async r=>({id:r.id,title:r.title,author:r.author,era:r.era,theme:r.theme,version:await hash(JSON.stringify([r.title,r.author,r.era,r.theme,r.source]))})));
 const safeNotes=notes.results.slice(0,500).filter(n=>safe(n.id));
 const inputProjects:Input["projects"]=[];
 for(const r of projects.results.slice(0,200)){
  const p=JSON.parse(r.payload);if(!safe(r.id)||typeof p.title!=="string")continue;
  inputProjects.push({id:r.id,title:p.title,revision:r.revision,noteIds:(Array.isArray(p.links)?p.links:[]).filter((l:any)=>l?.ownerId===uid&&safe(l.noteId)).map((l:any)=>l.noteId).slice(0,100)});
 }
 let bytes=0;const ids:string[]=[];for(const r of records.results.slice(0,2000)){if(bytes+r.size>8000000)break;ids.push(r.id);bytes+=r.size;}
 const rows:{id:string;kind:string;updatedAt:string;createdAt:string;payload:any}[]=[];
 for(let i=0;i<ids.length;i+=50){
  const r=await db.prepare("SELECT id,kind,updated_at AS updatedAt,created_at AS createdAt,payload FROM archive_records WHERE owner_id=? AND id IN (SELECT value FROM json_each(?)) AND kind IN ('error-set','written-attempt')").bind(uid,JSON.stringify(ids.slice(i,i+50))).all<{id:string;kind:string;updatedAt:string;createdAt:string;payload:string}>();
  rows.push(...r.results.map(v=>({...v,payload:JSON.parse(v.payload)})));
 }
 const report=buildLearningReport(rows);
 const input:Input={resources,notes:safeNotes,projects:inputProjects,weaknesses:report.tags};
 return {input,limits:{notes:notes.results.length>500,projects:projects.results.length>200,resources:custom.results.length>200,wrongRecords:records.results.length>2000||ids.length<Math.min(2000,records.results.length),wrongTags:report.tags.length>=30}};
}
function error(e:unknown){
 if(e instanceof AccessError)return fail(e);
 const code=e instanceof Error?e.message:"";
 if(code==="invalid_input"||e instanceof SyntaxError)return fail(new AccessError("请检查图谱字段。",400));
 if(code==="not_found")return fail(new AccessError("节点或关系不可用。",404));
 if(code==="duplicate"||code==="limit")return fail(new AccessError(code==="duplicate"?"关系已存在。":"已达私人图谱容量上限。",409));
 return fail(e,"图谱暂不可用，请重试。");
}
export async function GET(request:Request){
 try{
  const {id}=principal(request),db=storage(),p=new URL(request.url).searchParams;
  const [saved,source]=await Promise.all([row(db,id),sources(db,id)]);
  const state:State=saved?JSON.parse(saved.payload):blank();
  const data=pageGraph(graph(source.input,state),{q:p.get("q")??"",kind:p.get("kind")??"",focus:p.get("focus")??"",relation:p.get("relation")??"",offset:Number(p.get("offset")??0),edgeOffset:Number(p.get("edgeOffset")??0),suggestionOffset:Number(p.get("suggestionOffset")??0)});
  return reply({...data,version:saved?.version??null,limits:source.limits});
 }catch(e){return error(e);}
}
export async function POST(request:Request){
 try{
  const {id}=principal(request);sameOrigin(request);const b=JSON.parse(await readLimitedText(request,24000)),db=storage();
  if(!b||typeof b!=="object"||(b.version!==null&&(typeof b.version!=="string"||b.version.length>64)))throw new AccessError("缺少有效版本。",400);
  const saved=await row(db,id);if((saved?.version??null)!==b.version)throw new AccessError("图谱已在其他位置修改，请重新加载。",409);
  const state:State=saved?JSON.parse(saved.payload):blank(),source=await sources(db,id);
  const next=mutate(state,graph(source.input,state),b,crypto.randomUUID(),new Date().toISOString()),payload=JSON.stringify(next);
  if(new TextEncoder().encode(payload).length>750000)throw new AccessError("图谱存储达到上限。",409);
  const version=crypto.randomUUID(),stamp=new Date().toISOString();
  const stmt=saved?db.prepare("UPDATE private_knowledge_graphs SET payload=?,version=?,updated_at=? WHERE user_id=? AND version=?").bind(payload,version,stamp,id,b.version):db.prepare("INSERT INTO private_knowledge_graphs(user_id,version,payload,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO NOTHING").bind(id,version,payload,stamp);
  if(!(await stmt.run()).meta.changes)throw new AccessError("图谱已在其他位置修改，请重新加载。",409);
  return reply({ok:true,version});
 }catch(e){return error(e);}
}
