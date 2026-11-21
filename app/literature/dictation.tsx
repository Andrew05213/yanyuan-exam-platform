"use client";
import {useEffect,useRef,useState} from "react";
export function Dictation({append}:{append:(s:string)=>void}){
 const ref=useRef<any>(null),[active,setActive]=useState(false),[notice,setNotice]=useState(""),[lang,setLang]=useState("zh-CN");
 const callback=useRef(append);callback.current=append;
 useEffect(()=>()=>{if(ref.current){ref.current.onresult=null;ref.current.onend=null;ref.current.onerror=null;ref.current.abort();}},[]);
 function toggle(){
  if(active){ref.current?.stop();return;}
  const w=window as any,Recognition=w.SpeechRecognition||w.webkitSpeechRecognition;
  if(!Recognition){setNotice("此浏览器未提供语音识别，可用键盘或系统听写输入。");return;}
  try{const rec=new Recognition();ref.current=rec;rec.lang=lang;rec.interimResults=false;rec.continuous=true;
   rec.onresult=(ev:any)=>{for(let i=ev.resultIndex;i<ev.results.length;i++)if(ev.results[i].isFinal)callback.current(ev.results[i][0].transcript);};
   rec.onerror=()=>setNotice("听写中断，请检查麦克风权限或改用键盘。");rec.onend=()=>setActive(false);
   rec.start();setActive(true);setNotice("");
  }catch{setActive(false);setNotice("当前设备无法启动听写。");}
 }
 return <details><summary>语音输入首次回答</summary><p>启用后由浏览器处理麦克风音频，部分浏览器会发送给其语音服务。转写后可修改。</p><select aria-label="听写语言" value={lang} disabled={active} onChange={e=>setLang(e.target.value)}><option value="zh-CN">中文</option><option value="ja-JP">日语</option><option value="en-US">英语</option></select> <button type="button" onClick={toggle}>{active?"停止听写":"启用麦克风听写"}</button><p role="status">{notice}</p></details>
}
