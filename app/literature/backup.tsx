"use client";
import {useState} from "react";
import {parseBackup,type Entry} from "./notes";
import {works} from "./data";
import {validateMaterial,type Material} from "./materials";
export function Backup({entries,materials,reload}:{entries:Entry[];materials:Material[];reload:()=>Promise<void>}){
 const [message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 function download(){
  const changedMaterials=materials.filter(w=>{const base=works.find(x=>x.id===w.id);return !base||JSON.stringify(validateMaterial(base))!==JSON.stringify(validateMaterial(w))});
  const url=URL.createObjectURL(new Blob([JSON.stringify({format:"hezhi-notes-v1",entries,materials:changedMaterials},null,2)],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download="和知 AI笔记-"+new Date().toISOString().slice(0,10)+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function restore(file:File){
  setBusy(true);let count=0;
  try{
   const payload=JSON.parse(await file.text());
   const notes=parseBackup(payload),works=payload.materials??[];
   if(!Array.isArray(works)||!works.every(w=>validateMaterial(w)))throw Error("作品资料格式有误。");
   let workCount=0;
   for(let i=0;i<works.length;i+=20){
    const r=await fetch("/api/literature/materials",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({materials:works.slice(i,i+20)})});
    if(!r.ok)throw Error("恢复资料时中断，可重试。");
    workCount+=((await r.json()) as {changed:number}).changed;
   }
   for(let i=0;i<notes.length;i+=20){
    const r=await fetch("/api/literature/entries",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({entries:notes.slice(i,i+20)})});
    if(!r.ok)throw Error("导入中断，可用同一文件重试。");
    count+=((await r.json()) as {changed:number}).changed;
   }
   setMessage("已恢复 "+workCount+" 份资料。已导入 "+count+" 条，跳过 "+(notes.length-count)+" 条已有记录。");
  }catch(e){setMessage("本次已导入 "+count+" 条。"+(e instanceof Error?e.message:"导入失败"));}
  finally{await reload();setBusy(false);}
 }
 return <details className="notebook-tools"><summary>备份与恢复</summary><p>备份自建与修改过的资料、已保存的笔记、作品关联、语种、学科、阅读状态和复习日期。导入时保留账号中已有的同编号笔记。</p><button onClick={download}>下载 JSON 备份</button><label>导入笔记备份 <input type="file" accept=".json,application/json" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void restore(file)}}/></label><p role="status">{busy?"正在导入…":message}</p></details>;
}
