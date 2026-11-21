"use client";
import {useState,useEffect} from "react";
import type {Entry} from "./notes";
import type {Material} from "./materials";
type Report={uniqueWrong:number;reviewAnswered:number;reviewCorrect:number;tags:{tag:string;uniqueWrong:number;subject:string}[];truncated:boolean};
export function ReviewDesk({entries,materials,edit,open}:{entries:Entry[];materials:Material[];edit:(n:Entry)=>void;open:(w:Material)=>void}){
 const [report,setReport]=useState<Report|null>(null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const c=new AbortController();setError(false);fetch("/api/learning-report",{signal:c.signal}).then(r=>{if(!r.ok)throw Error();return r.json() as Promise<Report>}).then(setReport).catch(()=>{if(!c.signal.aborted)setError(true)});return()=>c.abort()},[attempt]);
 const local=new Date(),today=[local.getFullYear(),String(local.getMonth()+1).padStart(2,"0"),String(local.getDate()).padStart(2,"0")].join("-");
 const due=entries.filter(e=>e.reviewOn&&e.reviewOn<=today).sort((a,b)=>a.reviewOn!.localeCompare(b.reviewOn!));
 const recent=entries.filter(e=>e.content.trim()&&e.updated_at&&Date.parse(e.updated_at)>=Date.now()-7*86400000);
 const interviews=entries.filter(e=>e.tags?.split(/[，,]/).includes("面试复练")||e.title.startsWith("面试复练 · "));
 return <div className="desk"><section><h2>学习进度</h2><p>最近七天编辑过 {recent.length} 篇笔记。累计保存 {interviews.length} 篇面试复练。</p>
 <h3>到期复习 · {due.length}</h3>{due.length?due.map(e=><button key={e.id} onClick={()=>edit(e)}>{e.reviewOn}　{e.title}</button>):<p>暂无到期笔记。在笔记编辑页选择下次复习日期后，会在这里提醒。</p>}</section>
 <section><h3>回看面试与再答</h3>{interviews.length?interviews.map(e=>{const w=materials.find(m=>m.id===e.workId||(!e.workId&&e.title==="面试复练 · "+m.title));return <p key={e.id}><button onClick={()=>edit(e)}>{e.title}</button>{w&&<button onClick={()=>open(w)}>打开原题再答</button>}</p>}):<p>在作品页面完成面试练习并保存后，可在此回看初稿与复练稿。</p>}</section>
 <section><h3>错题与重做</h3>{report?<><p>已记录 {report.uniqueWrong} 道不同错题。按每组最近一次重做统计，作答 {report.reviewAnswered} 道，答对 {report.reviewCorrect} 道。</p>{report.tags.slice(0,5).map(t=><p key={t.subject+t.tag}>{t.subject} · {t.tag}　{t.uniqueWrong} 道错题</p>)}{report.truncated&&<p>仅统计最近一批档案。</p>}</>:error?<button onClick={()=>setAttempt(a=>a+1)}>错题统计读取失败，重新读取</button>:<p>正在读取训练记录…</p>}<a href="/training.html#mistakes">打开错题库并遮住答案重做 →</a></section></div>
}
