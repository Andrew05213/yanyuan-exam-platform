export const kinds=["article","book","chapter","thesis","report","web"];
export const statuses=["unread","reading","read"];
export const blank=()=>({items:[]});
const fail=code=>{throw Error(code)};
const text=(v,max,required=false)=>{if(typeof v!=="string"||v.length>max||(required&&!v.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v))fail("invalid_input");return v.normalize("NFC").trim()};
export const doiOf=v=>{let d=text(v??"",250).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,"").replace(/^doi:\s*/i,"").trim().toLowerCase();if(d&&!/^10\.\d{4,9}\/[^\s<>"{}\\]+$/u.test(d))fail("invalid_input");return d};
export function urlOf(v){const s=text(v??"",2000);if(!s)return "";let u;try{u=new URL(s)}catch{fail("invalid_input")}if(!["https:","http:"].includes(u.protocol)||u.username||u.password)fail("invalid_input");return u.href}
const list=(v,max=20,length=200)=>{if(!Array.isArray(v)||v.length>max)fail("invalid_input");return [...new Set(v.map(x=>text(x,length,true)))]};
const ids=v=>{const result=list(v,30,100);if(result.some(x=>!(/^[A-Za-z0-9_-]{1,100}$/.test(x))))fail("invalid_input");return result};
export function metadata(b){
 if(!b||typeof b!=="object"||!kinds.includes(b.kind)||!statuses.includes(b.status))fail("invalid_input");
 const year=text(b.year??"",4);if(year&&!/^[1-9][0-9]{3}$/.test(year))fail("invalid_input");
 return {kind:b.kind,title:text(b.title,400,true),authors:list(b.authors??[],30,160),year,venue:text(b.venue??"",250),volume:text(b.volume??"",50),issue:text(b.issue??"",50),pages:text(b.pages??"",60),publisher:text(b.publisher??"",250),doi:doiOf(b.doi),url:urlOf(b.url),language:text(b.language??"",40),tags:list(b.tags??[],20,80),status:b.status,annotation:text(b.annotation??"",4000),noteIds:ids(b.noteIds??[]),projectIds:ids(b.projectIds??[])};
}
const norm=s=>s.normalize("NFC").trim().toLowerCase().replace(/\s+/gu," ");
function duplicate(items,m,ignore){
 return items.some(r=>r.id!==ignore&&((m.doi&&r.doi===m.doi)||(m.url&&r.url===m.url)||(norm(r.title)===norm(m.title)&&norm(r.authors.join(";"))===norm(m.authors.join(";"))&&r.year===m.year)));
}
export function mutate(state,b,context,newId,now){
 if(!b||typeof b!=="object")fail("invalid_input");
 const next=JSON.parse(JSON.stringify(state)),find=id=>{const i=next.items.findIndex(x=>x.id===id);if(i<0)fail("not_found");return i};
 if(b.action==="delete"){next.items.splice(find(b.id),1);return next}
 if(!["create","update","collect"].includes(b.action))fail("invalid_input");
 const index=b.action==="update"?find(b.id):-1,old=index>=0?next.items[index]:null;
 if(index<0&&next.items.length>=300)fail("limit");
 let m,origin,rawCitation,catalogKey;
 if(b.action==="collect"){
  const c=context.catalog.find(x=>x.id===b.catalogId);if(!c)fail("not_found");
  if(next.items.some(x=>x.catalogKey===c.id||x.url&&x.url===c.url))fail("duplicate");
  m=metadata({kind:"article",title:c.rawCitation,authors:[],year:"",url:c.url,status:"unread",tags:[],noteIds:[],projectIds:[]});origin="catalog";rawCitation=c.rawCitation;catalogKey=c.id;
 }else{
  m=metadata(b);origin="manual";rawCitation=old?.rawCitation??"";catalogKey=old?.catalogKey??null;
  if(old?.origin==="catalog"&&m.title===old.rawCitation)origin="catalog";
 }
 if(m.noteIds.some(id=>!context.notes.some(n=>n.id===id))||m.projectIds.some(id=>!context.projects.some(p=>p.id===id)))fail("not_found");
 if(duplicate(next.items,m,old?.id))fail("duplicate");
 const item={...m,id:old?.id??newId,origin,rawCitation,catalogKey,revision:(old?.revision??0)+1,createdAt:old?.createdAt??now,updatedAt:now};
 if(index<0)next.items.push(item);else next.items[index]=item;
 return next;
}
export function query(state,context,{q="",kind="",status="",tag="",offset=0,mode="library",id=""}={}){
 const term=norm(text(q,200));if(!Number.isSafeInteger(offset)||offset<0||offset>10000||kind&&!kinds.includes(kind)||status&&!statuses.includes(status)||!["library","catalog"].includes(mode))fail("invalid_input");text(tag,80);
 const tags=[...new Set(state.items.flatMap(r=>r.tags))].sort();
 const matches=mode==="catalog"?context.catalog.filter(c=>!term||norm(c.rawCitation+" "+c.url).includes(term)).map(c=>({...c,collected:state.items.some(r=>r.catalogKey===c.id||r.url===c.url)})):state.items.filter(r=>(!kind||r.kind===kind)&&(!status||r.status===status)&&(!tag||r.tags.includes(tag))&&(!term||norm([r.title,...r.authors,r.year,r.venue,r.doi,r.url,...r.tags,r.rawCitation].join(" ")).includes(term))).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));
 const expose=r=>({...r,noteIds:r.noteIds.filter(id=>context.notes.some(n=>n.id===id)),projectIds:r.projectIds.filter(id=>context.projects.some(p=>p.id===id)),missingLinks:r.noteIds.filter(id=>!context.notes.some(n=>n.id===id)).length+r.projectIds.filter(id=>!context.projects.some(p=>p.id===id)).length});
 const item=id?state.items.find(r=>r.id===id):null;if(id&&!item)fail("not_found");
 return {items:matches.slice(offset,offset+30).map(r=>mode==="catalog"?r:expose(r)),total:matches.length,nextOffset:offset+30<matches.length?offset+30:null,tags,notes:context.notes,projects:context.projects,item:item?expose(item):null,counts:Object.fromEntries(statuses.map(s=>[s,state.items.filter(r=>r.status===s).length]))};
}
const flat=s=>String(s??"").replace(/[\r\n\t]+/g," ").trim();
const bib=s=>flat(s).replace(/[\\{}%&#_$^~]/g,c=>({"\\":"\\textbackslash ","^":"\\textasciicircum ","~":"\\textasciitilde "}[c]||"\\"+c));
export function citation(r,format){
 if(r.origin==="catalog"){if(format==="source")return r.rawCitation+" · "+r.url;fail("needs_metadata")}
 const link=r.doi?"https://doi.org/"+r.doi:r.url;
 if(format==="source")return [r.authors.join("；"),r.title,r.venue||r.publisher,r.year,link].filter(Boolean).join(" · ");
 if(format==="gbt"){const mark={article:"J",book:"M",chapter:"M",thesis:"D",report:"R",web:"EB/OL"}[r.kind];return [r.authors.join(", "),r.title+"["+mark+"]",[r.venue||r.publisher,r.year,r.volume+(r.issue?"("+r.issue+")":""),r.pages].filter(Boolean).join(", "),link].filter(Boolean).join(". ")+ "."}
 if(format==="apa"){return [r.authors.join("; "),r.year?"("+r.year+").":"(n.d.).",r.title+".",[r.venue||r.publisher,r.volume+(r.issue?"("+r.issue+")":""),r.pages].filter(Boolean).join(", "),link].filter(Boolean).join(" ")}
 if(format==="bibtex"){const t={article:"article",book:"book",chapter:"incollection",thesis:"phdthesis",report:"techreport",web:"misc"}[r.kind];const f={title:r.title,author:r.authors.join(" and "),year:r.year,[r.kind==="article"?"journal":r.kind==="chapter"?"booktitle":"publisher"]:r.venue||r.publisher,volume:r.volume,number:r.issue,pages:r.pages,doi:r.doi,url:r.url};return "@"+t+"{ref"+r.id.replace(/[^a-z0-9]/gi,"")+",\n"+Object.entries(f).filter(([,v])=>v).map(([k,v])=>"  "+k+" = {"+bib(v)+"}").join(",\n")+"\n}"}
 if(format==="ris"){const t={article:"JOUR",book:"BOOK",chapter:"CHAP",thesis:"THES",report:"RPRT",web:"ELEC"}[r.kind];return ["TY  - "+t,"TI  - "+flat(r.title),...r.authors.map(a=>"AU  - "+flat(a)),...Object.entries({PY:r.year,JO:r.venue,PB:r.publisher,VL:r.volume,IS:r.issue,SP:r.pages,DO:r.doi,UR:r.url}).filter(([,v])=>v).map(([k,v])=>k+"  - "+flat(v)),"ER  - "].join("\n")}
 fail("invalid_input");
}
