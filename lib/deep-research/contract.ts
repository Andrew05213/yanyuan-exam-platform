import {clean,task,terms,type ResearchTask,type ResearchResult,type Evidence} from "../research-assistant-contract";
export type Selection={kind:"private"|"reference";id:string;version:string};
export type Decision={index:number;status:"accepted"|"revise"|"rejected";note:string};
export type Run={title:string;question:string;language:string;task:ResearchTask;plan:string;projectId:string;selection:Selection[];analysis:null|{result:ResearchResult;sourceDigest:string;sources:Omit<Evidence,"text">[];model:string;host:string;at:string;reviews:Decision[]}};
export const safeId=(v:unknown):v is string=>typeof v==="string"&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
export function selection(v:unknown):Selection[]{
 if(!Array.isArray(v)||v.length>4)throw Error("请选择最多四份材料。");
 const seen=new Set<string>();
 return v.map(x=>{if(!x||!["private","reference"].includes(x.kind)||!safeId(x.id)||Object.keys(x).some(k=>!["kind","id","version"].includes(k)))throw Error("材料格式无效。");const version=clean(x.version,80),k=x.kind+":"+x.id;if(!/^[a-f0-9]{64}$/.test(version)||seen.has(k))throw Error("材料版本无效或重复。");seen.add(k);return {kind:x.kind,id:x.id,version};});
}
export function draft(b:any):Run{
 const projectId=b.projectId??"";if(projectId!==""&&!safeId(projectId))throw Error("项目编号无效。");
 return {title:clean(b.title,200),question:clean(b.question,1000),language:clean(b.language,80),task:task(b.task),plan:clean(b.plan??"",4000,false),projectId,selection:selection(b.selection??[]),analysis:null};
}
export function review(r:Run,b:any):Run{
 if(!r.analysis||!Array.isArray(b.reviews)||b.reviews.length>r.analysis.result.findings.length)throw Error("审核内容无效。");
 const seen=new Set<number>();const reviews:Decision[]=b.reviews.map((v:any)=>{if(!v||!Number.isInteger(v.index)||v.index<0||v.index>=r.analysis!.result.findings.length||seen.has(v.index)||!["accepted","revise","rejected"].includes(v.status))throw Error("审核内容无效。");seen.add(v.index);return {index:v.index,status:v.status,note:clean(v.note??"",1000,false)};});
 return {...r,analysis:{...r.analysis,reviews}};
}
export const keywords=terms;
