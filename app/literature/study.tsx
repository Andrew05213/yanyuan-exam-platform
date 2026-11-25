"use client";
import citations from "./paper-citations.json";
const paperInfo: Record<string,string> = citations;
import { furtherReading, researchCatalog } from "./research";
import {Practice} from "./practice";
import {useState,useEffect,useRef} from "react";
import {BookOpen,Search,PenLine,Mic,Lock,Library,Plus,Trash2} from "lucide-react";
import {Tabs,TabsList,TabsTrigger,TabsContent} from "@/components/ui/tabs";
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from "@/components/ui/select";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from "@/components/ui/alert-dialog";
import {type Material} from "./materials";
import {Progress} from "@/components/ui/progress";
import {Toaster,toast} from "sonner";
import {works,eras} from "./data";
import type {Entry} from "./notes";
import {Community} from "./community";
import {draftKey,readDrafts} from "./drafts";
import {Backup} from "./backup";
import {ReviewDesk} from "./review-desk";
import {readingPaths} from "./paths";
import {oralLinks} from "./oral-links";
const newEntry=():Entry=>({id:"note_"+crypto.randomUUID(),title:"",content:"",status:"未开始"});
function Filter({value,onChange,items,label,disabled=false}:{value:string;onChange:(v:string)=>void;items:string[];label:string;disabled?:boolean}){return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{items.map(i=><SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent></Select>;}
const newMaterial=():Material=>({id:"material_"+crypto.randomUUID(),title:"",author:"",era:"近现代",theme:"",brief:"",guide:"",question:"",angles:[],source:"",sourceName:""});
export default function Study(){
 const [category,setCategory]=useState("全部");
 const [noteQuery,setNoteQuery]=useState("");
 const [noteLanguage,setNoteLanguage]=useState(""),[noteDiscipline,setNoteDiscipline]=useState("");
 const [draftOwner,setDraftOwner]=useState("");
 const [localDrafts,setLocalDrafts]=useState<Entry[]>([]);
 const [storageFailed,setStorageFailed]=useState(false);

 function editDraft(value:Entry){
   setDraft(value);
   if(!draftOwner)return;
   try{
     localStorage.setItem(draftKey(draftOwner,value.id),JSON.stringify(value));
     setLocalDrafts(old=>[value,...old.filter(n=>n.id!==value.id)]);
     setStorageFailed(false);
   }catch{setStorageFailed(true);}
 }
 function discard(id:string){
   try{localStorage.removeItem(draftKey(draftOwner,id));setLocalDrafts(old=>old.filter(n=>n.id!==id));}
   catch{setStorageFailed(true);}
 }
 function recover(value:Entry){
   setActive(materials.find(w=>w.id===value.id)||null);
   setDraft({...value});setShowHints(false);
 }
 const [tab,setTab]=useState("library"),[query,setQuery]=useState(""),[era,setEra]=useState("全部"),[status,setStatus]=useState("全部"),[entries,setEntries]=useState<Entry[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[login,setLogin]=useState(false),[active,setActive]=useState<typeof works[number]|null>(null),[draft,setDraft]=useState<Entry|null>(null),[saving,setSaving]=useState(false),[showHints,setShowHints]=useState(false);
 const [materials,setMaterials]=useState<Material[]>(works),[materialDraft,setMaterialDraft]=useState<Material|null>(null),[deleteTarget,setDeleteTarget]=useState<Material|null>(null),[materialBusy,setMaterialBusy]=useState(false),[materialError,setMaterialError]=useState(""),[interviewDraft,setInterviewDraft]=useState<Material|null>(null);
 const materialsRef=useRef(materials); materialsRef.current=materials;
 useEffect(()=>{const sync=()=>{const name=location.hash.slice(1);if(["library","history","notes","community","interview","review"].includes(name))setTab(name);};sync();window.addEventListener("hashchange",sync);return()=>window.removeEventListener("hashchange",sync);},[]);
 const secondaryPaper=active?furtherReading[active.id]:undefined;
 const writable=!loading&&!login&&!error;
 async function load(quiet=false){if(!quiet)setLoading(true);setError("");try {
 const [notesResponse,materialsResponse]=await Promise.all([fetch("/api/literature/entries"),fetch("/api/literature/materials")]);
 if(notesResponse.status===401||materialsResponse.status===401){setLogin(true);return;}
 if(!notesResponse.ok||!materialsResponse.ok)throw new Error();
 const [notesData,materialsData]=await Promise.all([notesResponse.json(),materialsResponse.json()]);
 const owner=notesResponse.headers.get("X-Draft-Owner")||"";
 setDraftOwner(owner);
 let drafts:Entry[]=[];
 if(owner)try{drafts=readDrafts(localStorage,owner);}catch{setStorageFailed(true);}
 setLocalDrafts(drafts);setEntries(notesData as Entry[]);if(location.hash.startsWith("#note/")){
 const note=(notesData as Entry[]).find(n=>encodeURIComponent(n.id)===location.hash.slice(6));
 if(note){setTab("notes");setDraft({...note});setActive((materialsData as Material[]).find(m=>m.id===note.id)||null);}
 history.replaceState(null,"","#notes");}setMaterials(materialsData as Material[]);setLogin(false);
 }catch{setError("无法读取已保存内容，请重试。");}finally{setLoading(false);}}
 async function saveMaterial(candidate:Material|null=materialDraft,returnTab:"library"|"interview"="library"){if(!candidate)return;if(returnTab==="interview"&&!candidate.question.trim()){setMaterialError("请填写面试讨论题");return;}setMaterialBusy(true);setMaterialError("");try {
 const r=await fetch("/api/literature/materials",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(candidate)});
 const data=await r.json() as Material & {error?:string};if(!r.ok)throw new Error(data.error||"保存失败，请重试");
 setMaterials(prev=>{const exists=prev.some(w=>w.id===data.id);return exists?prev.map(w=>w.id===data.id?data:w):[...prev,data];});
 setMaterialDraft(null);setInterviewDraft(null);if(returnTab==="library"){setQuery("");setEra("全部");setStatus("全部");}setTab(returnTab);toast.success(returnTab==="interview"?"面试题已保存":"文学资料已保存");
 }catch(e){setMaterialError(e instanceof Error?e.message:"保存失败，请重试");}finally{setMaterialBusy(false);}}
 async function deleteMaterial(){if(!deleteTarget)return;setMaterialBusy(true);setMaterialError("");try {
 const r=await fetch("/api/literature/materials",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:deleteTarget.id})});
 if(!r.ok){const data=await r.json() as {error?:string};throw new Error(data.error||"删除失败，请重试");}
 setMaterials(prev=>prev.filter(w=>w.id!==deleteTarget.id));setDeleteTarget(null);toast.success("文学资料已删除");
 }catch(e){setMaterialError(e instanceof Error?e.message:"删除失败，请重试");}finally{setMaterialBusy(false);}}
 function editMaterial(w:Material){setMaterialError("");setMaterialDraft({...w,angles:[...w.angles]});}

 useEffect(()=>{load();},[]);
 async function save(e:Entry){setSaving(true);try{const r=await fetch("/api/literature/entries",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(!r.ok){const j=await r.json() as {error:string};throw new Error(j.error);}const result=await r.json() as {updated_at:string};discard(e.id);setEntries(prev=>[{...e,updated_at:result.updated_at},...prev.filter(x=>x.id!==e.id)]);toast.success("已保存");return true;}catch(err){toast.error(err instanceof Error?err.message:"保存失败，请重试");return false;}finally{setSaving(false);}}
 useEffect(()=>{const ctx=(document as any).modelContext;if(!ctx?.registerTool)return;const life=new AbortController();try{Promise.resolve(ctx.registerTool({name:"search_literature",description:"搜索文学条目并显示资料库结果",inputSchema:{type:"object",properties:{query:{type:"string"}},required:["query"],additionalProperties:false},annotations:{readOnlyHint:true},execute(input:any){if(typeof input?.query!=="string")throw new Error("query must be string");setTab("library");setQuery(input.query);setEra("全部");setStatus("全部");return {results:materialsRef.current.filter(w=>[w.title,w.author,w.theme].join(" ").includes(input.query)).map(w=>({id:w.id,workId:w.id,title:w.title}))};}},{signal:life.signal})).catch(()=>{});}catch{}return()=>life.abort();},[]);
 const state=(id:string)=>entries.find(e=>e.id===id)?.status||"未开始";
 const researchById=new Map(researchCatalog.map(item=>[item.id,item]));
 const found=materials.filter(w=>(category==="全部"||category===(researchById.get(w.id)?.category||(w.id.startsWith("japan_stats_")?"近现代社会":"文学")))&&(era==="全部"||w.era===era)&&(status==="全部"||state(w.id)===status)&&[w.title,w.author,w.theme,w.brief].join(" ").toLowerCase().includes(query.toLowerCase()));
 const personal=entries.filter(e=>(e.id.startsWith("note_")||materials.some(w=>w.id===e.id)&&!!e.content.trim())&&(!noteLanguage||(e.language||"")===noteLanguage)&&(!noteDiscipline||(e.discipline||"")===noteDiscipline)&&[e.title,e.content,e.tags,e.locator,e.language,e.sourceLanguage,e.discipline,materials.find(w=>w.id===linkedWork(e))?.title].join(" ").toLowerCase().includes(noteQuery.trim().toLowerCase())); const completed=materials.filter(w=>state(w.id)==="已读").length;
 function linkedWork(e:Entry){
   if(e.workId!==undefined && e.workId!==null)return e.workId;
   if(!e.id.startsWith("note_"))return e.id;
   const matches=materials.filter(w=>e.title===w.title+" · 读书笔记"&&e.content.startsWith("作品： "+w.title+"\n") || e.title==="面试复练 · "+w.title&&!!w.question&&e.content.startsWith(w.question+"\n"));
   return matches.length===1?matches[0].id:"";
 }
 function open(w:typeof works[number]){setActive(w);setDraft(entries.find(e=>e.id===w.id)||{id:w.id,workId:w.id,title:w.title,content:"",status:"未开始"});setShowHints(false);}

 const deepLinkChecked=useRef(false);
 useEffect(()=>{
   if(loading||deepLinkChecked.current)return;
   deepLinkChecked.current=true;
   const id=new URLSearchParams(location.search).get("work");
   const w=materials.find(m=>m.id===id);if(w)open(w);
 },[loading,materials]);
 return <><Toaster richColors/><header className="masthead"><a className="brand" href="/#today" aria-label="和知 AI 今日学习"><img className="academic-brand-mark" src="/assets/mark.svg?v=2" alt=""/><div><strong>和知 AI</strong><small>Learning &amp; Research</small></div></a><nav className="module-links"><a href="/#today">今日学习</a><a href="/#schools">备考中心</a><a href="/#oral">口试训练</a></nav><span className="private"><Lock size={14}/> 私人学习空间</span></header><main className="shell"><div className="intro"><div><p className="eyebrow">READING · THINKING · RESEARCH</p><h1>阅读、笔记与学术研究</h1><p className="sub">从日本文学出发，连接多语种知识、独立思考与有依据的表达。</p></div><div className="reading-summary"><BookOpen size={22}/><strong>{completed}<span> / {materials.length}</span></strong><span>已读条目</span><Progress value={materials.length?completed/materials.length*100:0} aria-label="已读比例"/></div></div>
 {login&&<div className="notice">登录后可保存文章和进度。<a href="/signin-with-chatgpt?return_to=%2Fliterature" target="_top">登录学习账号</a></div>}{error&&<div className="notice" role="alert">{error}<button onClick={()=>void load()}>重新读取</button></div>}
 {writable&&localDrafts.length>0&&<details className="notice"><summary>本机有 {localDrafts.length} 篇未提交的笔记草稿</summary>{localDrafts.map(n=><p key={n.id}>{n.title||"无标题笔记"}　<button onClick={()=>recover(n)}>恢复草稿</button>　<button onClick={()=>discard(n.id)}>丢弃草稿</button></p>)}</details>}
 <Tabs value={tab} onValueChange={value=>{setTab(value);history.replaceState(null,"","#"+value);}}><TabsList className="navigation" variant="line"><TabsTrigger value="library"><Library/>研究资料</TabsTrigger><TabsTrigger value="history"><BookOpen/>文学脉络</TabsTrigger><TabsTrigger value="notes"><PenLine/>读书笔记库</TabsTrigger><TabsTrigger value="community">研究社区</TabsTrigger><TabsTrigger value="interview"><Mic/>面试练习</TabsTrigger><TabsTrigger value="review">复习与进度</TabsTrigger></TabsList>
 <TabsContent value="library"><section className="section-heading"><div><h2>作品与研究专题</h2><p>书单作品、中文论文和面试研读题。知网全文权限由来源平台提供。</p></div><div className="library-actions"><span className="muted">{found.length} 个条目</span><button className="primary" disabled={!writable} onClick={()=>{setMaterialError("");setMaterialDraft(newMaterial());}}><Plus size={17}/>新增资料</button></div></section><div className="filters"><label className="search"><Search size={18}/><input aria-label="搜索文学资料" placeholder="搜索作品、作家或主题" value={query} onChange={e=>setQuery(e.target.value)}/></label><Filter value={category} onChange={setCategory} items={["全部","文学","传统文化","近现代社会"]} label="筛选资料类别"/><Filter value={era} onChange={setEra} items={["全部",...eras.map(e=>e.title)]} label="筛选文学时代"/><Filter value={status} onChange={setStatus} items={["全部","未开始","在读","已读"]} label="筛选阅读状态"/></div><div className="grid">{found.map(w=><article className="material-card" key={w.id}><button className="work-card" onClick={()=>open(w)}><div className="card-top"><span>{researchById.get(w.id)?.group||w.era} / {w.author}</span><span className="status">{state(w.id)}</span></div><h3>{w.title}</h3><p>{w.brief}</p><div className="card-foot"><span>{w.theme}</span><BookOpen size={18}/></div></button><div className="material-actions"><button disabled={!writable} onClick={()=>editMaterial(w)} aria-label={"编辑"+w.title}><PenLine size={16}/>编辑</button><button className="danger-link" disabled={!writable} onClick={()=>{setMaterialError("");setDeleteTarget(w);}} aria-label={"删除"+w.title}><Trash2 size={16}/>删除</button></div></article>)}</div>{!found.length&&<div className="empty">没有符合条件的条目。试试其他关键词或筛选条件。</div>}</TabsContent>
 <TabsContent value="review">{writable?<ReviewDesk entries={entries} materials={materials} edit={recover} open={open}/>:<p>登录并加载个人档案后可查看学习进度。</p>}</TabsContent>
 <TabsContent value="history">
  <section className="section-heading"><div><h2>日本文学脉络</h2>
   <p>按时期阅读作品。点击卡片可查看研读提示、参考资料和笔记。</p>
  </div></section>
  <section className="notebook-tools"><h3>比较阅读路线</h3>{readingPaths.map(path=><details key={path.title}><summary>{path.title}</summary><p>{path.question}</p>{path.ids.map(id=>materials.find(m=>m.id===id)).filter(w=>!!w).map(w=><button key={w.id} onClick={()=>open(w)}>{w.title}</button>)}</details>)}</section>
  <div className="literary-periods">
   {eras.map(period=>{
    const periodWorks=materials.filter(work=>work.era===period.title&&
      (researchById.get(work.id)?.category??(work.id.startsWith("japan_stats_")?"近现代社会":"文学"))==="文学");
    return <section key={period.title} className="literary-period" aria-labelledby={`period-${period.title}`}>
     <small className="muted">{period.date} · {periodWorks.length} 部作品</small>
     <h3 id={`period-${period.title}`}>{period.title}</h3>
     <p>{period.text}</p>
     {periodWorks.length?<div className="grid">
      {periodWorks.map(work=><button type="button" key={work.id} className="work-card" onClick={()=>open(work)}>
       <div className="card-top"><span>{work.author}</span><span className="status">{state(work.id)}</span></div>
       <h4>{work.title}</h4><p>{work.brief}</p><div className="card-foot">打开研读与笔记 <BookOpen size={16}/></div>
      </button>)}
     </div>:<p className="muted">本时期暂无收录作品。</p>}
    </section>;
   })}
  </div>
  <p className="source-line">分期参考 <a href="https://www.nijl.ac.jp/etenji/bungakushi/contents/" target="_blank" rel="noreferrer">国文学研究资料馆 · 日本古典文学史</a></p>
 </TabsContent>
 <TabsContent value="notes"><section className="section-heading"><div><h2>多语种读书笔记库</h2><p>记录任意语种、学科的阅读与研究；原有日本文学笔记和面试复练仍然保留。</p></div><button className="primary" disabled={loading||login||!!error} onClick={()=>{setActive(null);setDraft(newEntry());}}>新增读书笔记</button></section>{writable&&<Backup entries={entries} materials={materials} reload={()=>load(true)}/>}<label className="search"><Search size={18}/><input aria-label="搜索读书笔记" placeholder="搜索标题、正文、作品、语种、学科或标签" value={noteQuery} onChange={e=>setNoteQuery(e.target.value)}/></label><div className="field-pair"><label>笔记语种<select value={noteLanguage} onChange={e=>setNoteLanguage(e.target.value)}><option value="">全部</option>{Array.from(new Set(entries.map(n=>n.language).filter((s):s is string=>!!s))).sort().map(s=><option key={s} value={s}>{s}</option>)}</select></label><label>学科<select value={noteDiscipline} onChange={e=>setNoteDiscipline(e.target.value)}><option value="">全部</option>{Array.from(new Set(entries.map(n=>n.discipline).filter((s):s is string=>!!s))).sort().map(s=><option key={s} value={s}>{s}</option>)}</select></label></div>{loading?<p>正在读取文章…</p>:personal.length?<div className="grid">{personal.map(e=><button className="work-card" key={e.id} onClick={()=>{setActive(materials.find(w=>w.id===e.id)||null);setDraft({...e});}}><span className="muted">{materials.find(w=>w.id===linkedWork(e))?.title||"个人笔记"}</span><h3>{e.title}</h3><small>{[e.language,e.discipline,e.sourceLanguage&&"原文："+e.sourceLanguage].filter(Boolean).join(" · ")||"未分类"}</small>{e.tags&&<small>{e.tags}</small>}<p className="excerpt">{e.content.slice(0,130)||"还没有正文"}</p><div className="card-foot">继续编辑<PenLine size={18}/></div></button>)}</div>:<div className="empty"><PenLine size={28}/><h3>从一个值得追问的问题开始。</h3><p>例如：无常观如何影响日本文学中的人物选择？</p><p>新增笔记，或者从研究资料打开作品并保存阅读记录。</p></div>}</TabsContent>
 <TabsContent value="community">{writable?<Community entries={entries} refreshNotes={()=>load(true)} createNote={(topic,source)=>{setActive(null);setShowHints(false);editDraft({...newEntry(),title:(topic.title+(source?" · 衍生研究":" · 独立研究")).slice(0,200),content:source?"独立研究问题：\n\n我的观点与依据：\n\n对原研究的回应：\n":"研究问题：\n\n我的观点：\n\n文本或文献依据：\n\n尚待研究：\n"});}}/>:<p>登录并加载个人档案后可访问研究社区。</p>}</TabsContent>
 <TabsContent value="interview"><section className="section-heading"><div><h2>把阅读转化为表达</h2><p>每题约 90 秒：明确观点，用文本举例，再说明观点的边界。</p></div></section><div className="questions">{materials.filter(w=>w.question).map((w,i)=><article key={w.id}><span className="question-number">{String(i+1).padStart(2,"0")}</span><div><small>{w.title} · {w.theme}</small><h3>{w.question}</h3><div className="interview-actions"><button className="text-button" onClick={()=>open(w)}>准备回答与记录</button><button className="text-button edit-question" disabled={!writable} aria-label={"编辑"+w.title+"面试题"} onClick={()=>{setMaterialError("");setInterviewDraft({...w,angles:[...w.angles]});}}><PenLine size={16}/>编辑</button></div></div></article>)}</div><p className="source-line">以上为学习练习题，不代表学校官方考题。可以在条目笔记中保存回答提纲。</p></TabsContent>
 </Tabs><footer>和知 AI · 阅读与研究 <span>每一个观点，都从一次认真阅读开始。</span></footer></main><nav className="literature-mobile-dock" aria-label="快捷导航"><a href="/#today">首页</a><a href="/#schools">学习</a><a href="#notes" aria-current={tab==="notes"?"page":undefined}>笔记</a><a href="#community" aria-current={tab==="community"?"page":undefined}>研究</a><a href="/#saved">档案</a></nav>
 <Dialog open={!!draft} onOpenChange={o=>{if(!o&&!saving){setDraft(null);setActive(null);}}}><DialogContent className="editor notebook-editor"><DialogHeader><DialogTitle>{active?active.title:"读书笔记"}</DialogTitle><DialogDescription>{active?active.author+" · "+active.era:"写下你的阅读与思考，点击保存后长期保留。"}</DialogDescription></DialogHeader>{active&&writable&&<button type="button" className="text-button jump-to-note" onClick={()=>document.getElementById("note-body")?.focus()}>直接写笔记 ↓</button>}{active&&<div className="reading-guide"><h4>阅读切入点</h4><p>{active.guide||"记录你的阅读重点与文本依据。"}</p>{active.source&&<a href={active.source} target="_blank" rel="noreferrer">{paperInfo[active.source]||active.sourceName||"参考来源"}</a>}{secondaryPaper&&<p><a href={secondaryPaper[1]} target="_blank" rel="noreferrer">{paperInfo[secondaryPaper[1]]||secondaryPaper[0]} · 知网</a></p>}{active.id==="research_18"&&<p>作者依据图书馆目录校正为山冈庄八。<a href="https://opac.lib.uibe.edu.cn/opac/book/21d7aac32e24bc564ad189cf6c68b2d9" target="_blank" rel="noreferrer">核对馆藏书目</a></p>}{active.question&&<div className="prompt"><small>面试思考</small><h4>{active.question}</h4><button className="text-button" onClick={()=>setShowHints(!showHints)}>{showHints?"收起思路":"查看展开思路"}</button>{showHints&&<ol>{active.angles.map(a=><li key={a}>{a}</li>)}</ol>}</div>}</div>}{active&&<button type="button" className="text-button" disabled={!writable} onClick={()=>{const title=active.title;setActive(null);editDraft({...newEntry(),workId:active.id,title:title+" · 读书笔记",content:"作品： "+title+"\n\n摘录与页码：\n\n阅读感想：\n\n值得追问的问题：\n"});}}>为这部作品新建一篇笔记</button>}{active&&<section><h4>这部作品的笔记</h4>{entries.filter(n=>n.id!==active.id&&linkedWork(n)===active.id).length===0?<p>尚无独立笔记。</p>:entries.filter(n=>n.id!==active.id&&linkedWork(n)===active.id).map(n=><p key={n.id}><button className="text-button" onClick={()=>recover(n)}>{n.title}</button></p>)}</section>}{active&&<details className="notebook-tools"><summary>关联阅读与口试</summary>{readingPaths.filter(p=>p.ids.includes(active.id)).map(p=><section key={p.title}><h4>{p.title}</h4><p>{p.question}</p>{p.ids.filter(id=>id!==active.id).map(id=>materials.find(m=>m.id===id)).filter(w=>!!w).map(w=><button key={w.id} onClick={()=>open(w)}>{w.title}</button>)}</section>)}{oralLinks.filter(t=>t.works.includes(active.id)).map(t=><p key={t.id}><a href={"/?readingPractice=ja#task/pku/"+t.id}>{t.title} →</a></p>)}<p>本条目的专题面试可在下方练习。</p></details>}
 {(()=>{const work=active || (draft && materials.find(m=>m.id===linkedWork(draft)));return work && <Practice owner={draftOwner} key={draftOwner+work.id} work={work} save={save} enabled={writable} previous={entries.filter(n=>linkedWork(n)===work.id&&n.tags?.includes("面试复练"))}/>})()} {draft&&localDrafts.some(n=>n.id===draft.id&&JSON.stringify(n)!==JSON.stringify(draft))&&<button className="text-button" onClick={()=>recover(localDrafts.find(n=>n.id===draft.id)!)}>恢复这篇笔记的本机草稿</button>}{draft&&<form onSubmit={async e=>{e.preventDefault();await save({...draft,workId:linkedWork(draft)||null});}}><fieldset disabled={saving||!writable} style={{border:0,padding:0,margin:0}}>{!active&&<label>关联作品<select value={linkedWork(draft)} onChange={e=>editDraft({...draft,workId:e.target.value})}><option value="">独立笔记</option>{materials.map(w=><option value={w.id} key={w.id}>{w.title}</option>)}</select></label>}<label>标题<input required maxLength={200} value={draft.title} onChange={e=>editDraft({...draft,title:e.target.value})}/></label>{active&&<div className="status-row"><label>阅读状态</label><Filter value={draft.status} onChange={v=>editDraft({...draft,status:v})} items={["未开始","在读","已读"]} label="选择阅读状态"/></div>}<div className="field-pair"><label>笔记语种<input maxLength={100} list="note-language-options" placeholder="如中文、日语、跨语种" value={draft.language||""} onChange={e=>editDraft({...draft,language:e.target.value})}/></label><label>原文语种（可多种）<input maxLength={100} list="note-language-options" placeholder="如法语、德语" value={draft.sourceLanguage||""} onChange={e=>editDraft({...draft,sourceLanguage:e.target.value})}/></label></div><datalist id="note-language-options">{["中文","英语","日语","德语","法语","俄语","西班牙语","阿拉伯语","韩语","跨语种"].map(l=><option key={l} value={l}/>)}</datalist><label>学科<input maxLength={100} list="note-discipline-options" value={draft.discipline||""} onChange={e=>editDraft({...draft,discipline:e.target.value})} placeholder="如文学、经济学、哲学"/></label><datalist id="note-discipline-options">{["文学","语言学","经济学","哲学","历史学","社会学","自然科学","工程学"].map(l=><option key={l} value={l}/>)}</datalist><details className="note-fields"><summary>标签、出处与复习日期</summary><label>主题标签（逗号分隔）<input maxLength={300} value={draft.tags||""} onChange={e=>editDraft({...draft,tags:e.target.value})}/></label><label>版本、章节或页码<input maxLength={300} value={draft.locator||""} onChange={e=>editDraft({...draft,locator:e.target.value})}/></label><label>下次复习<input type="date" value={draft.reviewOn||""} onChange={e=>editDraft({...draft,reviewOn:e.target.value})}/></label></details><label>{active?"阅读笔记 / 面试回答提纲":"正文"}<textarea id="note-body" className="note-body" rows={15} placeholder="我的观点：
文本依据：
可以追问的问题：" value={draft.content} onChange={e=>editDraft({...draft,content:e.target.value})} maxLength={100000}/></label><div className="save-row"><span role="status">{!writable?"登录并加载笔记后可编辑":storageFailed?"本机草稿存储不可用，请点击保存":localDrafts.some(n=>n.id===draft.id)?"草稿已保存在本机，点击保存可同步":"编辑后自动保留本机草稿"}</span><button className="primary" type="submit" disabled={saving||loading||login||!!error}>{saving?"保存中…":"保存"}</button></div></fieldset></form>}</DialogContent></Dialog>
 <Dialog open={!!interviewDraft} onOpenChange={open=>{if(!open&&!materialBusy){setInterviewDraft(null);setMaterialError("");}}}><DialogContent className="editor interview-editor"><DialogHeader><DialogTitle>编辑面试题</DialogTitle><DialogDescription>{interviewDraft?.title} · {interviewDraft?.theme}</DialogDescription></DialogHeader>{interviewDraft&&<form onSubmit={e=>{e.preventDefault();void saveMaterial(interviewDraft,"interview");}}>
 <label>面试讨论题<textarea required disabled={materialBusy} maxLength={2000} className="short-text" value={interviewDraft.question} onChange={e=>setInterviewDraft({...interviewDraft,question:e.target.value})}/></label>
 <label>展开思路（每行一条）<textarea disabled={materialBusy} value={interviewDraft.angles.join("\n")} onChange={e=>setInterviewDraft({...interviewDraft,angles:e.target.value.split("\n")})} placeholder="明确核心观点\n引用文本依据\n讨论观点的边界"/></label>
 {materialError&&<p className="form-error" role="alert">{materialError}</p>}
 <div className="save-row"><span>保存后同步到对应文学资料</span><button className="primary" type="submit" disabled={materialBusy||!writable}>{materialBusy?"保存中…":"保存修改"}</button></div>
 </form>}</DialogContent></Dialog>
 <Dialog open={!!materialDraft} onOpenChange={open=>{if(!open&&!materialBusy){setMaterialDraft(null);setMaterialError("");}}}><DialogContent className="editor material-editor"><DialogHeader><DialogTitle>{materials.some(w=>w.id===materialDraft?.id)?"编辑文学资料":"新增文学资料"}</DialogTitle><DialogDescription>填写作品信息；阅读切入点、面试问题和参考来源可稍后补充。</DialogDescription></DialogHeader>{materialDraft&&<form onSubmit={e=>{e.preventDefault();void saveMaterial();}}>
 <div className="field-pair"><label>作品 / 资料名称 *<input required maxLength={200} value={materialDraft.title} onChange={e=>setMaterialDraft({...materialDraft,title:e.target.value})} placeholder="例如：金阁寺"/></label><label>作家 / 作者 *<input required maxLength={200} value={materialDraft.author} onChange={e=>setMaterialDraft({...materialDraft,author:e.target.value})} placeholder="例如：三岛由纪夫"/></label></div>
 <div className="field-pair"><label>时代 *<Filter disabled={materialBusy} value={materialDraft.era} onChange={v=>setMaterialDraft({...materialDraft,era:v})} items={eras.map(e=>e.title)} label="资料时代"/></label><label>主题 *<input required maxLength={100} value={materialDraft.theme} onChange={e=>setMaterialDraft({...materialDraft,theme:e.target.value})} placeholder="例如：美与毁灭"/></label></div>
 <label>作品介绍 *<textarea required className="short-text" maxLength={2000} value={materialDraft.brief} onChange={e=>setMaterialDraft({...materialDraft,brief:e.target.value})} placeholder="简要介绍这份资料的内容和学习价值"/></label>
 <label>阅读切入点<textarea maxLength={20000} className="short-text" value={materialDraft.guide} onChange={e=>setMaterialDraft({...materialDraft,guide:e.target.value})} placeholder="你希望从哪些角度阅读？"/></label>
 <label>面试讨论题<textarea className="short-text" maxLength={2000} value={materialDraft.question} onChange={e=>setMaterialDraft({...materialDraft,question:e.target.value})} placeholder="填写后将显示在“面试练习”中"/></label>
 <label>展开思路（每行一条）<textarea className="short-text" value={materialDraft.angles.join("\n")} onChange={e=>setMaterialDraft({...materialDraft,angles:e.target.value.split("\n")})} placeholder="明确核心观点\n引用文本依据\n讨论观点的边界"/></label>
 <div className="field-pair"><label>参考来源名称<input maxLength={200} value={materialDraft.sourceName} onChange={e=>setMaterialDraft({...materialDraft,sourceName:e.target.value})} placeholder="例如：图书馆资料页"/></label><label>参考链接<input type="url" maxLength={2000} value={materialDraft.source} onChange={e=>setMaterialDraft({...materialDraft,source:e.target.value})} placeholder="https://"/></label></div>
 {materialError&&<p className="form-error" role="alert">{materialError}</p>}
 <div className="save-row"><span>* 为必填内容</span><button className="primary" type="submit" disabled={materialBusy||!writable}>{materialBusy?"保存中…":"保存资料"}</button></div>
 </form>}</DialogContent></Dialog>
 <AlertDialog open={!!deleteTarget} onOpenChange={open=>{if(!open&&!materialBusy){setDeleteTarget(null);setMaterialError("");}}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除《{deleteTarget?.title}》？</AlertDialogTitle><AlertDialogDescription>该资料将从文学资料库和面试练习中移除。</AlertDialogDescription></AlertDialogHeader>{materialError&&<p className="form-error" role="alert">{materialError}</p>}<AlertDialogFooter><AlertDialogCancel disabled={materialBusy}>取消</AlertDialogCancel><AlertDialogAction className="delete-confirm" disabled={materialBusy||!writable} onClick={e=>{e.preventDefault();void deleteMaterial();}}>{materialBusy?"删除中…":"确认删除"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </>;
}
