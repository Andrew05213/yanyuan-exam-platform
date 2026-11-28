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
import {literatureLanguages,literaryGenres,languageName,metadataFor,searchLiterature} from "./world-literature";
import {workReadingNote,workNotePrefix,type Entry,type Folder} from "./notes";
import {draftKey,readDrafts} from "./drafts";
import {Notebook} from "./notebook";
import {AcademicEditor} from "./academic-editor";
import {Community} from "./community";
import {languageLabel,disciplineLabel} from "./research-catalog";
import {GovernanceGate} from "./governance";
import {ReviewDesk} from "./review-desk";
import {readingPaths} from "./paths";
import {oralLinks} from "./oral-links";
const newEntry=():Entry=>({id:"note_"+crypto.randomUUID(),title:"",content:"",status:"未开始"});
function Filter({value,onChange,items,label,disabled=false}:{value:string;onChange:(v:string)=>void;items:string[];label:string;disabled?:boolean}){return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{items.map(i=><SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent></Select>;}
const newMaterial=():Material=>({id:"material_"+crypto.randomUUID(),title:"",author:"",era:"近现代",theme:"",brief:"",guide:"",question:"",angles:[],source:"",sourceName:"",languageId:"unknown",originalTitle:"",originalAuthor:"",period:"",genre:"未分类",category:"文学"});
function noteWork(note:Entry,entries:Entry[],materials:Material[]){
 const work=materials.find(item=>item.id===(note.workId||note.id));
 return work&&(note.id===work.id||workReadingNote(entries,work)?.id===note.id)?work:null;
}
export default function Study({notebook=false}:{notebook?:boolean}){
 const [category,setCategory]=useState("全部"),[language,setLanguage]=useState(""),[genre,setGenre]=useState("");
 function selectLanguage(id:string){setLanguage(id);setEra("全部");}
 const languageNavigation=<div className="world-language-filter"><div className="research-language-nav" role="group" aria-label="文学语种"><button type="button" aria-pressed={!language} onClick={()=>selectLanguage("")}><strong>全部语言</strong><small>World literature</small></button>{literatureLanguages.filter(l=>l.tier==="core").map(l=><button type="button" key={l.id} aria-pressed={language===l.id} onClick={()=>selectLanguage(l.id)}><strong>{l.label}</strong><small>{l.native}</small></button>)}</div><details open={literatureLanguages.some(l=>l.id===language&&l.tier==="basic")||undefined}><summary>其他语言及未分类资料</summary><div className="research-language-nav">{literatureLanguages.filter(l=>l.tier==="basic").map(l=><button key={l.id} type="button" aria-pressed={language===l.id} onClick={()=>selectLanguage(l.id)}>{l.label}</button>)}</div></details></div>;
 const [returnTo,setReturnTo]=useState(notebook?"/reading-notes":"/literature");
 const [draftOwner,setDraftOwner]=useState("");
 const [localDrafts,setLocalDrafts]=useState<Entry[]>([]);
 const [storageFailed,setStorageFailed]=useState(false);
 const [autoCloudScope,setAutoCloudScope]=useState("");
 const editedNotes=useRef(new Map<string,Entry>());
 const autoAttempt=useRef("");
 const saveLock=useRef(false);
 const [conflict,setConflict]=useState<{draft:Entry;current:Entry|null}|null>(null);

 function editDraft(value:Entry){
   editedNotes.current.set(value.id,value);
   setDraft(value);
   if(!draftOwner)return;
   try{
     localStorage.setItem(draftKey(draftOwner,value.id),JSON.stringify(value));
     setLocalDrafts(old=>[value,...old.filter(n=>n.id!==value.id)]);
     setStorageFailed(false);
   }catch{setStorageFailed(true);}
 }
 function discard(id:string){
   editedNotes.current.delete(id);
   try{localStorage.removeItem(draftKey(draftOwner,id));setLocalDrafts(old=>old.filter(n=>n.id!==id));}
   catch{setStorageFailed(true);}
 }
 function recover(value:Entry){
   setAutoCloudScope("");autoAttempt.current="";
   setConflict(null);
   setActive(noteWork(value,entries,materials));
   setDraft({...value});setShowHints(false);
 }
 const [tab,setTab]=useState("library"),[query,setQuery]=useState(""),[era,setEra]=useState("全部"),[status,setStatus]=useState("全部"),[entries,setEntries]=useState<Entry[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[login,setLogin]=useState(false),[active,setActive]=useState<typeof works[number]|null>(null),[draft,setDraft]=useState<Entry|null>(null),[saving,setSaving]=useState(false),[showHints,setShowHints]=useState(false);
 const [materials,setMaterials]=useState<Material[]>(works),[materialDraft,setMaterialDraft]=useState<Material|null>(null),[deleteTarget,setDeleteTarget]=useState<Material|null>(null),[materialBusy,setMaterialBusy]=useState(false),[materialError,setMaterialError]=useState(""),[interviewDraft,setInterviewDraft]=useState<Material|null>(null);
 const materialsRef=useRef(materials); materialsRef.current=materials;

 const autoScope=draftOwner&&draft?JSON.stringify([draftOwner,draft.id]):"";
 const autoCloud=!!autoScope&&autoCloudScope===autoScope;
 const setAutoCloud=(enabled:boolean)=>setAutoCloudScope(enabled?autoScope:"");
 const secondaryPaper=active?furtherReading[active.id]:undefined;
 const writable=!loading&&!login&&!error;
 async function load(quiet=false){if(!quiet)setLoading(true);setError("");try {
 const [notesResponse,materialsResponse]=await Promise.all([fetch("/api/literature/entries"),fetch("/api/literature/materials")]);
 if(notesResponse.status===401||materialsResponse.status===401){setReturnTo(location.pathname+location.search+location.hash);setLogin(true);return;}
 if(!notesResponse.ok||!materialsResponse.ok)throw new Error();
 const [notesData,materialsData]=await Promise.all([notesResponse.json(),materialsResponse.json()]);
 const owner=notesResponse.headers.get("X-Draft-Owner")||"";
 setDraftOwner(owner);
 let drafts:Entry[]=[];
 if(owner)try{drafts=readDrafts(localStorage,owner);}catch{setStorageFailed(true);}
 setLocalDrafts(drafts);setEntries(notesData as Entry[]);if(notebook&&location.hash.startsWith("#note/")){
 const note=(notesData as Entry[]).find(n=>n.folder==="active"&&encodeURIComponent(n.id)===location.hash.slice(6));
 if(note){setDraft({...note});setActive(noteWork(note,notesData as Entry[],materialsData as Material[]));}
 }setMaterials(materialsData as Material[]);setLogin(false);
 }catch{setError("无法读取已保存内容，请重试。");}finally{setLoading(false);}}
 async function saveMaterial(candidate:Material|null=materialDraft,returnTab:"library"|"interview"="library"){if(!candidate)return;if(returnTab==="interview"&&!candidate.question.trim()){setMaterialError("请填写面试讨论题");return;}setMaterialBusy(true);setMaterialError("");try {
 const r=await fetch("/api/literature/materials",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(candidate)});
 const data=await r.json() as Material & {error?:string};if(!r.ok)throw new Error(data.error||"保存失败，请重试");
 setMaterials(prev=>{const exists=prev.some(w=>w.id===data.id);return exists?prev.map(w=>w.id===data.id?data:w):[...prev,data];});
 setMaterialDraft(null);setInterviewDraft(null);if(returnTab==="library"){setQuery("");setEra("全部");setStatus("全部");setGenre("");setLanguage(data.languageId==="unknown"?"":data.languageId||"");}setTab(returnTab);toast.success(returnTab==="interview"?"面试题已保存":"文学资料已保存");
 }catch(e){setMaterialError(e instanceof Error?e.message:"保存失败，请重试");}finally{setMaterialBusy(false);}}
 async function deleteMaterial(){if(!deleteTarget)return;setMaterialBusy(true);setMaterialError("");try {
 const r=await fetch("/api/literature/materials",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:deleteTarget.id})});
 if(!r.ok){const data=await r.json() as {error?:string};throw new Error(data.error||"删除失败，请重试");}
 setMaterials(prev=>prev.filter(w=>w.id!==deleteTarget.id));setDeleteTarget(null);toast.success("文学资料已删除");
 }catch(e){setMaterialError(e instanceof Error?e.message:"删除失败，请重试");}finally{setMaterialBusy(false);}}
 function editMaterial(w:Material){setMaterialError("");setMaterialDraft({...w,angles:[...w.angles]});}

 useEffect(()=>{
  if(notebook||location.hash!=="#notes"&&!location.hash.startsWith("#note/"))void load();
 },[notebook]);
 useEffect(()=>{
  if(notebook)return;
  const syncTab=()=>{
   const hash=location.hash.slice(1);
   if(hash==="notes"||hash.startsWith("note/")){
    location.replace("/reading-notes"+(hash==="notes"?"":"#"+hash));return;
   }
   setTab(["history","review","interview","community"].includes(hash)?hash:"library");
  };
  syncTab();
  window.addEventListener("hashchange",syncTab);
  return()=>window.removeEventListener("hashchange",syncTab);
 },[notebook]);
 function replaceEntry(entry:Entry){setEntries(previous=>[entry,...previous.filter(note=>note.id!==entry.id)]);}
 async function save(entry:Entry):Promise<Entry|null>{
  if(saveLock.current)return null;
  saveLock.current=true;
  const submittedEdit=editedNotes.current.get(entry.id);
  setSaving(true);
  try{
   const response=await fetch("/api/literature/entries",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(entry)});
   const result=await response.json() as {entry?:Entry;current?:Entry|null;error?:string};
   if(response.status===409&&draft?.id===entry.id){
    if(!localDrafts.some(note=>note.id===entry.id))editDraft(entry);
    setConflict({draft:entry,current:result.current??null});
    if(result.current)replaceEntry(result.current);
    return null;
   }
   if(!response.ok||!result.entry)throw new Error(result.error||"保存失败，请重试。");
   const saved=result.entry;
   const newer=editedNotes.current.get(entry.id);
   replaceEntry(saved);
   if(newer&&newer!==submittedEdit){
    const pending={...newer,revision:saved.revision,updated_at:saved.updated_at};
    editedNotes.current.set(entry.id,pending);
    if(draftOwner)try{localStorage.setItem(draftKey(draftOwner,pending.id),JSON.stringify(pending));setStorageFailed(false);}catch{setStorageFailed(true);}
    setLocalDrafts(old=>[pending,...old.filter(n=>n.id!==pending.id)]);
    setDraft(previous=>previous?.id===saved.id?pending:previous);
   }else{
    discard(entry.id);setDraft(previous=>previous?.id===saved.id?saved:previous);
   }
   setConflict(null);toast.success("已保存");
   return saved;
  }catch(error){toast.error(error instanceof Error?error.message:"保存失败，请重试。");return null;}
  finally{saveLock.current=false;setSaving(false);}
 }
 useEffect(()=>{
  if(!draft){setAutoCloudScope("");autoAttempt.current="";return;}
  if(!autoCloud||!writable||!draftOwner||saving||conflict||!draft.title.trim()||!localDrafts.some(n=>n.id===draft.id&&JSON.stringify(n)===JSON.stringify(draft)))return;
  const snapshot={...draft,workId:linkedWork(draft)||null};const key=JSON.stringify(snapshot);
  if(autoAttempt.current===key)return;
  const timer=setTimeout(()=>{autoAttempt.current=key;void save(snapshot);},4000);
  return()=>clearTimeout(timer);
 },[draft,autoCloud,writable,draftOwner,saving,conflict,localDrafts]);
 async function moveEntry(entry:Entry,folder:Folder){
  try{
   const response=await fetch("/api/literature/entries",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:entry.id,revision:entry.revision,folder})});
   const result=await response.json() as {entry?:Entry;current?:Entry;error?:string};
   if(result.current)replaceEntry(result.current);
   if(!response.ok||!result.entry)throw new Error(result.error||"移动失败，请重试。");
   replaceEntry(result.entry);
   toast.success(folder==="archived"?"已归档":folder==="trash"?"已移入回收站":"已恢复到笔记");
  }catch(error){toast.error(error instanceof Error?error.message:"移动失败，请重试。");}
 }
 useEffect(()=>{if(notebook)return;const ctx=(document as any).modelContext;if(!ctx?.registerTool)return;const life=new AbortController();try{Promise.resolve(ctx.registerTool({name:"search_literature",description:"搜索文学条目并显示资料库结果",inputSchema:{type:"object",properties:{query:{type:"string"},language:{type:"string",enum:literatureLanguages.map(l=>l.id)}},required:["query"],additionalProperties:false},annotations:{readOnlyHint:true},execute(input:any){if(typeof input?.query!=="string")throw new Error("query must be string");const lang=typeof input.language==="string"?input.language:"";if(lang&&!literatureLanguages.some(l=>l.id===lang))throw Error("invalid language");setTab("library");setQuery(input.query);setLanguage(lang);setCategory("全部");setGenre("");setEra("全部");setStatus("全部");return {results:searchLiterature(materialsRef.current,{query:input.query,language:lang}).map(w=>({id:w.id,workId:w.id,title:w.title,languageId:metadataFor(w).languageId}))};}},{signal:life.signal})).catch(()=>{});}catch{}return()=>life.abort();},[notebook]);
 const state=(work:Material)=>workReadingNote(entries,work)?.status||"未开始";
 const researchById=new Map(researchCatalog.map(item=>[item.id,item]));
 const found=searchLiterature(materials,{language,category,era,genre,query}).filter(w=>status==="全部"||state(w)===status);
 const completed=materials.filter(w=>state(w)==="已读").length;
 function linkedWork(e:Entry){
   if(e.workId!==undefined && e.workId!==null)return e.workId;
   if(!e.id.startsWith("note_"))return e.id;
   const matches=materials.filter(w=>e.title===w.title+" · 读书笔记"&&e.content.startsWith("作品： "+w.title+"\n") || e.title==="面试复练 · "+w.title&&!!w.question&&e.content.startsWith(w.question+"\n"));
   return matches.length===1?matches[0].id:"";
 }
 function open(w:typeof works[number]){
  setActive(w);setConflict(null);
  const note=workReadingNote(entries,w);
  if(note&&(note.folder??"active")==="active"){
   setDraft(note);
  }else{
   const id=entries.some(entry=>entry.id===w.id)?workNotePrefix+crypto.randomUUID():w.id;
   setDraft({id,workId:w.id,title:w.title,content:"",status:note?.status??"未开始",sourceLanguage:languageName(metadataFor(w).languageId),discipline:metadataFor(w).category});
  }
  setShowHints(false);
 }

 const relatedNotes=active?entries.filter(note=>
  note.id!==draft?.id&&(note.folder??"active")==="active"&&linkedWork(note)===active.id
 ):[];

 const deepLinkChecked=useRef(false);
 useEffect(()=>{
   if(notebook||loading||deepLinkChecked.current)return;
   deepLinkChecked.current=true;
   const id=new URLSearchParams(location.search).get("work");
   const w=materials.find(m=>m.id===id);if(w)open(w);
 },[loading,materials,notebook]);
 return <><Toaster richColors/>
 <header className="masthead">
  <a className="brand" href="/"><img src="/assets/mark.svg" width={36} height={36} alt=""/><strong>和知 AI</strong></a>
  <nav className="module-links" aria-label="模块导航">
   <a href="/literature" aria-current={notebook?undefined:"page"}>全球文学研习</a>
   <a href="/reading-notes" aria-current={notebook?"page":undefined}>研究与读书笔记</a>
   <a href="/#oral">口试训练</a>
  </nav>
 </header>
 <main className="shell">
  {notebook?<header className="notebook-intro">
   <img src="/assets/sansui-study.webp" width={1440} height={960} alt=""/>
   <h1>研究与读书笔记</h1>
   <p>记录读过的作品、摘录与面试复练。</p>
   <span className="private"><Lock size={15}/> 仅本人可见</span>
  </header>:<header className="intro">
   <div><h1>全球文学研习</h1><p className="sub">按原作语种探索文学、比较阅读与研究专题；保留原有日本文学资料。</p></div>
   <div className="reading-summary"><BookOpen size={22}/><strong>{completed}<span> / {materials.length}</span></strong><span>已读条目</span><Progress value={materials.length?completed/materials.length*100:0} aria-label="已读比例"/></div>
  </header>}
 {login&&<div className="notice">登录后可保存笔记和阅读进度。<a href={"/signin-with-chatgpt?return_to="+encodeURIComponent(returnTo)} target="_top">登录学习账号</a></div>}{error&&<div className="notice" role="alert">{error}<button onClick={()=>void load()}>重新读取</button></div>}
 {writable&&localDrafts.length>0&&<details className="notice"><summary>本机有 {localDrafts.length} 篇未提交的笔记草稿</summary>{localDrafts.map(n=><p key={n.id}>{n.title||"无标题笔记"}　<button onClick={()=>recover(n)}>恢复草稿</button>　<button onClick={()=>discard(n.id)}>丢弃草稿</button></p>)}</details>}
 {notebook?<Notebook entries={entries} materials={materials} loading={loading} writable={writable} workId={linkedWork} create={()=>recover(newEntry())} open={recover} reload={()=>load(true)} move={moveEntry}/>:<Tabs value={tab} onValueChange={value=>{setTab(value);history.replaceState(null,"","#"+value);}}><TabsList className="navigation" variant="line"><TabsTrigger value="library"><Library/>研究资料</TabsTrigger><TabsTrigger value="history"><BookOpen/>文学脉络</TabsTrigger><TabsTrigger value="interview"><Mic/>面试练习</TabsTrigger><TabsTrigger value="review">复习与进度</TabsTrigger>{writable&&<TabsTrigger value="community">研究社区</TabsTrigger>}</TabsList>
 <TabsContent value="library"><section className="section-heading"><div><h2>作品与研究专题</h2><p>按原作语种、作者、原文书名、时代、体裁与主题检索。新增条目为原创导读，非作品全文；具体版本与阅读权限请核对来源。</p></div><div className="library-actions"><span className="muted">{found.length} 个条目</span><button className="primary" disabled={!writable} onClick={()=>{setMaterialError("");setMaterialDraft({...newMaterial(),languageId:language||"unknown"});}}><Plus size={17}/>新增资料</button></div></section>{languageNavigation}<div className="filters world-filters"><label className="search"><Search size={18}/><input aria-label="搜索文学资料" placeholder="作品、原文书名、作者、主题" value={query} onChange={e=>setQuery(e.target.value)}/></label><Filter value={category} onChange={setCategory} items={["全部","文学","传统文化","近现代社会"]} label="筛选资料类别"/><Filter value={era} onChange={setEra} items={["全部",...eras.map(e=>e.title)]} label="筛选文学时代"/><select aria-label="筛选体裁" value={genre} onChange={e=>setGenre(e.target.value)}><option value="">全部体裁</option>{literaryGenres.map(g=><option key={g}>{g}</option>)}</select><Filter value={status} onChange={setStatus} items={["全部","未开始","在读","已读"]} label="筛选阅读状态"/></div><button type="button" className="text-button world-reset" onClick={()=>{setLanguage("");setCategory("全部");setEra("全部");setGenre("");setQuery("");setStatus("全部");}}>清除全部筛选</button><div className="grid">{found.map(w=><article className="material-card" key={w.id}><button className="work-card" onClick={()=>open(w)}><div className="card-top"><span>{languageName(metadataFor(w).languageId)} · {metadataFor(w).period||researchById.get(w.id)?.group||w.era} / {w.author}</span><span className="status">{state(w)}</span></div><h3>{w.title}</h3>{w.originalTitle&&w.originalTitle!==w.title&&<small dir="auto" className="muted">{w.originalTitle}</small>}{w.originalAuthor&&w.originalAuthor!==w.author&&<small dir="auto" className="muted">{w.originalAuthor}</small>}<p>{w.brief}</p><div className="card-foot"><span>{w.theme}</span><BookOpen size={18}/></div></button><div className="material-actions"><button disabled={!writable} onClick={()=>editMaterial(w)} aria-label={"编辑"+w.title}><PenLine size={16}/>编辑</button><button className="danger-link" disabled={!writable} onClick={()=>{setMaterialError("");setDeleteTarget(w);}} aria-label={"删除"+w.title}><Trash2 size={16}/>删除</button></div></article>)}</div>{!found.length&&<div className="empty">没有符合条件的条目。试试其他关键词或筛选条件。</div>}</TabsContent>
 <TabsContent value="community">{writable?<GovernanceGate><Community entries={entries} refreshNotes={()=>load(true)}
   createNote={(topic,source)=>recover({...newEntry(),title:source?"回应："+source.title:topic.title,language:"中文",sourceLanguage:source?.sourceLanguage||(topic.languageId?languageLabel(topic.languageId):""),discipline:source?.discipline||(topic.discipline?disciplineLabel(topic.discipline):""),content:"研究问题："+topic.title+"\n\n"+(topic.description?"研究范围与检索线索：\n"+topic.description+"\n\n":"")+"文本或文献依据（待核对）：\n\n尚待研究：\n"})}/></GovernanceGate>
   :<p role="status">{login?"登录后查看研究社区。":error?"暂时无法检查社区访问权限。":!writable?"正在读取社区…":"正在读取社区…"}</p>}</TabsContent>
 <TabsContent value="review">{writable?<ReviewDesk entries={entries.filter(entry=>entry.folder==="active")} materials={materials} edit={recover} open={open}/>:<p>登录并加载个人档案后可查看学习进度。</p>}</TabsContent>
 <TabsContent value="history">
  <section className="section-heading"><div><h2>全球文学脉络</h2>
   <p>按原作语种和宽泛阅读时期组织；各语言实际分期以作品专属时期标签为准，不把日本朝代套用于其他文学。</p>
  </div></section>
  {languageNavigation}<section className="notebook-tools"><h3>比较阅读路线</h3>{readingPaths.map(path=><details key={path.title}><summary>{path.title}</summary><p>{path.question}</p>{path.ids.map(id=>materials.find(m=>m.id===id)).filter(w=>!!w).map(w=><button key={w.id} onClick={()=>open(w)}>{w.title}</button>)}</details>)}</section>
  <div className="literary-periods">
   {eras.map((period,index)=>{
    const periodWorks=searchLiterature(materials,{language,era:period.title,category:"文学"});
    const globalPeriod=["早期与古典","古典与中古","中古传统","近世与早期近代","近现代"][index];
    return <section key={period.title} className="literary-period" aria-labelledby={`period-${period.title}`}>
     <small className="muted">{language==="ja"?period.date:"粗略阅读分组"} · {periodWorks.length} 部作品</small>
     <h3 id={`period-${period.title}`}>{language==="ja"?period.title:globalPeriod}</h3>
     {language==="ja"&&<p>{period.text}</p>}
     {periodWorks.length?<div className="grid">
      {periodWorks.map(work=><button type="button" key={work.id} className="work-card" onClick={()=>open(work)}>
       <div className="card-top"><span>{languageName(metadataFor(work).languageId)} · {metadataFor(work).period||work.era} / {work.author}</span><span className="status">{state(work)}</span></div>
       <h4>{work.title}</h4><p>{work.brief}</p><div className="card-foot">打开研读与笔记 <BookOpen size={16}/></div>
      </button>)}
     </div>:<p className="muted">本时期暂无收录作品。</p>}
    </section>;
   })}
  </div>
  {language==="ja"&&<p className="source-line">日本文学分期参考 <a href="https://www.nijl.ac.jp/etenji/bungakushi/contents/" target="_blank" rel="noreferrer">国文学研究资料馆 · 日本古典文学史</a></p>}
 </TabsContent>
 <TabsContent value="interview"><section className="section-heading"><div><h2>把阅读转化为表达</h2><p>每题约 90 秒：明确观点，用文本举例，再说明观点的边界。</p></div></section>{languageNavigation}<div className="questions">{searchLiterature(materials,{language}).filter(w=>w.question).map((w,i)=><article key={w.id}><span className="question-number">{String(i+1).padStart(2,"0")}</span><div><small>{languageName(metadataFor(w).languageId)} · {w.title} · {w.theme}</small><h3>{w.question}</h3><div className="interview-actions"><button className="text-button" onClick={()=>open(w)}>准备回答与记录</button><button className="text-button edit-question" disabled={!writable} aria-label={"编辑"+w.title+"面试题"} onClick={()=>{setMaterialError("");setInterviewDraft({...w,angles:[...w.angles]});}}><PenLine size={16}/>编辑</button></div></div></article>)}</div><p className="source-line">以上为学习练习题，不代表学校官方考题。可以在条目笔记中保存回答提纲。</p></TabsContent>
 </Tabs>}</main><nav className="literature-mobile-dock" aria-label="快捷导航"><a href="/#today">首页</a><a href="/#schools">学习</a><a href="/reading-notes" aria-current={notebook?"page":undefined}>笔记</a><a href="/literature#community">研究</a><a href="/#saved">档案</a></nav>
 <Dialog open={!!draft} onOpenChange={o=>{if(!o&&!saving){setDraft(null);setActive(null);setConflict(null);}}}><DialogContent className="editor notebook-editor"><DialogHeader><DialogTitle>{active?active.title:"读书笔记"}</DialogTitle><DialogDescription>{active?languageName(metadataFor(active).languageId)+" · "+active.author+" · "+(active.period||active.era):"写下你的阅读与思考，点击保存后长期保留。"}</DialogDescription></DialogHeader>{active&&writable&&<button type="button" className="text-button jump-to-note" onClick={()=>document.getElementById("note-body")?.focus()}>直接写笔记 ↓</button>}{active&&<div className="reading-guide"><h4>阅读切入点</h4>{active.originalTitle&&<p dir="auto">{active.originalTitle} · {active.originalAuthor}</p>}<p>{active.guide||"记录你的阅读重点与文本依据。"}</p>{active.source&&<a href={active.source} target="_blank" rel="noreferrer">{paperInfo[active.source]||active.sourceName||"参考来源"}</a>}{secondaryPaper&&<p><a href={secondaryPaper[1]} target="_blank" rel="noreferrer">{paperInfo[secondaryPaper[1]]||secondaryPaper[0]} · 知网</a></p>}{active.id==="research_18"&&<p>作者依据图书馆目录校正为山冈庄八。<a href="https://opac.lib.uibe.edu.cn/opac/book/21d7aac32e24bc564ad189cf6c68b2d9" target="_blank" rel="noreferrer">核对馆藏书目</a></p>}{active.question&&<div className="prompt"><small>面试思考</small><h4>{active.question}</h4><button className="text-button" onClick={()=>setShowHints(!showHints)}>{showHints?"收起思路":"查看展开思路"}</button>{showHints&&<ol>{active.angles.map(a=><li key={a}>{a}</li>)}</ol>}</div>}</div>}{active&&<button type="button" className="text-button" disabled={!writable} onClick={()=>{const title=active.title;setActive(null);editDraft({...newEntry(),workId:active.id,title:title+" · 读书笔记",content:"作品： "+title+"\n\n摘录与页码：\n\n阅读感想：\n\n值得追问的问题：\n"});}}>为这部作品新建一篇笔记</button>}{active&&<section><h4>这部作品的笔记</h4>{relatedNotes.length===0?<p>尚无独立笔记。</p>:relatedNotes.map(n=><p key={n.id}><button className="text-button" onClick={()=>recover(n)}>{n.title}</button></p>)}</section>}{active&&<details className="notebook-tools"><summary>关联阅读与口试</summary>{readingPaths.filter(p=>p.ids.includes(active.id)).map(p=><section key={p.title}><h4>{p.title}</h4><p>{p.question}</p>{p.ids.filter(id=>id!==active.id).map(id=>materials.find(m=>m.id===id)).filter(w=>!!w).map(w=><button key={w.id} onClick={()=>open(w)}>{w.title}</button>)}</section>)}{oralLinks.filter(t=>t.works.includes(active.id)).map(t=><p key={t.id}><a href={"/?readingPractice=ja#task/pku/"+t.id}>{t.title} →</a></p>)}<p>本条目的专题面试可在下方练习。</p></details>}
 {(()=>{const work=active || (draft && materials.find(m=>m.id===linkedWork(draft)));return work && <Practice owner={draftOwner} key={draftOwner+work.id} work={work} save={save} enabled={writable} previous={entries.filter(n=>linkedWork(n)===work.id&&(n.tags?.includes("面试复练")||n.title.startsWith("面试复练 · ")))}/>})()} {draft&&localDrafts.some(n=>n.id===draft.id&&JSON.stringify(n)!==JSON.stringify(draft))&&<button className="text-button" onClick={()=>recover(localDrafts.find(n=>n.id===draft.id)!)}>恢复这篇笔记的本机草稿</button>}{conflict&&<div className="notice" role="alert"><strong>云端笔记已有变动</strong><p>你的草稿仍保存在本机。可以打开当前版本对照，或将草稿另存为一篇笔记。</p>{conflict.current?.folder==="active"&&<button type="button" onClick={()=>recover(conflict.current!)}>打开云端版本</button>}<button type="button" onClick={()=>{const original=conflict.draft;setActive(null);setConflict(null);editDraft({...original,id:newEntry().id,workId:linkedWork(original),folder:"active",revision:0});}}>另存为新笔记</button></div>}{draft&&<form onSubmit={async e=>{e.preventDefault();await save({...draft,workId:linkedWork(draft)||null});}}><fieldset disabled={saving||!writable} style={{border:0,padding:0,margin:0}}>{!active&&<label>关联作品<select value={linkedWork(draft)} onChange={e=>editDraft({...draft,workId:e.target.value})}><option value="">独立笔记</option>{materials.map(w=><option value={w.id} key={w.id}>{w.title}</option>)}</select></label>}<label>标题<input required maxLength={200} value={draft.title} onChange={e=>editDraft({...draft,title:e.target.value})}/></label><div className="status-row"><label>阅读状态</label><Filter value={draft.status} onChange={v=>editDraft({...draft,status:v})} items={["未开始","在读","已读"]} label="选择阅读状态"/></div><details className="note-fields"><summary>语种、学科与复习设置</summary><div className="field-pair"><label>笔记语种<input maxLength={100} value={draft.language||""} onChange={e=>editDraft({...draft,language:e.target.value})}/></label><label>原文语种<input maxLength={100} value={draft.sourceLanguage||""} onChange={e=>editDraft({...draft,sourceLanguage:e.target.value})}/></label></div><label>学科<input maxLength={100} value={draft.discipline||""} onChange={e=>editDraft({...draft,discipline:e.target.value})}/></label><label>主题标签（逗号分隔）<input maxLength={300} value={draft.tags||""} onChange={e=>editDraft({...draft,tags:e.target.value})}/></label><label>版本、章节或页码<input maxLength={300} value={draft.locator||""} onChange={e=>editDraft({...draft,locator:e.target.value})}/></label><label>下次复习<input type="date" value={draft.reviewOn||""} onChange={e=>editDraft({...draft,reviewOn:e.target.value})}/></label></details><AcademicEditor key={draft.id} value={draft.content} onChange={content=>editDraft({...draft,content})} label={active?"阅读笔记 / 面试回答提纲":"正文"} noteId={draft.id} revision={draft.revision??0} onRestore={v=>{if(window.confirm("将旧标题和正文载入草稿？当前未提交的修改将被替换，云端不变，直到保存。")){setAutoCloud(false);editDraft({...draft,title:v.title,content:v.content});}}}/><label className="academic-autosave"><input type="checkbox" checked={autoCloud} onChange={e=>{autoAttempt.current="";setAutoCloud(e.target.checked);}}/> 本次编辑启用云端自动保存（停笔4秒；失败或冲突需手动处理）</label><div className="save-row"><span role="status">{!writable?"登录并加载笔记后可编辑":storageFailed?"本机草稿存储不可用，请点击保存":localDrafts.some(n=>n.id===draft.id)?"草稿已保存在本机，点击保存可同步":"编辑后自动保留本机草稿"}</span><button className="primary" type="submit" disabled={saving||loading||login||!!error||!!conflict}>{saving?"保存中…":"保存"}</button></div></fieldset></form>}</DialogContent></Dialog>
 <Dialog open={!!interviewDraft} onOpenChange={open=>{if(!open&&!materialBusy){setInterviewDraft(null);setMaterialError("");}}}><DialogContent className="editor interview-editor"><DialogHeader><DialogTitle>编辑面试题</DialogTitle><DialogDescription>{interviewDraft?.title} · {interviewDraft?.theme}</DialogDescription></DialogHeader>{interviewDraft&&<form onSubmit={e=>{e.preventDefault();void saveMaterial(interviewDraft,"interview");}}>
 <label>面试讨论题<textarea required disabled={materialBusy} maxLength={2000} className="short-text" value={interviewDraft.question} onChange={e=>setInterviewDraft({...interviewDraft,question:e.target.value})}/></label>
 <label>展开思路（每行一条）<textarea disabled={materialBusy} value={interviewDraft.angles.join("\n")} onChange={e=>setInterviewDraft({...interviewDraft,angles:e.target.value.split("\n")})} placeholder="明确核心观点\n引用文本依据\n讨论观点的边界"/></label>
 {materialError&&<p className="form-error" role="alert">{materialError}</p>}
 <div className="save-row"><span>保存后同步到对应文学资料</span><button className="primary" type="submit" disabled={materialBusy||!writable}>{materialBusy?"保存中…":"保存修改"}</button></div>
 </form>}</DialogContent></Dialog>
 <Dialog open={!!materialDraft} onOpenChange={open=>{if(!open&&!materialBusy){setMaterialDraft(null);setMaterialError("");}}}><DialogContent className="editor material-editor"><DialogHeader><DialogTitle>{materials.some(w=>w.id===materialDraft?.id)?"编辑文学资料":"新增文学资料"}</DialogTitle><DialogDescription>填写作品信息；阅读切入点、面试问题和参考来源可稍后补充。</DialogDescription></DialogHeader>{materialDraft&&<form onSubmit={e=>{e.preventDefault();void saveMaterial();}}>
 <div className="field-pair"><label>作品 / 资料名称 *<input required maxLength={200} value={materialDraft.title} onChange={e=>setMaterialDraft({...materialDraft,title:e.target.value})} placeholder="例如：金阁寺"/></label><label>作家 / 作者 *<input required maxLength={200} value={materialDraft.author} onChange={e=>setMaterialDraft({...materialDraft,author:e.target.value})} placeholder="例如：三岛由纪夫"/></label></div>
 <div className="field-pair"><label>原作语种<select aria-label="资料原作语种" value={metadataFor(materialDraft).languageId} onChange={e=>setMaterialDraft({...materialDraft,languageId:e.target.value})}>{literatureLanguages.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></label><label>体裁<select value={metadataFor(materialDraft).genre} onChange={e=>setMaterialDraft({...materialDraft,genre:e.target.value})}>{literaryGenres.map(g=><option key={g}>{g}</option>)}</select></label></div><div className="field-pair"><label>原文书名<input maxLength={200} value={materialDraft.originalTitle||""} onChange={e=>setMaterialDraft({...materialDraft,originalTitle:e.target.value})}/></label><label>原文作者名<input maxLength={200} value={materialDraft.originalAuthor||""} onChange={e=>setMaterialDraft({...materialDraft,originalAuthor:e.target.value})}/></label></div><div className="field-pair"><label>实际文学时期<input maxLength={200} value={materialDraft.period||""} onChange={e=>setMaterialDraft({...materialDraft,period:e.target.value})} placeholder="如现实主义、明治、文艺复兴"/></label><label>资料类别<select value={metadataFor(materialDraft).category} onChange={e=>setMaterialDraft({...materialDraft,category:e.target.value})}>{["文学","传统文化","近现代社会"].map(c=><option key={c}>{c}</option>)}</select></label></div><div className="field-pair"><label>宽泛阅读时期 *<Filter disabled={materialBusy} value={materialDraft.era} onChange={v=>setMaterialDraft({...materialDraft,era:v})} items={eras.map(e=>e.title)} label="资料时代"/></label><label>主题 *<input required maxLength={100} value={materialDraft.theme} onChange={e=>setMaterialDraft({...materialDraft,theme:e.target.value})} placeholder="例如：美与毁灭"/></label></div>
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
