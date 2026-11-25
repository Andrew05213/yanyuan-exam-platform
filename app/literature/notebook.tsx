"use client";
import {PenLine, Plus, Search} from "lucide-react";
import {useState} from "react";
import {Backup} from "./backup";
import {ResearchAssistant} from "./research-assistant";
import type {Material} from "./materials";
import {dueNotes,folders,type Entry,type Folder} from "./notes";

const names:Record<Folder,string>={active:"笔记",archived:"归档",trash:"回收站"};

export function Notebook({entries,materials,loading,writable,workId,create,open,reload,move}:{
  entries:Entry[];
  materials:Material[];
  loading:boolean;
  writable:boolean;
  workId:(entry:Entry)=>string;
  create:()=>void;
  open:(entry:Entry)=>void;
  reload:()=>Promise<void>;
  move:(entry:Entry,folder:Folder)=>Promise<void>;
}) {
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState("");
  const [language,setLanguage]=useState("");
  const [discipline,setDiscipline]=useState("");
  function clearFilters(){setQuery("");setStatus("");setLanguage("");setDiscipline("");}
  const [folder,setFolder]=useState<Folder>("active");
  const [moving,setMoving]=useState("");
  const titles=new Map(materials.map(work=>[work.id,work.title]));
  const personal=entries.filter(entry=>entry.id.startsWith("note_") || entry.content.trim());
  const current=personal.filter(entry=>(entry.folder??"active")===folder);
  const due=dueNotes(personal);
  const languages=[...new Set(current.flatMap(entry=>entry.language?[entry.language]:[]))].sort();
  const disciplines=[...new Set(current.flatMap(entry=>entry.discipline?[entry.discipline]:[]))].sort();
  const term=query.trim().toLowerCase();
  const filtered=current.filter(entry=>(!status||status===entry.status) &&
    (!language||entry.language===language)&&(!discipline||entry.discipline===discipline)&&
    [entry.title,entry.content,entry.tags,entry.locator,entry.language,entry.sourceLanguage,entry.discipline,titles.get(workId(entry))].join(" ").toLowerCase().includes(term));
  return <section aria-label="我的笔记" className="notebook-list">
    <header className="notebook-toolbar">
      <h2>我的笔记</h2>
      <button className="primary" disabled={!writable} onClick={create}><Plus size={17}/> 新建笔记</button>
    </header>
    {writable&&<>
      {due.length>0&&<section className="due-notes" aria-label="到期复习">
        <h3>到期复习 <span>{due.length}</span></h3>
        <ul>{due.slice(0,5).map(entry=><li key={entry.id}><button className="text-button" onClick={()=>open(entry)}>{entry.title}</button><time dateTime={entry.reviewOn!}>{entry.reviewOn}</time></li>)}</ul>
        {due.length>5&&<details><summary>查看其余 {due.length-5} 篇</summary><ul>{due.slice(5).map(entry=><li key={entry.id}><button className="text-button" onClick={()=>open(entry)}>{entry.title}</button><time dateTime={entry.reviewOn!}>{entry.reviewOn}</time></li>)}</ul></details>}
      </section>}
      <div className="notebook-folders" role="group" aria-label="笔记分类">
        {folders.map(value=><button type="button" key={value} aria-pressed={value===folder} onClick={()=>{setFolder(value);clearFilters();}}>
          {names[value]} <span>{personal.filter(entry=>(entry.folder??"active")===value).length}</span>
        </button>)}
      </div>
      <div className="notebook-filters">
        <label className="search"><Search size={18}/><input aria-label="搜索读书笔记" placeholder="搜索标题、正文、作品或标签" value={query} onChange={event=>setQuery(event.target.value)}/></label>
        <select aria-label="筛选笔记状态" value={status} onChange={event=>setStatus(event.target.value)}>
          <option value="">全部进度</option>
          {["未开始","在读","已读"].map(value=><option key={value}>{value}</option>)}
        </select>
        {languages.length>0&&<select aria-label="筛选笔记语种" value={language} onChange={event=>setLanguage(event.target.value)}>
          <option value="">全部语种</option>{languages.map(value=><option key={value}>{value}</option>)}
        </select>}
        {disciplines.length>0&&<select aria-label="筛选学科" value={discipline} onChange={event=>setDiscipline(event.target.value)}>
          <option value="">全部学科</option>{disciplines.map(value=><option key={value}>{value}</option>)}
        </select>}
      </div>
      {filtered.length ? <div className="grid">
        {filtered.map(entry=><article className="notebook-card" key={entry.id}>
          <div className="work-card note-card">
          <span className="card-top">{titles.get(workId(entry))||"个人笔记"} <span className="status">{entry.status}</span></span>
          <h3>{entry.title}</h3>
          <p className="excerpt">{entry.content||"还没有正文"}</p>
          {(entry.language||entry.discipline)&&<span className="muted">{[entry.language,entry.discipline].filter(Boolean).join(" · ")}</span>}
          {entry.tags&&<span className="card-foot">{entry.tags}</span>}
          </div>
          <div className="notebook-card-actions" aria-label={entry.title+"的操作"}>
            {(folder==="active"?[["编辑",null],["归档","archived"],["移入回收站","trash"]]:folder==="archived"?[["恢复","active"],["移入回收站","trash"]]:[["恢复","active"]]).map(([label,target])=>
              <button key={label} type="button" disabled={!!moving} onClick={async()=>{
                if(!target){open(entry);return;}
                setMoving(entry.id);
                try{await move(entry,target as Folder);}finally{setMoving("");}
              }}>{label}</button>)}
          </div>
        </article>)}
      </div>:<div className="empty notebook-empty">
        <PenLine size={24}/>
        <h3>{current.length?"没有符合条件的笔记":folder==="active"?"还没有笔记":names[folder]+"为空"}</h3>
        {current.length ? <button className="text-button" onClick={clearFilters}>清除筛选</button>
          : folder==="active"&&<a href="/literature">从文学资料选一部作品</a>}
      </div>}
      <ResearchAssistant allowShared={false}/>
      <Backup entries={entries} materials={materials} reload={reload}/>
    </>}
    {loading&&<p role="status">正在读取笔记…</p>}
  </section>;
}
