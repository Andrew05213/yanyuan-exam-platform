"use client";
import {useEffect,useRef,useState} from "react";
import {SafetyActions} from "./research-interactions";
type Note={id:string;title:string;revision:number;mine:boolean;authorAlias:string;content?:string;language:string|null;discipline:string|null};
type Link={id:string;sourceId:string;targetId:string;sourceTitle:string;targetTitle:string;sourceRevision:number;targetRevision:number;sourceCurrent:number;targetCurrent:number;kind:string;mine:boolean;direction:string;stale:boolean};
type Reference={id:string;title:string;authors:string;year:string;identifier:string;mine:boolean};
const endpoint="/api/literature/network";
async function api<T>(query="",body?:unknown):Promise<T>{
 const r=await fetch(endpoint+query,{cache:"no-store",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const result=await r.json();
 if(!r.ok)throw Error((result as {error?:string}|null)?.error||"操作未完成。");
 return result as T;
}
const msg=(e:unknown)=>e instanceof Error?e.message:"操作未完成。";
export function TopicNetwork({topicId,notes}:{topicId:string;notes:Note[]}){
 const [selected,setSelected]=useState<string[]>([]),[comparison,setComparison]=useState<Note[]>([]),[refs,setRefs]=useState<Reference[]>([]),[offset,setOffset]=useState(0),[next,setNext]=useState<number|null>(null);
 const [query,setQuery]=useState(""),[submitted,setSubmitted]=useState(""),[title,setTitle]=useState(""),[authors,setAuthors]=useState(""),[year,setYear]=useState(""),[identifier,setIdentifier]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const serial=useRef(0),lock=useRef(false);
 const selection=selected.filter(id=>notes.some(n=>n.id===id));
 useEffect(()=>{setComparison([]);setSelected([]);},[notes]);
 async function load(o=0,q=submitted){
  const ticket=++serial.current;setBusy(true);setError("");setRefs([]);
  try{const data=await api<{references:Reference[];nextOffset:number|null}>("?"+new URLSearchParams({topic:topicId,q,offset:String(o)}));if(ticket!==serial.current)return;setRefs(data.references);setNext(data.nextOffset);setOffset(o);}
  catch(e){if(ticket===serial.current)setError(msg(e));}finally{if(ticket===serial.current)setBusy(false);}
 }
 useEffect(()=>{void load();return()=>{serial.current++;};},[topicId,notes]);
 async function compare(){
  if(selection.length<2||selection.length>3||lock.current)return;lock.current=true;setBusy(true);setError("");setComparison([]);
  try{const data=await api<{notes:Note[]}>("?"+new URLSearchParams({topic:topicId,compare:selection.join(",")}));setComparison(data.notes);}
  catch(e){setError(msg(e));}finally{lock.current=false;setBusy(false);}
 }
 async function write(body:Record<string,unknown>){
  if(lock.current)return;lock.current=true;setBusy(true);setError("");
  try{await api("",body);if(body.action==="addReference"){setTitle("");setAuthors("");setYear("");setIdentifier("");}await load(0);}
  catch(e){setError(msg(e));}finally{lock.current=false;setBusy(false);}
 }
 return <section className="research-threads"><details className="community-panel"><summary>多人观点并排对照</summary><p className="muted">从本页的公开笔记选择2至3篇，读取当前公开版本。不会生成AI结论或改写原稿。</p>{notes.map(n=><label className="community-consent" key={n.id}><input type="checkbox" checked={selection.includes(n.id)} disabled={busy||selection.length>=3&&!selection.includes(n.id)} onChange={e=>{setComparison([]);setSelected(old=>e.target.checked?[...old,n.id]:old.filter(x=>x!==n.id));}}/>{n.title} · 第 {n.revision} 版</label>)}<button type="button" className="primary" disabled={busy||selection.length<2} onClick={()=>void compare()}>比较 {selection.length} 篇笔记</button>
 {comparison.length>0&&<div className="research-comparison">{comparison.map(n=><article className="community-panel" key={n.id}><h4 dir="auto">{n.title}</h4><p className="muted">{n.mine?"我的笔记":n.authorAlias} · 第 {n.revision} 版 · {[n.language,n.discipline].filter(Boolean).join(" · ")}</p><div className="community-body research-compare-body" dir="auto">{n.content}</div></article>)}</div>}</details>
 <details className="community-panel"><summary>共享文献库</summary><p className="muted">仅登记题名、作者、年份和 DOI／ISBN 等来源标识。不上传全文；条目由用户提交，尚未经核验。</p><form className="community-controls" onSubmit={e=>{e.preventDefault();setSubmitted(query);void load(0,query);}}><label>搜索文献<input value={query} maxLength={100} onChange={e=>setQuery(e.target.value)}/></label><button type="submit" disabled={busy}>搜索</button></form>
 <form className="community-panel" onSubmit={e=>{e.preventDefault();void write({action:"addReference",topicId,title,authors,year,identifier});}}><h4>新增共享文献</h4><label>题名<input required maxLength={240} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>作者（文献作者，非站内用户）<input maxLength={240} value={authors} onChange={e=>setAuthors(e.target.value)}/></label><label>年份<input maxLength={32} value={year} onChange={e=>setYear(e.target.value)}/></label><label>DOI / ISBN / 来源信息<input maxLength={500} value={identifier} onChange={e=>setIdentifier(e.target.value)}/></label><p className="muted">确认有权分享书目信息，不填联系方式或私人资料。</p><button className="primary" type="submit" disabled={busy||!title.trim()}>添加至公共文献库</button></form>
 {refs.map(r=><article key={r.id} className="community-panel"><h4 dir="auto">{r.title}</h4><p dir="auto">{[r.authors,r.year].filter(Boolean).join(" · ")}</p><p className="community-body" dir="auto">{r.identifier}</p>{r.mine?<button type="button" className="danger-link" disabled={busy} onClick={()=>window.confirm("移除这条文献记录？")&&void write({action:"removeReference",id:r.id})}>移除我的文献</button>:<SafetyActions target={{targetKind:"reference",targetId:r.id,revision:0}} onChange={()=>{setComparison([]);void load(0);}}/>}</article>)}
 {!refs.length&&!busy&&<p>暂无文献记录。</p>}<div className="community-controls"><button type="button" disabled={busy||offset===0} onClick={()=>void load(Math.max(0,offset-20))}>上一页</button><button type="button" disabled={busy||next===null} onClick={()=>next!==null&&void load(next)}>下一页</button></div></details>
 {error&&<p className="form-error" role="alert">{error}</p>}
 </section>;
}
export function NoteNetwork({note,notes,onOpen,onDerive}:{note:Note;notes:Note[];onOpen:(id:string)=>void;onDerive:()=>void}){
 const [links,setLinks]=useState<Link[]>([]),[offset,setOffset]=useState(0),[next,setNext]=useState<number|null>(null),[other,setOther]=useState(""),[kind,setKind]=useState("citation"),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const serial=useRef(0),lock=useRef(false);
 const candidates=notes.filter(n=>n.id!==note.id&&(note.mine||n.mine));
 const selected=candidates.find(n=>n.id===other);
 async function load(o=0){
  const ticket=++serial.current;setBusy(true);setError("");setLinks([]);
  try{const data=await api<{links:Link[];nextOffset:number|null}>("?publication="+encodeURIComponent(note.id)+"&offset="+o);if(ticket!==serial.current)return;setLinks(data.links);setNext(data.nextOffset);setOffset(o);}
  catch(e){if(ticket===serial.current)setError(msg(e));}finally{if(ticket===serial.current)setBusy(false);}
 }
 useEffect(()=>{void load();return()=>{serial.current++;};},[note.id,note.revision]);
 async function write(body:Record<string,unknown>){
  if(lock.current)return;lock.current=true;setBusy(true);setError("");
  try{await api("",body);setOther("");await load(0);}
  catch(e){setError(msg(e));}finally{lock.current=false;setBusy(false);}
 }
 function link(){
  if(!selected)return;
  const source=note.mine?note:selected,target=note.mine?selected:note;
  void write({action:"link",sourceId:source.id,targetId:target.id,sourceRevision:source.revision,targetRevision:target.revision,kind});
 }
 return <details className="community-panel"><summary>引用、反向引用与衍生研究</summary><p className="muted">引用只记录公开笔记的编号与版本，不复制正文。版本更新时标记为旧版关系；撤回、屏蔽、隐藏的内容不再显示。</p>
 <button type="button" className="primary" disabled={busy} onClick={onDerive}>基于这篇笔记撰写独立研究</button><p className="muted">先在私人笔记编辑器完成自己的观点并主动发布，再在这里建立衍生关系。原作者的笔记不会被修改。</p>
 <label>{note.mine?"我的笔记引用本页另一篇笔记":"选择我的公开笔记，引用当前笔记"}<select value={other} onChange={e=>setOther(e.target.value)}><option value="">请选择</option>{candidates.map(n=><option key={n.id} value={n.id}>{n.title} · V{n.revision}</option>)}</select></label><label>关联类型<select value={kind} onChange={e=>setKind(e.target.value)}><option value="citation">学术引用</option><option value="derivative">衍生研究</option></select></label><button type="button" className="primary" disabled={busy||!selected} onClick={link}>建立公开关联</button>
 {links.map(l=><article key={l.id} className="community-panel"><p className="muted">{l.direction==="outgoing"?"引用／衍生来源":"被引用／衍生研究"} · {l.kind==="derivative"?"衍生":"引用"}{l.stale?" · 历史版本关联":""}</p><button type="button" className="text-button" onClick={()=>onOpen(l.direction==="outgoing"?l.targetId:l.sourceId)}>{l.direction==="outgoing"?l.targetTitle:l.sourceTitle}</button><small>关联时 V{l.sourceRevision} → V{l.targetRevision}；当前 V{l.sourceCurrent} → V{l.targetCurrent}</small>{l.mine&&<button type="button" className="danger-link" disabled={busy} onClick={()=>void write({action:"unlink",id:l.id})}>移除关联</button>}</article>)}
 {!links.length&&!busy&&<p className="muted">暂无关联记录。</p>}<div className="community-controls"><button type="button" disabled={busy||offset===0} onClick={()=>void load(Math.max(0,offset-20))}>上一页</button><button type="button" disabled={busy||next===null} onClick={()=>next!==null&&void load(next)}>下一页</button></div>{error&&<p role="alert" className="form-error">{error}</p>}</details>;
}
