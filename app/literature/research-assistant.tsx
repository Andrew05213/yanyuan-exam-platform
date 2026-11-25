"use client";
import {useState,useEffect,useRef} from "react";
import type {ResearchTask,ResearchScope,ResearchSource,Evidence,ResearchResult} from "../../lib/research-assistant-contract";
type Hit=ResearchSource&{title:string;excerpt:string;language:string|null;discipline:string|null;score:number};
type Preview={sources:Evidence[];question:string;language:string;task:ResearchTask;destination:{host:string;model:string};fingerprint:string};
type Result={result:ResearchResult;sources:{key:string;title:string;kind:string;version:string;truncated:boolean}[];model:string;reviewStatus:string};
const endpoint="/api/literature/research-ai";
async function api<T>(body:unknown):Promise<T>{
 const r=await fetch(endpoint,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
 const data=await r.json();if(!r.ok)throw Error((data as {error?:string}|null)?.error||"研究助手暂不可用。");return data as T;
}
const message=(e:unknown)=>e instanceof Error?e.message:"请求失败。";
const key=(x:ResearchSource)=>x.kind+":"+x.id;
const label=(k:string)=>k==="private"?"私人笔记":k==="publication"?"公开笔记":"共享书目";
export function ResearchAssistant({topicId}:{topicId?:string}){
 const [scope,setScope]=useState<ResearchScope>("public"),[inTopic,setInTopic]=useState(true),[query,setQuery]=useState(""),[languages,setLanguages]=useState("中文、英语、日语、德语、法语"),[keywords,setKeywords]=useState<string[]>([]),[expanded,setExpanded]=useState(false);
 const [hits,setHits]=useState<Hit[]>([]),[selected,setSelected]=useState<string[]>([]),[searched,setSearched]=useState(false),[task,setTask]=useState<ResearchTask>("synthesis"),[question,setQuestion]=useState(""),[language,setLanguage]=useState("中文"),[preview,setPreview]=useState<Preview|null>(null),[confirmed,setConfirmed]=useState(false),[result,setResult]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const lock=useRef(false),serial=useRef(0);
 const chosen=hits.filter(h=>selected.includes(key(h)));
 const currentTopic=scope==="public"&&inTopic?topicId:undefined;
 function clearAnalysis(){setPreview(null);setConfirmed(false);setResult(null);}
 function clearSearch(){serial.current++;setHits([]);setSelected([]);setSearched(false);setKeywords([]);setExpanded(false);clearAnalysis();}
 useEffect(()=>{clearSearch();return()=>{serial.current++;};},[topicId,scope,inTopic]);
 useEffect(()=>{clearAnalysis();},[task,question,language,selected]);
 async function work<T>(action:()=>Promise<T>,apply:(data:T)=>void){
  if(lock.current)return;lock.current=true;const ticket=++serial.current;setBusy(true);setError("");
  try{const data=await action();if(serial.current===ticket)apply(data);}
  catch(e){if(serial.current===ticket)setError(message(e));}finally{lock.current=false;setBusy(false);}
 }
 async function search(useAI:boolean){
  if(!query.trim())return;
  if(useAI&&!window.confirm("仅将当前检索词和目标语种发送给站点默认模型，不发送任何笔记。确认继续？"))return;
  clearSearch();
  await work(async()=>{
   const words=useAI?(await api<{terms:string[]}>({action:"expand",query,languages,confirm:true})).terms:[...new Set(query.split(/[,，;；\n]+/).map(s=>s.trim()).filter(Boolean))].slice(0,8);
   const data=await api<{hits:Hit[]}>({action:"search",scope,topicId:currentTopic,terms:words});
   return {words,hits:data.hits};
  },data=>{setKeywords(data.words);setHits(data.hits);setSearched(true);setExpanded(useAI);});
 }
 function selection(){return {scope,topicId:currentTopic,task,question,language,sources:chosen.map(({kind,id,version})=>({kind,id,version}))};}
 async function prepare(){
  clearAnalysis();
  await work(()=>api<Preview>({action:"preview",...selection()}),setPreview);
 }
 async function analyze(){
  if(!preview||!confirmed)return;
  setResult(null);
  await work(()=>api<Result>({action:"analyze",...selection(),fingerprint:preview.fingerprint,confirm:true}),data=>{setResult(data);setConfirmed(false);});
 }
 return <details className="community-panel research-assistant"><summary>AI 学术研究助手</summary>
 <p className="community-privacy">普通检索仅访问站内数据库，不向模型发送资料。AI 扩展只发送检索词。分析前会预览实际发送的材料、问题与模型；私人笔记必须本人选择并确认。模型由管理员配置，外部服务可能保留请求，请勿提交个人信息或不宜共享的内容。</p>
 <fieldset disabled={busy} className="research-assistant-fields">
 <div className="field-pair"><label>检索范围<select value={scope} onChange={e=>setScope(e.target.value as ResearchScope)}><option value="public">站内公开笔记与共享书目</option><option value="private">仅我的私人笔记</option></select></label>{scope==="public"&&topicId&&<label className="community-consent"><input type="checkbox" checked={inTopic} onChange={e=>setInTopic(e.target.checked)}/>仅当前议题</label>}</div>
 <label>关键词（可用逗号分隔不同语种）<input maxLength={100} value={query} onChange={e=>{setQuery(e.target.value);clearSearch();}} placeholder="物哀, mono no aware, もののあはれ"/></label>
 <label>AI 扩展目标语种<input maxLength={100} value={languages} onChange={e=>setLanguages(e.target.value)}/></label>
 <div className="community-controls"><button type="button" className="primary" disabled={!query.trim()} onClick={()=>void search(false)}>本地检索</button><button type="button" className="text-button" disabled={!query.trim()||!languages.trim()} onClick={()=>void search(true)}>AI 跨语种关键词扩展并检索</button></div>
 {searched&&<><p className="muted">{expanded?"模型扩展关键词":"本地关键词"}：{keywords.join(" / ")} · {hits.length} 条结果（最多30条）</p><p>选择最多4份材料，按实际文本片段分析。</p>{hits.map(h=><label className="community-consent research-hit" key={key(h)}><input type="checkbox" checked={selected.includes(key(h))} disabled={selected.length>=4&&!selected.includes(key(h))} onChange={e=>setSelected(old=>e.target.checked?[...old,key(h)]:old.filter(x=>x!==key(h)))}/><span><strong dir="auto">{h.title}</strong><small>{label(h.kind)} · {h.version} · {[h.language,h.discipline].filter(Boolean).join(" · ")}</small><span className="community-excerpt" dir="auto">{h.excerpt}</span></span></label>)}{!hits.length&&<p>没有匹配材料，请尝试其他语种或关键词。</p>}</>}
 <div className="field-pair"><label>研究任务<select value={task} onChange={e=>setTask(e.target.value as ResearchTask)}><option value="synthesis">观点归纳与分歧</option><option value="literature">文献辅助分析</option><option value="questions">研究问题生成</option></select></label><label>输出语言<input maxLength={80} value={language} onChange={e=>setLanguage(e.target.value)}/></label></div>
 <label>希望研究的问题<textarea rows={3} maxLength={1000} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="这些材料有哪些共识、分歧和证据缺口？"/></label>
 <button type="button" className="primary" disabled={!chosen.length||!question.trim()||!language.trim()} onClick={()=>void prepare()}>预览实际发送内容</button>
 {preview&&<div className="community-panel"><h4>模型发送预览</h4><p>目标：{preview.destination.host} / {preview.destination.model}</p><p>研究问题：{preview.question} · 输出语言：{preview.language}</p>{preview.sources.map(s=><details key={s.key} open><summary>{s.key} · {label(s.kind)} · {s.title}{s.truncated?"（仅前4500字符）":""}</summary><p className="community-body research-preview-body" dir="auto">{s.text}</p></details>)}<label className="community-consent"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>我确认将上述文本、研究问题和语言发送给此模型。结果仅自己可见，不自动保存或公开。</label><button type="button" className="primary" disabled={!confirmed} onClick={()=>void analyze()}>确认并开始分析</button></div>}
 </fieldset>
 {busy&&<p role="status">正在处理…</p>}{error&&<p className="form-error" role="alert">{error}</p>}
 {result&&<section className="community-panel"><h3>AI 辅助研究结果</h3><p className="community-privacy">模型：{result.model} · 未经人工核验。引用片段已与发送材料逐字比对，但不保证观点正确、文献真实或解释充分。</p><h4>材料依据与观点</h4>{result.result.findings.map((f,i)=><article className="community-panel" key={i}><p className="community-body">{f.statement}</p>{f.evidence.map((e,j)=><blockquote className="research-quote" key={j}><small>{e.source} · {result.sources.find(s=>s.key===e.source)?.title}</small><p dir="auto">{e.quote}</p></blockquote>)}</article>)}{!result.result.findings.length&&<p>材料不足以支持明确观点。</p>}<h4>局限与待核验事项</h4>{result.result.limitations.map((x,i)=><p key={i}>{i+1}. {x}</p>)}<h4>后续研究问题</h4>{result.result.questions.map((x,i)=><p key={i}>{i+1}. {x}</p>)}<button type="button" className="text-button" onClick={()=>setResult(null)}>清除本次结果</button></section>}
 </details>;
}
