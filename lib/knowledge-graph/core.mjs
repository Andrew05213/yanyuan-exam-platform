export const types=["resource","author","era","topic","note","project","weakness","concept"];
export const relations=["related_to","supports","contrasts","cites","defines"];
export const derivedRelations=["authored_by","classified_in","has_theme","note_on","tagged_with","project_note","observed_wrong_tag"];
export const blank=()=>({concepts:[],links:[],dismissed:[]});
const reject=(code)=>{throw new Error(code)};
const str=(v,max,required=true)=>{if(typeof v!=="string"||v.length>max||(required&&!v.trim()))reject("invalid_input");return v.trim()};
const label=v=>typeof v==="string"?v.normalize("NFC").trim().replace(/\s+/gu," ").slice(0,200):"";
export const key=(kind,...parts)=>kind+":"+JSON.stringify(parts);
const pair=(a,b)=>[a,b].sort();
const compare=(a,b)=>a.localeCompare(b,"zh-CN")|| (a<b?-1:a>b?1:0);
const validKey=v=>typeof v==="string"&&v.length>0&&v.length<=1600;
export function graph(input,state){
 const nodes=new Map(),edges=new Map(),groups=new Map();
 function add(kind,parts,title,version,source,detail="",href=""){
  title=label(title);if(!title)return null;
  const id=key(kind,...parts);if(!validKey(id))return null;
  if(!nodes.has(id))nodes.set(id,{id,kind,title,version:String(version??""),source,detail:String(detail??"").slice(0,600),href});
  return id;
 }
 function edge(from,to,relation,source){
  if(!from||!to||from===to||!nodes.has(from)||!nodes.has(to))return;
  const id=key("derived",from,to,relation);edges.set(id,{id,from,to,relation,source,manual:false,stale:false,note:""});
 }
 function topic(title,member,relation){
  const t=label(title);if(!t)return;
  const id=add("topic",[t],t,"","资料主题或笔记标签");
  edge(member,id,relation,"明确元数据字段");
  if(!groups.has(id))groups.set(id,new Set());groups.get(id).add(member);
 }
 for(const r of input.resources){
  const id=add("resource",[r.id],r.title,r.version,"文学与研究资料",r.author+" · "+r.era,"/literature");
  const a=label(r.author),e=label(r.era);
  if(a)edge(id,add("author",[a],a,"","资料原始署名（未进行同名消歧）"),"authored_by","资料署名字段");
  if(e)edge(id,add("era",[e],e,"","资料时代分类"),"classified_in","资料时代字段");
  topic(r.theme,id,"has_theme");
 }
 for(const n of input.notes){
  const id=add("note",[n.id],n.title,n.revision,"本人有效笔记",n.discipline||"","/reading-notes#note/"+encodeURIComponent(n.id));
  if(n.workId)edge(id,key("resource",n.workId),"note_on","笔记所关联资料");
  for(const tag of [...new Set(String(n.tags??"").split(/[,，、;；\n]+/u).map(label).filter(Boolean))].slice(0,12))topic(tag,id,"tagged_with");
 }
 for(const p of input.projects){
  const id=add("project",[p.id],p.title,p.revision,"本人有效研究项目","","#projects");
  for(const n of p.noteIds)edge(id,key("note",n),"project_note","本人项目中的私人笔记关联");
 }
 for(const w of input.weaknesses){
  const subject=label(w.subject),tag=label(w.tag);if(!tag||!subject||!Number.isSafeInteger(w.uniqueWrong)||w.uniqueWrong<1)continue;
  const id=add("weakness",[subject,tag],subject+" · "+tag,w.uniqueWrong+":"+w.lastSeen,"真实已保存错题统计",w.uniqueWrong+" 道不同历史错题；不等于当前掌握度","#mistakes");
  const t=add("topic",[tag],tag,"","知识点标签");
  edge(id,t,"observed_wrong_tag","已保存学习报告中的实际错题知识点");
 }
 for(const c of state.concepts)add("concept",[c.id],c.title,c.revision,"本人手工概念",c.description);
 const visibleLinks=[],inactive=[];
 for(const l of state.links){
  const a=nodes.get(l.from),b=nodes.get(l.to);
  if(!a||!b){inactive.push({id:l.id,relation:l.relation});continue;}
  visibleLinks.push({...l,manual:true,source:l.suggestion?"人工确认同标签建议":"本人研究判断",stale:l.fromVersion!==a.version||l.toVersion!==b.version});
 }
 const existingPairs=new Set([...edges.values(),...visibleLinks].map(l=>key("pair",...pair(l.from,l.to))));
 const suggestions=[],dismissed=[];
 const seen=new Set();
 for(const [topicId,items] of [...groups.entries()].sort((a,b)=>compare(a[0],b[0]))){
  const ns=[...items].filter(id=>nodes.has(id)).sort(compare).slice(0,12);
  for(let i=0;i<ns.length;i++)for(let j=i+1;j<ns.length;j++){
   const [from,to]=pair(ns[i],ns[j]),id=key("suggestion",from,to);
   if(seen.has(id)||existingPairs.has(key("pair",from,to)))continue;
   seen.add(id);const s={id,from,to,topicId,reason:"共同明确标签："+nodes.get(topicId).title};
   (state.dismissed.includes(id)?dismissed:suggestions).push(s);
   if(suggestions.length+dismissed.length>=240)break;
  }
  if(suggestions.length+dismissed.length>=240)break;
 }
 return {nodes:[...nodes.values()].sort((a,b)=>compare(a.title,b.title)||compare(a.id,b.id)),edges:[...edges.values(),...visibleLinks],suggestions:suggestions.slice(0,240),dismissed:dismissed.slice(0,240),inactive,limitedSuggestions:suggestions.length+dismissed.length>=240||[...groups.values()].some(g=>g.size>12)};
}
export function pageGraph(g,{q="",kind="",offset=0,focus="",relation="",edgeOffset=0,suggestionOffset=0}={}){
 const term=str(q,200,false).normalize("NFC").toLowerCase();
 if(kind&&!types.includes(kind)||relation&&![...relations,...derivedRelations].includes(relation)||![offset,edgeOffset,suggestionOffset].every(v=>Number.isInteger(v)&&v>=0&&v<=50000)||!validKey(focus||"none"))reject("invalid_input");
 const matches=g.nodes.filter(n=>(!kind||kind===n.kind)&&(!term||(n.title+" "+n.detail).normalize("NFC").toLowerCase().includes(term)));
 const map=new Map(g.nodes.map(n=>[n.id,n])),node=focus?map.get(focus):null;
 if(focus&&!node)reject("not_found");
 const linked=node?g.edges.filter(e=>(e.from===node.id||e.to===node.id)&&(!relation||e.relation===relation)):[];
 const list=linked.slice(edgeOffset,edgeOffset+16),neighbors=[...new Set(list.map(e=>e.from===focus?e.to:e.from))].map(id=>map.get(id));
 const enrich=s=>({...s,fromTitle:map.get(s.from)?.title,toTitle:map.get(s.to)?.title});
 return {nodes:matches.slice(offset,offset+40),total:matches.length,nodeCount:g.nodes.length,edgeCount:g.edges.length,nextOffset:offset+40<matches.length?offset+40:null,focus:node?{node,edges:list,neighbors,total:linked.length,nextOffset:edgeOffset+16<linked.length?edgeOffset+16:null}:null,suggestions:g.suggestions.slice(suggestionOffset,suggestionOffset+12).map(enrich),dismissed:g.dismissed.slice(suggestionOffset,suggestionOffset+12).map(enrich),suggestionTotal:g.suggestions.length,dismissedTotal:g.dismissed.length,nextSuggestionOffset:suggestionOffset+12<Math.max(g.suggestions.length,g.dismissed.length)?suggestionOffset+12:null,inactive:g.inactive,limitedSuggestions:g.limitedSuggestions};
}
export function mutate(state,g,b,newId,now){
 if(!b||typeof b!=="object")reject("invalid_input");
 const next=JSON.parse(JSON.stringify(state)),map=new Map(g.nodes.map(n=>[n.id,n]));
 const node=id=>{if(!validKey(id)||!map.has(id))reject("not_found");return map.get(id)};
 const find=(arr,id)=>{const i=arr.findIndex(x=>x.id===id);if(i<0)reject("not_found");return i};
 const action=b.action;
 if(action==="concept-create"){
  if(next.concepts.length>=200)reject("limit");
  next.concepts.push({id:newId,title:str(b.title,200),description:str(b.description??"",1000,false),revision:1,createdAt:now,updatedAt:now});
 }else if(action==="concept-update"||action==="concept-delete"){
  const i=find(next.concepts,b.id),c=next.concepts[i];
  if(action==="concept-delete"){next.concepts.splice(i,1);const k=key("concept",c.id);next.links=next.links.filter(l=>l.from!==k&&l.to!==k);}
  else next.concepts[i]={...c,title:str(b.title,200),description:str(b.description??"",1000,false),revision:c.revision+1,updatedAt:now};
 }else if(action==="link-delete"){
  next.links.splice(find(next.links,b.id),1);
 }else if(action==="link-create"||action==="link-update"||action==="suggestion-confirm"){
  const i=action==="link-update"?find(next.links,b.id):-1,old=i<0?null:next.links[i];
  let from=b.from,to=b.to,relation=b.relation,note=b.note??"",suggestion=false;
  if(action==="suggestion-confirm"){
   const s=g.suggestions.find(s=>s.id===b.id);
   if(!s){if(next.links.some(l=>l.suggestionId===b.id))return next;reject("not_found");}
   from=s.from;to=s.to;relation="related_to";note=s.reason;suggestion=true;
  }
  if(!relations.includes(relation)||from===to)reject("invalid_input");
  if(relation==="related_to")[from,to]=pair(from,to);
  const a=node(from),z=node(to),description=str(note,1000,relation==="cites");
  if(next.links.some((l,j)=>j!==i&&l.from===from&&l.to===to&&l.relation===relation))reject("duplicate");
  if(i<0&&next.links.length>=400)reject("limit");
  const value={id:old?.id??newId,from,to,relation,note:description,fromVersion:a.version,toVersion:z.version,createdAt:old?.createdAt??now,updatedAt:now,suggestion:old?.suggestion??suggestion,suggestionId:old?.suggestionId??(suggestion?b.id:null)};
  if(i<0)next.links.push(value);else next.links[i]=value;
 }else if(action==="suggestion-dismiss"||action==="suggestion-restore"){
  if(action==="suggestion-dismiss"){
   if(!g.suggestions.some(s=>s.id===b.id))reject("not_found");
   if(next.dismissed.length>=400)reject("limit");if(!next.dismissed.includes(b.id))next.dismissed.push(b.id);
  }else{const i=next.dismissed.indexOf(b.id);if(i<0)reject("not_found");next.dismissed.splice(i,1);}
 }else reject("invalid_input");
 return next;
}
