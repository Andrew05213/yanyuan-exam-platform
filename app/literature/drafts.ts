import type {Entry} from "./notes";
export function draftKey(owner:string,id:string){return "hezhi:note:"+owner+":"+id;}
export function readDrafts(storage:Storage,owner:string):Entry[]{
 const prefix=draftKey(owner,""),drafts:Entry[]=[];
 for(let i=0;i<storage.length;i++){
  const key=storage.key(i);if(!key?.startsWith(prefix))continue;
  try{const n=JSON.parse(storage.getItem(key)||"null");
   if(n&&key===draftKey(owner,n.id)&&typeof n.title==="string"&&typeof n.content==="string")drafts.push(n);
  }catch{/* Ignore an unreadable draft without hiding the remaining notes. */}
 }
 return drafts;
}
