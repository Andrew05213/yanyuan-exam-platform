"use client";
import {useState,useEffect,useRef} from "react";
import type {Entry} from "./notes";
import {ResearchThreads,SafetyActions,CommunityManagement} from "./research-interactions";
import {TopicNetwork,NoteNetwork} from "./research-network";
import {ResearchAssistant} from "./research-assistant";
import {GovernanceGate} from "./governance";

type Topic={id:string;title:string;description:string;createdAt:string;noteCount?:number;mine?:boolean};
type Publication={id:string;topicId:string;title:string;content?:string;excerpt?:string;language:string|null;sourceLanguage:string|null;discipline:string|null;authorAlias:string;mine:boolean;entryId?:string;sourceUpdatedAt?:string;revision:number;updatedAt:string};
const endpoint="/api/literature/community";
async function request<T>(query="",body?:unknown):Promise<T>{
 const response=await fetch(endpoint+query,{cache:"no-store",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const result=await response.json();
 if(!response.ok)throw Error((result as {error?:string}|null)?.error||"操作未完成，请重试。");
 return result as T;
}
const message=(error:unknown)=>error instanceof Error?error.message:"操作未完成，请重试。";
function meta(n:{language?:string|null;sourceLanguage?:string|null;discipline?:string|null}){
 return [n.language,n.sourceLanguage&&"原文："+n.sourceLanguage,n.discipline].filter(Boolean).join(" · ")||"未分类";
}
type CommunityProps={entries:Entry[];createNote:(topic:Topic,source?:Publication)=>void;refreshNotes:()=>Promise<void>};
export function Community(props:CommunityProps){return <GovernanceGate><CommunityContent {...props}/></GovernanceGate>;}
function CommunityContent({entries,createNote,refreshNotes}:CommunityProps){
 const [topics,setTopics]=useState<Topic[]>([]),[topic,setTopic]=useState<Topic|null>(null),[publications,setPublications]=useState<Publication[]>([]),[detail,setDetail]=useState<Publication|null>(null);
 const [query,setQuery]=useState(""),[submittedQuery,setSubmittedQuery]=useState(""),[topicOffset,setTopicOffset]=useState(0),[topicNext,setTopicNext]=useState<number|null>(null),[noteOffset,setNoteOffset]=useState(0),[noteNext,setNoteNext]=useState<number|null>(null);
 const [title,setTitle]=useState(""),[description,setDescription]=useState(""),[creating,setCreating]=useState(false),[entryId,setEntryId]=useState(""),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const serial=useRef(0),lock=useRef(false);
 const eligible=entries.filter(n=>n.content.trim()&&n.updated_at);
 const selected=eligible.find(n=>n.id===entryId);
 // Reset consent when the previewed saved version changes.
 useEffect(()=>setConfirmed(false),[entryId,selected?.updated_at,topic?.id]);
 async function browse(offset=0,q=submittedQuery){
  const version=++serial.current;setBusy(true);setError("");setNotice("");setTopic(null);setDetail(null);setPublications([]);
  try{const data=await request<{topics:Topic[];nextOffset:number|null}>("?"+new URLSearchParams({q,offset:String(offset)}));
   if(serial.current!==version)return;setTopics(data.topics);setTopicOffset(offset);setTopicNext(data.nextOffset);
  }catch(e){if(serial.current===version)setError(message(e));}finally{if(serial.current===version)setBusy(false);}
 }
 async function openTopic(id:string,offset=0){
  const version=++serial.current;setBusy(true);setError("");setDetail(null);setPublications([]);
  try{const data=await request<{topic:Topic;publications:Publication[];nextOffset:number|null}>("?"+new URLSearchParams({topic:id,offset:String(offset)}));
   if(serial.current!==version)return;setTopic(data.topic);setPublications(data.publications);setNoteOffset(offset);setNoteNext(data.nextOffset);
  }catch(e){if(serial.current===version)setError(message(e));}finally{if(serial.current===version)setBusy(false);}
 }
 useEffect(()=>{void browse();return()=>{serial.current++;};},[]);
 async function openNote(id:string){
  const version=++serial.current;setBusy(true);setError("");setDetail(null);
  try{const data=await request<Publication>("?publication="+encodeURIComponent(id));if(serial.current===version)setDetail(data);}
  catch(e){if(serial.current===version)setError(message(e));}finally{if(serial.current===version)setBusy(false);}
 }
 async function createTopic(){
  if(lock.current)return;lock.current=true;setBusy(true);setError("");
  try{const data=await request<Topic>("",{action:"createTopic",title,description});setCreating(false);setTitle("");setDescription("");await openTopic(data.id);setNotice("议题已建立。每位用户可独立撰写自己的笔记。");}
  catch(e){setError(message(e));}finally{lock.current=false;setBusy(false);}
 }
 async function publish(){
  if(lock.current||!topic||!selected?.updated_at||!confirmed)return;
  lock.current=true;setBusy(true);setError("");
  try{await request<Publication>("",{action:"publish",topicId:topic.id,entryId:selected.id,sourceUpdatedAt:selected.updated_at,confirm:true});setConfirmed(false);setEntryId("");await openTopic(topic.id);setNotice("已公开当前保存版本。后续私人修改不会自动公开。");}
  catch(e){setError(message(e));}finally{lock.current=false;setBusy(false);}
 }
 async function withdraw(note:Publication){
  if(lock.current||!topic||!note.mine||!window.confirm("撤回公开版本？私人原笔记仍会保留。"))return;
  lock.current=true;setBusy(true);setError("");
  try{await request("",{action:"withdraw",id:note.id});setDetail(null);await openTopic(topic.id);setNotice("已撤回公开版本，私人笔记不受影响。");}
  catch(e){setError(message(e));}finally{lock.current=false;setBusy(false);}
 }
 return <section className="research-community">
  <div className="section-heading"><div><h2>研究议题与共享笔记</h2><p>围绕同一问题独立研究。仅登录用户可阅读共享内容，不自动公开私人笔记。</p></div><button type="button" className="primary" disabled={busy} onClick={()=>setCreating(v=>!v)}>{creating?"取消":"创建议题"}</button></div>
  <p className="community-privacy">请仅发布有权分享的学术内容，不要填写真实姓名、联系方式、个人档案或他人的私人信息。公开内容可能被其他用户复制；撤回不能收回已经复制的内容。</p>
  <div className="research-guide"><div className="research-guide-kicker">RESEARCH WORKSPACE</div><h3>研究工作台</h3><p>先选择或创建议题，再撰写私人笔记；主动发布后可批注、引用、比较观点并整理共享书目。AI 分析须逐次确认材料。</p><div className="community-controls"><a href="#research-ideas">浏览研究议题</a><a href="#research-ai-panel" onClick={e=>{e.preventDefault();const panel=document.getElementById("research-ai-panel");const details=panel?.querySelector("details");if(details)details.open=true;panel?.scrollIntoView({block:"start"});}}>AI 学术助手</a></div></div>
  <div id="research-ai-panel"><ResearchAssistant key={(topic?.id||'all')+':'+publications.map(n=>n.id+':'+n.revision).join(',')} topicId={topic?.id}/></div>
  <CommunityManagement onChange={()=>{if(topic)void openTopic(topic.id,noteOffset);else void browse(topicOffset);}}/>
  {error&&<p role="alert" className="form-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {creating&&<form className="community-panel" onSubmit={e=>{e.preventDefault();void createTopic();}}><h3>创建站内公开议题</h3><label>议题名称<input required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>研究问题与范围<textarea maxLength={2000} rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label><button className="primary" disabled={busy} type="submit">确认公开创建</button></form>}
  <div id="research-ideas" tabIndex={-1}/>
  {!topic?<><form className="community-controls" onSubmit={e=>{e.preventDefault();setSubmittedQuery(query);void browse(0,query);}}><label>搜索议题<input maxLength={100} value={query} onChange={e=>setQuery(e.target.value)} placeholder="文学、哲学、经济学…"/></label><button className="primary" disabled={busy} type="submit">搜索</button></form>
   <div className="grid academic-topic-list">{topics.map(t=><button type="button" disabled={busy} className="work-card" key={t.id} onClick={()=>{setNotice("");void openTopic(t.id);}}><h3 dir="auto">{t.title}</h3><p dir="auto" className="community-excerpt">{t.description||"暂无说明"}</p><span className="muted">{t.noteCount??0} 篇独立研究笔记</span></button>)}</div>
   {!topics.length&&!busy&&<p className="empty">暂无符合条件的研究议题。</p>}
   <div className="community-controls"><button className="text-button" disabled={busy||topicOffset===0} onClick={()=>void browse(Math.max(0,topicOffset-20))}>上一页</button><button className="text-button" disabled={busy||topicNext===null} onClick={()=>topicNext!==null&&void browse(topicNext)}>下一页</button></div>
  </>:<>
   <button type="button" className="text-button" disabled={busy} onClick={()=>void browse(topicOffset)}>← 返回议题列表</button>
   <div className="community-panel"><h3 dir="auto">{topic.title}</h3><p dir="auto" className="community-body">{topic.description}</p>{!topic.mine&&<SafetyActions target={{targetKind:"topic",targetId:topic.id,revision:0}} onChange={()=>void browse(topicOffset)}/>}<div className="community-controls"><button type="button" className="primary" disabled={busy} onClick={()=>createNote(topic)}>撰写自己的独立笔记</button><button type="button" className="text-button" disabled={busy} onClick={()=>void openTopic(topic.id,noteOffset)}>刷新议题</button></div><p className="muted">独立笔记先在私人笔记库保存，然后在这里主动发布。同一篇笔记可发布到多个议题。</p></div>
   <div className="community-panel"><h3>发布或更新已保存的笔记</h3><label>选择我的私人笔记<select value={entryId} disabled={busy} onChange={e=>setEntryId(e.target.value)}><option value="">请选择已保存的笔记</option>{eligible.map(n=><option key={n.id} value={n.id}>{n.title} · {n.language||"未分类"}</option>)}</select></label>
   <button type="button" className="text-button" disabled={busy} onClick={()=>{setConfirmed(false);void refreshNotes();}}>刷新我的笔记</button>
   {selected&&<div className="community-preview"><h4>公开内容预览</h4><strong dir="auto">{selected.title}</strong><p className="muted">{meta(selected)}</p><p className="community-body" dir="auto">{selected.content}</p><label className="community-consent"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>我确认将以上完整内容向本站登录用户公开；私人复习日期、作品编号和其他笔记不会公开。</label></div>}
   <button type="button" className="primary" disabled={busy||!selected||!confirmed} onClick={()=>void publish()}>公开当前已保存版本</button></div>
   <TopicNetwork key={topic.id} topicId={topic.id} notes={publications}/><h3>独立研究成果</h3><div className="grid academic-publications">{publications.map(n=><article className="community-panel" key={n.id}><p className="muted">{n.mine?"我的公开笔记":n.authorAlias} · 第 {n.revision} 版</p><h3 dir="auto">{n.title}</h3><small>{meta(n)}</small><p dir="auto" className="community-excerpt">{n.excerpt}</p><div className="community-controls"><button className="text-button" disabled={busy} onClick={()=>void openNote(n.id)}>阅读全文</button>{n.mine&&<button className="danger-link" disabled={busy} onClick={()=>void withdraw(n)}>撤回公开</button>}</div></article>)}</div>
   {!publications.length&&!busy&&<p className="empty">暂时没有公开笔记，可以成为第一位研究者。</p>}
   <div className="community-controls"><button className="text-button" disabled={busy||noteOffset===0} onClick={()=>void openTopic(topic.id,Math.max(0,noteOffset-20))}>上一页</button><button className="text-button" disabled={busy||noteNext===null} onClick={()=>noteNext!==null&&void openTopic(topic.id,noteNext)}>下一页</button></div>
   {detail&&<article className="community-panel" aria-label="公开笔记全文"><div className="community-controls"><h3 dir="auto">{detail.title}</h3><button className="text-button" onClick={()=>setDetail(null)}>关闭全文</button></div><p className="muted">{detail.mine?"我的公开笔记":detail.authorAlias} · {meta(detail)} · 第 {detail.revision} 版</p><NoteNetwork key={"network:"+detail.id+":"+detail.revision} note={detail} notes={publications} onOpen={id=>void openNote(id)} onDerive={()=>createNote(topic,detail)}/><ResearchThreads key={detail.id+":"+detail.revision} publication={detail} onBlocked={()=>void openTopic(topic.id,noteOffset)}/>{detail.mine&&<button className="danger-link" disabled={busy} onClick={()=>void withdraw(detail)}>撤回公开</button>}</article>}
  </>}
  {busy&&<p role="status">正在处理…</p>}
 </section>;
}
