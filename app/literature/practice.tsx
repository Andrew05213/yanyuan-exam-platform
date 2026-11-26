"use client";
import {useEffect,useState} from "react";
import {Dictation} from "./dictation";
import type {Material} from "./materials";
import {noteId,type Entry} from "./notes";

type Round={id:string;evidence:string;answer:string;feedback:string;revision:string};
const newRound=():Round=>({id:"note_"+crypto.randomUUID(),evidence:"",answer:"",feedback:"",revision:""});

function roundContent(work:Material,round:Round){
  return [
    work.question,
    "资料来源："+work.source,
    "我的依据："+round.evidence,
    "首次回答："+round.answer,
    round.feedback&&"AI 反馈："+round.feedback,
    round.revision&&"复练回答："+round.revision
  ].filter(Boolean).join("\n\n");
}

export function Practice({work,save,enabled,previous,owner}:{
  owner:string;previous:Entry[];work:Material;save:(note:Entry)=>Promise<Entry|null>;enabled:boolean;
}){
  const [round,setRound]=useState(newRound);
  const [notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
  const key="hezhi:oral:"+owner+":"+work.id;
  const {evidence,answer,feedback,revision}=round;
  const lastSaved=previous.find(note=>(note.folder??"active")==="active");

  useEffect(()=>{
    if(!owner||ready)return;
    try{
      const old=JSON.parse(localStorage.getItem(key)||"null");
      if(old?.question===work.question&&noteId(old.id)&&[old.evidence,old.answer,old.feedback,old.revision].every(x=>typeof x==="string")){
        const saved=previous.find(note=>note.id===old.id);
        if(saved?.content===roundContent(work,old)){
          localStorage.removeItem(key);
        }else{
          // Older clients could keep a saved round in local storage. If it was
          // edited afterward, recover the text as a new attempt.
          const id=saved||old.noteVersion>0?newRound().id:old.id;
          setRound({id,evidence:old.evidence,answer:old.answer,feedback:old.feedback,revision:old.revision});
          setNotice("已恢复这道题的本机作答。");
        }
      }
    }catch{setNotice("本机草稿读取失败，可手动保存作答。");}
    setReady(true);
  },[key,work,owner,previous,ready]);

  useEffect(()=>{
    if(!owner||!ready||!(round.evidence||round.answer||round.feedback||round.revision))return;
    try{localStorage.setItem(key,JSON.stringify({question:work.question,...round}));}
    catch{setNotice("本机草稿写入失败，请保存到学习档案。");}
  },[key,owner,ready,work.question,round]);

  function edit(change:Partial<Omit<Round,"id">>){
    setRound(current=>({...current,...change}));
  }

  async function review(){
    setBusy(true);setNotice("");
    try{
      const response=await fetch("/api/literature/feedback",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({topic:work.title,question:work.question,evidence,answer})
      });
      const data=await response.json() as {error?:string;model:string;feedback:string};
      if(!response.ok)throw Error(data.error||"请求失败");
      edit({feedback:data.model+"\n"+data.feedback});
    }catch(error){setNotice(error instanceof Error?error.message:"暂时无法获取反馈。");}
    finally{setBusy(false);}
  }

  async function archive(){
    setBusy(true);
    try{
      const submitted=round;
      const content=roundContent(work,submitted);
      const saved=await save({
        id:submitted.id,workId:work.id,title:"面试复练 · "+work.title,content,status:"在读",tags:"面试复练"
      });
      if(!saved)return;
      try{
        const cached=JSON.parse(localStorage.getItem(key)||"null");
        if(cached?.id===submitted.id&&roundContent(work,cached)===content)localStorage.removeItem(key);
      }catch{/* A saved attempt remains in the notebook if browser storage is unavailable. */}
      const next=newRound();
      setRound(current=>current===submitted?next:{...current,id:next.id});
      setNotice("已保存到读书笔记。可以开始下一轮。");
    }finally{setBusy(false);}
  }

  function quoteSelection(){
    const body=document.getElementById("note-body") as HTMLTextAreaElement|null;
    const text=body?.value.slice(body.selectionStart,body.selectionEnd).trim();
    if(!text){setNotice("先在笔记正文中选中一段文字，再点此按钮。");return;}
    const next=evidence?evidence+"\n"+text:text;
    if(next.length>4000){setNotice("摘录超出 4000 字，请缩短选区。");return;}
    edit({evidence:next,feedback:""});
    setNotice("已加入选段。");
  }

  return <details className="practice">
    <summary>开始专题面试训练</summary>
    <fieldset disabled={busy}>
      {lastSaved&&<details><summary>对照上一次保存的回答</summary><p style={{whiteSpace:"pre-wrap"}}>{lastSaved.content}</p></details>}
      <button type="button" disabled={!enabled} onClick={quoteSelection}>引用笔记选段</button>
      <p>表达提纲：提出判断 → 引用选段 → 解释细节 → 说明解释的边界。</p>
      <label>摘录一句原文或一项数据，注明出处<textarea maxLength={4000} value={evidence} onChange={e=>edit({evidence:e.target.value,feedback:""})}/></label>
      <label>你的首次回答<textarea maxLength={4000} value={answer} onChange={e=>edit({answer:e.target.value,feedback:""})}/></label>
      <button type="button" disabled={!enabled||!evidence.trim()||!answer.trim()} onClick={review}>获取 AI 点评和追问</button>
      <Dictation key={round.id} append={text=>setRound(current=>({...current,answer:(current.answer+text).slice(0,4000),feedback:""}))}/>
      {feedback&&<p style={{whiteSpace:"pre-wrap"}}>{feedback}</p>}
      <p>自评：你的结论由哪处细节支持？换一种解释还能说得通吗？</p>
      <label>根据反馈或自评，再答一次<textarea maxLength={4000} value={revision} onChange={e=>edit({revision:e.target.value})}/></label>
      <button type="button" disabled={!enabled||!answer.trim()} onClick={archive}>保存到学习档案</button>
    </fieldset>
    <p role="status">{busy?"正在处理…":notice}</p>
  </details>;
}
