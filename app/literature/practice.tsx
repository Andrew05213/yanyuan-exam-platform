"use client";
import {Dictation} from "./dictation";
import type {Entry} from "./notes";
import {useEffect,useState} from 'react';
import type {Material} from './materials';
type Note={id:string;workId:string;title:string;content:string;status:string;tags?:string};
export function Practice({work,save,enabled,previous,owner}:{owner:string;previous:Entry[];work:Material;save:(n:Note)=>Promise<boolean>;enabled:boolean}){
  const [evidence,setEvidence]=useState(''),[answer,setAnswer]=useState(''),[feedback,setFeedback]=useState(''),[revision,setRevision]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[id,setId]=useState(()=> 'note_'+crypto.randomUUID());
  const key="hezhi:oral:"+owner+":"+work.id;
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    if(!owner)return;
    try{
      const old=JSON.parse(localStorage.getItem(key)||"null");
      if(old&&old.question===work.question&&[old.evidence,old.answer,old.feedback,old.revision,old.id].every(x=>typeof x==="string")){
        setEvidence(old.evidence);setAnswer(old.answer);setFeedback(old.feedback);setRevision(old.revision);setId(old.id);
        setNotice("已恢复这道题的本机作答。");
      }
    }catch{setNotice("本机草稿读取失败，可手动保存作答。");}
    setReady(true);
  },[key,work.question,owner]);
  useEffect(()=>{
    if(!owner||!ready||!(evidence||answer||feedback||revision))return;
    try{localStorage.setItem(key,JSON.stringify({question:work.question,evidence,answer,feedback,revision,id}));}
    catch{setNotice("本机草稿写入失败，请保存到学习档案。");}
  },[key,ready,owner,work.question,evidence,answer,feedback,revision,id]);
  async function review(){
    setBusy(true);setNotice('');
    try{
      const r=await fetch('/api/literature/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:work.title,question:work.question,evidence,answer})});
      const data=await r.json() as {error?:string;model:string;feedback:string};if(!r.ok)throw Error(data.error||'请求失败');
      setFeedback(data.model+'\n'+data.feedback);
    }catch(e){setNotice(e instanceof Error?e.message:'暂时无法获取反馈。')}finally{setBusy(false)}
  }
  async function archive(){
    setBusy(true);
    try{const ok=await save({id,workId:work.id,title:'面试复练 · '+work.title,content:[work.question,'资料来源：'+work.source,'我的依据：'+evidence,'首次回答：'+answer,feedback&&'AI 反馈：'+feedback,revision&&'复练回答：'+revision].filter(Boolean).join('\n\n'),status:'在读',tags:'面试复练'});if(ok){try{localStorage.removeItem(key)}catch{}setNotice('已保存两稿。继续修改会更新本条记录，另起一轮可重新打开作品。')}}finally{setBusy(false)}
  }
  return <details className="practice"><summary>开始专题面试训练</summary><fieldset disabled={busy}>{previous.length>0&&<details><summary>对照上一次保存的回答</summary><p style={{whiteSpace:"pre-wrap"}}>{previous[0].content}</p></details>}<button type="button" disabled={!enabled} onClick={()=>{
      const body=document.getElementById("note-body") as HTMLTextAreaElement|null;
      const text=body?.value.slice(body.selectionStart,body.selectionEnd).trim();
      if(!text){setNotice("先在笔记正文中选中一段文字，再点此按钮。");return;}
      if((evidence+"\n"+text).length>4000){setNotice("摘录超出 4000 字，请缩短选区。");return;}
      setEvidence(evidence ? evidence+"\n"+text : text);setFeedback("");setNotice("已加入选段。写下首次回答后即可生成点评和追问。");
    }}>引用笔记选段</button><p>表达提纲：提出判断 → 引用选段 → 解释细节 → 说明解释的边界。</p><label>摘录一句原文或一项数据，注明出处<textarea maxLength={4000} value={evidence} onChange={e=>{setEvidence(e.target.value);setFeedback('')}}/></label><label>你的首次回答<textarea maxLength={4000} value={answer} onChange={e=>{setAnswer(e.target.value);setFeedback('')}}/></label><button type="button" disabled={!enabled||!evidence.trim()||!answer.trim()} onClick={review}>获取 AI 点评和追问</button><Dictation append={text=>{setAnswer(v=>(v+text).slice(0,4000));setFeedback('')}}/>{feedback&&<p style={{whiteSpace:'pre-wrap'}}>{feedback}</p>}<p>自评：你的结论由哪处细节支持？换一种解释还能说得通吗？</p><label>根据反馈或自评，再答一次<textarea maxLength={4000} value={revision} onChange={e=>setRevision(e.target.value)}/></label><button type="button" disabled={!enabled||!answer.trim()} onClick={archive}>保存到学习档案</button></fieldset><p role="status">{busy?'正在处理…':notice}</p></details>
}
