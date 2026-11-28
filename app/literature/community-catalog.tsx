"use client";
import {useState} from "react";
import {researchLanguages,researchDisciplines,filterCatalog,languageLabel,disciplineLabel,type ResearchCatalogItem} from "./research-catalog";
export function CommunityCatalog({onTopic,onNote,onQuestion,busy}:{onTopic:(item:ResearchCatalogItem)=>void;onNote:(item:ResearchCatalogItem)=>void;onQuestion:(item:ResearchCatalogItem)=>void;busy:boolean}){
 const [language,setLanguage]=useState(""),[discipline,setDiscipline]=useState(""),[query,setQuery]=useState("");
 const items=filterCatalog(language,discipline,query);
 return <section className="community-panel multilingual-catalog" aria-label="多语言研究目录">
 <div className="section-heading"><div><h3>多语言研究目录</h3><p>六个重点语种统一按学科组织，其他北大备考相关方向只提供入门资料。此处为研习范围，不代表当年招生名单。</p></div></div>
 <div className="research-language-nav" role="group" aria-label="重点研究语言">{researchLanguages.filter(l=>l.tier==="core").map(l=><button type="button" key={l.id} aria-pressed={language===l.id} onClick={()=>{setLanguage(l.id);setDiscipline("");setQuery("");}}><strong>{l.label}</strong><small>{l.native}</small></button>)}</div>
 <details><summary>其他基础语种</summary><div className="research-language-nav">{researchLanguages.filter(l=>l.tier==="basic").map(l=><button type="button" key={l.id} aria-pressed={language===l.id} onClick={()=>{setLanguage(l.id);setDiscipline("");setQuery("");}}>{l.label}</button>)}</div></details>
 <div className="community-controls"><button type="button" className="text-button" onClick={()=>{setLanguage("");setDiscipline("");setQuery("");}}>全部资料</button><span className="muted">{researchLanguages.find(l=>l.id===language)?.region||"全部语种"} · {items.length} 个专题</span>{language==="ja"&&<a className="text-button" href="/literature?language=ja#library">打开日本文学专题与作品资料</a>}</div>
 <div className="community-controls"><label>研究领域<select value={discipline} onChange={e=>setDiscipline(e.target.value)}><option value="">全部领域</option>{researchDisciplines.filter(d=>!language||filterCatalog(language,d.id).length>0).map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label><label>检索资料<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="作品、概念、原文关键词"/></label></div>
 <div className="research-catalog-grid">{items.map(item=><article className="community-panel" key={item.id}><small>{languageLabel(item.languageId)} · {disciplineLabel(item.discipline)}</small><h4>{item.title}</h4><p>{item.summary}</p><p><strong>研究问题：</strong>{item.question}</p><p className="muted" dir="auto">检索词：{item.keywords}</p>{item.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">{s.name} · 资料检索入口</a>)}{!item.sources.length&&<p className="muted">入门导读；具体文献待补充与核验。</p>}<small className="muted">原创研究导读 · {item.version} · 非文献全文</small><div className="community-controls"><button className="text-button" disabled={busy} onClick={()=>onNote(item)}>写私人研习笔记</button><button className="text-button" disabled={busy} onClick={()=>onTopic(item)}>以此创建研究议题</button><button className="text-button" disabled={busy} onClick={()=>onQuestion(item)}>按资料出题</button></div></article>)}</div>
 {!items.length&&<p className="empty">暂无匹配专题，请调整筛选条件。</p>}
 <p className="muted">原文、论文及统计资料须到来源平台核对具体版本、页码和权限；本目录不假定已取得全文。</p>
 </section>;
}
