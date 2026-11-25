export const folders=["active","archived","trash"] as const;
export type Folder=typeof folders[number];
export type Entry={id:string;workId?:string|null;title:string;content:string;status:string;updated_at?:string;tags?:string|null;locator?:string|null;reviewOn?:string|null;revision?:number;folder?:Folder;language?:string|null;sourceLanguage?:string|null;discipline?:string|null};
export const noteId=(value:unknown):value is string=>typeof value==="string"&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);

export function dueNotes(entries:Entry[],now=new Date()){
 const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
 return entries.filter(entry=>(!entry.folder||entry.folder==="active")&&entry.reviewOn&&entry.reviewOn<=today)
   .sort((a,b)=>(a.reviewOn??"").localeCompare(b.reviewOn??""));
}
export function validEntry(n:unknown):n is Entry {
  if(!n||typeof n!=="object")return false;
  const e=n as Entry;
  return noteId(e.id)&&(!e.workId||noteId(e.workId))&&typeof e.title==="string"&&!!e.title.trim()&&e.title.length<=200&&typeof e.content==="string"&&e.content.length<=100000&&["未开始","在读","已读"].includes(e.status)&&
    (e.folder===undefined||folders.includes(e.folder))&&
    [e.language,e.sourceLanguage,e.discipline].every(s=>s==null||typeof s==="string"&&s.length<=100)&&
    [e.tags,e.locator].every(s=>s==null||typeof s==="string"&&s.length<=300)&&
    (!e.reviewOn||typeof e.reviewOn==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(e.reviewOn));
}
export function parseBackup(value:unknown):Entry[]{
  const b=value as {format?:string;entries?:Entry[]}|null;
  if(b?.format!=="hezhi-notes-v1"||!Array.isArray(b.entries)||!b.entries.every(validEntry))throw Error("文件格式或笔记字段无效。");
  return b.entries;
}
