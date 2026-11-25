export type Entry={id:string;workId?:string|null;title:string;content:string;status:string;updated_at?:string;tags?:string;locator?:string;reviewOn?:string;language?:string|null;sourceLanguage?:string|null;discipline?:string|null};
export function validEntry(n:unknown):n is Entry {
  if(!n||typeof n!=="object")return false;
  const e=n as Entry;
  const id=(s:unknown)=>typeof s==="string"&&/^[a-zA-Z0-9_-]{1,100}$/.test(s);
  return id(e.id)&&(!e.workId||id(e.workId))&&typeof e.title==="string"&&!!e.title.trim()&&e.title.length<=200&&typeof e.content==="string"&&e.content.length<=100000&&["未开始","在读","已读"].includes(e.status)&&
    [e.language,e.sourceLanguage,e.discipline].every(s=>s==null||typeof s==="string"&&s.length<=100)&&
    [e.tags,e.locator].every(s=>s==null||typeof s==="string"&&s.length<=300)&&
    (!e.reviewOn||typeof e.reviewOn==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(e.reviewOn));
}
export function parseBackup(value:unknown):Entry[]{
  const b=value as {format?:string;entries?:Entry[]}|null;
  if(b?.format!=="hezhi-notes-v1"||!Array.isArray(b.entries)||!b.entries.every(validEntry))throw Error("文件格式或笔记字段无效。");
  return b.entries;
}
