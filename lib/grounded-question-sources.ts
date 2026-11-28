import {storage} from "../db/store";
import {requireCommunity} from "./community-access";
import {publicationVisible,publicationViewer} from "./research-community";
import {scope,sourceSelection,digest,type ResearchSource,type ResearchScope} from "./research-assistant-contract";
import {groundParagraphs,type GroundSource,type QuestionEvidence} from "./grounded-question-contract";
import {AccessError} from "./user-access";
export function groundSelection(value:unknown){
 try{
  if(!value||typeof value!=="object"||Array.isArray(value))throw Error("材料选择无效。");
  const v=value as Record<string,unknown>,s=scope(v.scope),sources=sourceSelection(v.sources,s);
  if(sources.some(x=>x.kind==="reference"))throw Error("书目元数据不是原文，请先保存可合法使用的材料摘录。");
  return {scope:s,sources};
 }catch(e){throw new AccessError(e instanceof Error?e.message:"材料选择无效。",400);}
}
export async function loadGroundSources(request:Request,uid:string,selection:{scope:ResearchScope;sources:ResearchSource[]}){
 const access=selection.scope==="public"?await requireCommunity(request,uid):null;
 const db=storage(),result:GroundSource[]=[];
 for(const item of selection.sources){
  if(item.kind==="reference")throw new AccessError("书目不是全文。",400);
  type Row={title:string;content:string;version:string;language:string|null};
  const row=item.kind==="private"?await db.prepare("SELECT title,content,updated_at AS version,coalesce(source_language,language) AS language FROM entries WHERE user_id=? AND id=? AND folder='active'").bind(uid,item.id).first<Row>():await db.prepare("SELECT p.title,p.content,cast(p.revision AS text) AS version,coalesce(p.source_language,p.language) AS language FROM research_publications p WHERE p.id=? AND "+publicationVisible("p")).bind(item.id,...publicationViewer(uid)).first<Row>();
  if(!row)throw new AccessError("材料不存在、已撤回或不可访问。",404);
  if(row.version!==item.version)throw new AccessError("材料版本已变化，请重新检索和预览。",409);
  const data=groundParagraphs(row.content);
  if(!data.paragraphs.length)throw new AccessError("材料没有可用正文。",400);
  result.push({key:"S"+(result.length+1),kind:item.kind,id:item.id,title:row.title.slice(0,240),version:row.version,language:(row.language||"").slice(0,100),...data});
 }
 if(access){const current=await requireCommunity(request,uid);if(current.role!==access.role||current.member?.revision!==access.member?.revision)throw new AccessError("社区权限已变化。",409);}
 return result;
}
export const modelGroundSources=(sources:GroundSource[])=>sources.map(({id,kind,...safe})=>safe);
export async function verifySavedGroundEvidence(request:Request,uid:string,evidence:QuestionEvidence[]){
 for(const e of evidence){
  const source=(await loadGroundSources(request,uid,{scope:e.kind==="private"?"private":"public",sources:[{kind:e.kind,id:e.id,version:e.version}]}))[0];
  if(!source.paragraphs.find(p=>p.number===e.paragraph)?.text.includes(e.quote))throw new AccessError("材料依据已变化，请重新生成。",409);
 }
}
export const groundFingerprint=digest;
