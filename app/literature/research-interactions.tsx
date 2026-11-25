"use client";
import {useEffect,useState,useRef} from "react";
import {paragraphs,type TargetKind} from "../../lib/research-community";
const endpoint="/api/literature/interactions";
async function api<T>(query="",body?:unknown):Promise<T>{
 const response=await fetch(endpoint+query,{cache:"no-store",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const result=await response.json();
 if(!response.ok)throw Error((result as {error?:string}|null)?.error||"操作未完成。");
 return result as T;
}
const msg=(e:unknown)=>e instanceof Error?e.message:"操作未完成。";
const reasons=[["harassment","骚扰或攻击"],["privacy","泄露隐私或不当联系"],["spam","广告或垃圾信息"],["other","其他不当内容"]];
type Target={targetKind:TargetKind;targetId:string;revision:number};
type Reply={id:string;mine:boolean;body:string;authorAlias:string;createdAt:string};
type Thread={id:string;revision:number;paragraphIndex:number;quote:string;body:string;mine:boolean;authorAlias:string;replies:Reply[];createdAt:string};
type Report={id:string;targetKind:TargetKind;targetId:string;targetRevision:number;category:string;snapshot:string;status:string;createdAt:string};
type Block={id:string;label:string;createdAt:string};

export function SafetyActions({target,onChange}:{target:Target;onChange:()=>void}){
 const [reason,setReason]=useState(""),[reporting,setReporting]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 async function act(action:"report"|"block"){
  if(busy||action==="report"&&!reason)return;
  if(action==="block"&&!window.confirm("屏蔽该研究者？双方将不再看到彼此的社区内容或互动。"))return;
  setBusy(true);setNotice("");
  try{await api("",{action,...target,...(action==="report"?{category:reason}:{})});
   setReporting(false);setReason("");setNotice(action==="report"?"举报已提交，仅管理员可以处理。":"已屏蔽。");if(action==="block")onChange();
  }catch(e){setNotice(msg(e));}finally{setBusy(false);}
 }
 return <div className="community-safety"><div className="community-controls"><button type="button" className="text-button" disabled={busy} onClick={()=>setReporting(v=>!v)}>举报</button><button type="button" className="text-button" disabled={busy} onClick={()=>void act("block")}>屏蔽研究者</button></div>{reporting&&<div className="community-panel"><p>举报将把当前公开内容的有限摘录发送给管理员，请勿提交私人信息。</p><label>举报原因<select value={reason} onChange={e=>setReason(e.target.value)}><option value="">请选择</option>{reasons.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><button type="button" className="primary" disabled={busy||!reason} onClick={()=>void act("report")}>提交举报</button></div>}{notice&&<p role="status">{notice}</p>}</div>;
}
export function ResearchThreads({publication,onBlocked}:{publication:{id:string;revision:number;content?:string;mine:boolean};onBlocked:()=>void}){
 const {id,revision,mine}=publication;
 const [threads,setThreads]=useState<Thread[]>([]),[history,setHistory]=useState(false),[offset,setOffset]=useState(0),[next,setNext]=useState<number|null>(null),[index,setIndex]=useState<number|null>(null),[body,setBody]=useState(""),[replyTo,setReplyTo]=useState(""),[reply,setReply]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const serial=useRef(0),lock=useRef(false);
 async function load(h=history,o=offset){
  const ticket=++serial.current;setBusy(true);setError("");
  try{const result=await api<{threads:Thread[];nextOffset:number|null}>("?"+new URLSearchParams({publication:id,revision:String(revision),history:h?"1":"0",offset:String(o)}));if(ticket!==serial.current)return;setThreads(result.threads);setNext(result.nextOffset);setOffset(o);setHistory(h);}
  catch(e){if(ticket===serial.current){setThreads([]);setError(msg(e));}}finally{if(ticket===serial.current)setBusy(false);}
 }
 useEffect(()=>{void load(false,0);return()=>{serial.current++;};},[id,revision]);
 async function write(payload:Record<string,unknown>){
  if(lock.current)return;lock.current=true;setBusy(true);setError("");
  try{await api("",payload);setBody("");setReply("");setReplyTo("");setIndex(null);await load(history,0);}
  catch(e){setError(msg(e));}finally{lock.current=false;setBusy(false);}
 }
 const lines=paragraphs(publication.content||"");
 return <section className="research-threads">
  <h4>正文与段落批注 · 第 {revision} 版</h4><p className="muted">批注只针对当前公开版本。请围绕文本与证据讨论，不交换联系方式。旧版批注仅笔记作者可在历史中查看，撤回笔记会移除讨论。</p>
  {!mine&&<SafetyActions target={{targetKind:"publication",targetId:id,revision}} onChange={onBlocked}/>}
  {lines.map((p,i)=><div className="research-paragraph" key={i}><p className="community-body" dir="auto">{p}</p><button type="button" className="text-button" disabled={busy} onClick={()=>{setIndex(i);setHistory(false);setBody("");}}>批注第 {i+1} 段</button>{index===i&&<form className="community-panel" onSubmit={e=>{e.preventDefault();void write({action:"annotate",publicationId:id,revision,paragraphIndex:i,body});}}><label>对这一段的批注<textarea required maxLength={2000} rows={3} value={body} onChange={e=>setBody(e.target.value)}/></label><div className="community-controls"><button className="primary" disabled={busy||!body.trim()} type="submit">发表批注</button><button type="button" onClick={()=>setIndex(null)}>取消</button></div></form>}</div>)}
  {error&&<p className="form-error" role="alert">{error}</p>}
  <div className="community-controls"><h4>{history?"历史版本批注（仅本人可见）":"本版批注"}</h4><button type="button" className="text-button" disabled={busy} onClick={()=>void load(false,0)}>当前版本</button>{mine&&<button type="button" className="text-button" disabled={busy} onClick={()=>void load(true,0)}>旧版历史</button>}</div>
  {threads.map(t=><article className="community-panel" key={t.id}><p className="muted">{t.mine?"我的批注":t.authorAlias} · 第 {t.revision} 版 / 第 {t.paragraphIndex+1} 段</p><blockquote className="research-quote" dir="auto">{t.quote}</blockquote><p dir="auto" className="community-body">{t.body}</p>
   {!history&&!t.mine&&<SafetyActions target={{targetKind:"annotation",targetId:t.id,revision:t.revision}} onChange={()=>void load(false,0)}/>}
   {t.mine&&<button type="button" className="danger-link" disabled={busy} onClick={()=>window.confirm("删除这条批注及其回复？")&&void write({action:"deleteAnnotation",id:t.id})}>删除我的批注</button>}
   {t.replies.map(r=><div className="research-reply" key={r.id}><small>{r.authorAlias}</small><p className="community-body" dir="auto">{r.body}</p>{r.mine?<button type="button" className="danger-link" disabled={busy} onClick={()=>void write({action:"deleteReply",id:r.id})}>删除我的回复</button>:!history&&<SafetyActions target={{targetKind:"reply",targetId:r.id,revision:t.revision}} onChange={onBlocked}/>}</div>)}
   {mine&&!history&&<button type="button" className="text-button" disabled={busy} onClick={()=>{setReplyTo(t.id);setReply("");}}>以作者身份回复</button>}
   {mine&&!history&&replyTo===t.id&&<form onSubmit={e=>{e.preventDefault();void write({action:"reply",annotationId:t.id,revision:t.revision,body:reply});}}><label>作者回复<textarea required maxLength={2000} rows={3} value={reply} onChange={e=>setReply(e.target.value)}/></label><button className="primary" disabled={busy||!reply.trim()} type="submit">发送回复</button></form>}
  </article>)}
  {!threads.length&&!busy&&<p className="muted">暂无批注。</p>}
  <div className="community-controls"><button type="button" disabled={busy||offset===0} onClick={()=>void load(history,Math.max(0,offset-20))}>上一页</button><button type="button" disabled={busy||next===null} onClick={()=>next!==null&&void load(history,next)}>下一页</button></div>
 </section>;
}
export function CommunityManagement({onChange}:{onChange:()=>void}){
 const [admin,setAdmin]=useState(false),[blocks,setBlocks]=useState<Block[]>([]),[reports,setReports]=useState<Report[]>([]),[status,setStatus]=useState("pending"),[offset,setOffset]=useState(0),[next,setNext]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 useEffect(()=>{let active=true;void api<{admin:boolean}>("?capabilities=1").then(x=>{if(active)setAdmin(x.admin);}).catch(()=>{});return()=>{active=false;};},[]);
 async function loadBlocks(){try{setBlocks((await api<{blocks:Block[]}>("?blocks=1")).blocks);}catch(e){setError(msg(e));}}
 async function loadReports(s=status,o=offset){
  setBusy(true);setError("");
  try{const data=await api<{reports:Report[];nextOffset:number|null}>("?"+new URLSearchParams({admin:"1",status:s,offset:String(o)}));setReports(data.reports);setNext(data.nextOffset);setStatus(s);setOffset(o);}
  catch(e){setError(msg(e));}finally{setBusy(false);}
 }
 async function act(payload:Record<string,unknown>){
  if(busy)return;setBusy(true);setError("");
  try{await api("",payload);if(payload.action==="unblock")await loadBlocks();else await loadReports(status,offset);onChange();}
  catch(e){setError(msg(e));}finally{setBusy(false);}
 }
 return <details className="community-panel"><summary>社区安全与管理</summary><p className="muted">举报、屏蔽与审核仅限站内学习内容。不提供私聊或联系信息。</p>
  <button className="text-button" type="button" onClick={()=>void loadBlocks()}>查看我的屏蔽列表</button>{blocks.map(b=><div className="community-controls" key={b.id}><span>{b.label}</span><button type="button" disabled={busy} onClick={()=>void act({action:"unblock",id:b.id})}>解除屏蔽</button></div>)}
  {admin&&<section className="research-threads"><h4>管理员举报审核</h4><p className="muted">仅显示公开内容的限量摘录，不读取私人笔记。隐藏会阻止其他用户访问内容；恢复须由管理员操作。</p><div className="community-controls"><button type="button" disabled={busy} onClick={()=>void loadReports("pending",0)}>待处理</button><button type="button" disabled={busy} onClick={()=>void loadReports("handled",0)}>处理记录</button></div>{reports.map(r=><article className="community-panel" key={r.id}><small>{r.targetKind} · {reasons.find(x=>x[0]===r.category)?.[1]||r.category} · {r.status} · 版本 {r.targetRevision}</small><p dir="auto" className="community-body">{r.snapshot}</p><div className="community-controls">{r.status==="pending"&&<><button type="button" disabled={busy} onClick={()=>window.confirm("确认隐藏该内容？")&&void act({action:"moderate",id:r.id,decision:"hide"})}>隐藏内容</button><button type="button" disabled={busy} onClick={()=>void act({action:"moderate",id:r.id,decision:"dismiss"})}>关闭举报</button></>}{r.status==="hidden"&&<button type="button" disabled={busy} onClick={()=>window.confirm("确认恢复公开显示？")&&void act({action:"moderate",id:r.id,decision:"restore"})}>恢复显示</button>}</div></article>)}<div className="community-controls"><button type="button" disabled={busy||offset===0} onClick={()=>void loadReports(status,Math.max(0,offset-20))}>上一页</button><button type="button" disabled={busy||next===null} onClick={()=>next!==null&&void loadReports(status,next)}>下一页</button></div></section>}
  {error&&<p className="form-error" role="alert">{error}</p>}
 </details>;
}
