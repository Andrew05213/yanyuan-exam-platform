"use client";
import {useEffect,useRef,useState} from "react";
import {parseNote,inlineNote,formulaTokens} from "./academic-format.mjs";

type Version={revision:number;title:string;content:string;updated_at:string};
function Formula({text}:{text:string}){
 return <span className="academic-formula" aria-label={text}>{formulaTokens(text).map((t,i)=>t.kind==="fraction"?<span key={i} className="academic-fraction"><span>{t.top}</span><span>{t.bottom}</span></span>:t.kind==="sup"?<sup key={i}>{t.text}</sup>:t.kind==="sub"?<sub key={i}>{t.text}</sub>:<span key={i}>{t.text}</span>)}</span>;
}
function Inline({text}:{text:string}){
 return <>{inlineNote(text).map((t,i)=>t.kind==="bold"?<strong key={i}>{t.text}</strong>:t.kind==="italic"?<em key={i}>{t.text}</em>:t.kind==="code"?<code key={i}>{t.text}</code>:t.kind==="footnote"?<sup key={i}>[{t.text}]</sup>:t.kind==="math"?<Formula key={i} text={t.text}/>:<span key={i}>{t.text}</span>)}</>;
}
function Preview({value}:{value:string}){
 const {blocks,footnotes}=parseNote(value);
 return <div className="academic-preview" aria-label="笔记预览">{blocks.map((b,i)=>b.kind==="heading"?(b.level===1?<h2 key={i}><Inline text={b.text}/></h2>:b.level===2?<h3 key={i}><Inline text={b.text}/></h3>:<h4 key={i}><Inline text={b.text}/></h4>):b.kind==="code"?<pre key={i}>{b.text}</pre>:b.kind==="math"?<div key={i} className="academic-display-math"><Formula text={b.text}/></div>:b.kind==="quote"?<blockquote key={i}><Inline text={b.text}/></blockquote>:b.kind==="space"?<div key={i} className="academic-space"/>:<p key={i}>{b.kind==="bullet"?"• ":b.kind==="ordered"?b.number+". ":""}<Inline text={b.text}/></p>)}{footnotes.length>0&&<section className="academic-footnotes"><h3>脚注</h3>{footnotes.map(f=><p key={f.id}>[{f.id}] <Inline text={f.text}/></p>)}</section>}</div>;
}
export function AcademicEditor({value,onChange,label,noteId,revision,onRestore}:{value:string;onChange:(v:string)=>void;label:string;noteId:string;revision:number;onRestore:(v:Version)=>void}){
 const input=useRef<HTMLTextAreaElement>(null);
 const [mode,setMode]=useState<"edit"|"split"|"preview">("edit");
 const [history,setHistory]=useState<Version[]|null>(null);
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const generation=useRef(0);
 useEffect(()=>{generation.current++;setHistory(null);setMessage("");setBusy(false);return()=>{generation.current++;};},[noteId,revision]);
 function insert(before:string,after="",fallback=""){
  const el=input.current;if(!el)return;
  const start=el.selectionStart,end=el.selectionEnd,selected=value.slice(start,end)||fallback;
  const next=value.slice(0,start)+before+selected+after+value.slice(end);
  if(next.length>100000)return;
  onChange(next);requestAnimationFrame(()=>{if(input.current===el){el.focus();el.setSelectionRange(start+before.length,start+before.length+selected.length);}});
 }
 async function loadHistory(){
  const run=++generation.current;setBusy(true);setMessage("");
  try{const r=await fetch("/api/literature/entries?history="+encodeURIComponent(noteId),{cache:"no-store"});if(!r.ok)throw Error();const data=await r.json() as {versions:Version[]};if(run===generation.current)setHistory(data.versions);}
  catch{if(run===generation.current)setMessage("无法读取版本历史，请重试。");}
  finally{if(run===generation.current)setBusy(false);}
 }
 return <section className="academic-editor">
  <div className="academic-toolbar" role="group" aria-label="编辑模式">{(["edit","split","preview"] as const).map((m,i)=><button key={m} type="button" aria-pressed={mode===m} onClick={()=>setMode(m)}>{["编辑","分栏","预览"][i]}</button>)}</div>
  {mode!=="preview"&&<div className="academic-toolbar" role="group" aria-label="格式工具">
   <button type="button" onClick={()=>insert("## ","","小标题")}>标题</button>
   <button type="button" onClick={()=>insert("**","**","重点")}>粗体</button>
   <button type="button" onClick={()=>insert("*","*","强调")}>斜体</button>
   <button type="button" onClick={()=>insert("> ","","引文")}>引文</button>
   <button type="button" onClick={()=>insert("- ","","要点")}>列表</button>
   <button type="button" onClick={()=>insert("$","$","x^2")}>公式</button>
   <button type="button" onClick={()=>insert("\n$$","$$\n","\\frac{a}{b}")}>独立公式</button>
   <button type="button" onClick={()=>{const ids=new Set(parseNote(value).footnotes.map(f=>f.id));let n=1;while(ids.has("n"+n)||value.includes("[^n"+n+"]"))n++;const el=input.current;if(!el)return;const at=el.selectionEnd,marker="[^n"+n+"]",next=value.slice(0,at)+marker+value.slice(at)+"\n\n"+marker+": 注释或出处";if(next.length<=100000)onChange(next);}}>脚注</button>
  </div>}
  <div className={"academic-panes "+(mode==="split"?"academic-split":"")}>{mode!=="preview"&&<label>{label}<textarea ref={input} id="note-body" className="note-body" rows={15} value={value} onChange={e=>onChange(e.target.value)} maxLength={100000}/></label>}{mode!=="edit"&&<Preview value={value}/>}</div>
  <p className="muted academic-hint">支持基础 Markdown、脚注、希腊字母、上下标与简单分式；复杂 LaTeX 保留原始写法，不执行 HTML 或外部资源。</p>
  {revision>0&&<details className="academic-history"><summary>版本历史（最近20个旧正文版本）</summary><button type="button" disabled={busy} onClick={()=>void loadHistory()}>{busy?"读取中…":"读取历史"}</button>{message&&<p role="alert">{message}</p>}{history?.length===0&&<p>暂无历史版本。</p>}{history?.map(v=><details key={v.revision}><summary>版本 {v.revision} · {v.updated_at}</summary><h4>{v.title}</h4><Preview value={v.content}/><button type="button" onClick={()=>onRestore(v)}>载入为编辑草稿</button></details>)}</details>}
 </section>;
}
