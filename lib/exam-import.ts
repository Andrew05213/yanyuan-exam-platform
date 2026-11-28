import {validateMaterial} from "./material-contracts";
export function field(v:unknown,max:number,required=true){if(typeof v!=="string"||v.length>max||(required&&!v.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw Error("字段缺失或过长。");return v.trim();}
export function origin(v:any){const source=field(v.source,500),sourceUrl=field(v.sourceUrl??"",1000,false),rights=field(v.rights,30);if(sourceUrl){const u=new URL(sourceUrl);if(u.protocol!=="https:"||u.username||u.password)throw Error("出处链接须为安全HTTPS地址。");}
 if(!["original","permission","public-domain","private-use"].includes(rights)||v.confirm!==true)throw Error("请确认合法来源及私人学习使用权限。");return {source,sourceUrl,rights};}
export function fileType(name:string,b:Uint8Array){const e=name.split(".").pop()?.toLowerCase(),head=String.fromCharCode(...b.slice(0,5));if(!b.length)throw Error("文件为空。");if(e==="pdf"&&head==="%PDF-")return "application/pdf";if(e==="docx"&&b[0]===80&&b[1]===75&&b[2]===3&&b[3]===4)return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";if(e==="png"&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))return "image/png";if(["jpg","jpeg"].includes(e||"")&&b[0]===255&&b[1]===216&&b[2]===255)return "image/jpeg";if(e==="txt"||e==="json"){const t=new TextDecoder("utf-8",{fatal:true}).decode(b);if(e==="json")JSON.parse(t);return e==="json"?"application/json":"text/plain;charset=utf-8";}throw Error("不支持的文件类型或文件头不匹配。");}
export function groups(v:unknown,source:{source:string;sourceUrl:string}){
 if(!Array.isArray(v)||v.length>10)throw Error("每份文件最多10个题组。");
 let total=0;return v.map((g:any,i)=>{
  const locator=field(g.locator,150),questions=g.questions;if(!Array.isArray(questions)||!questions.length)throw Error("题组必须含题目。");total+=questions.length;if(total>100)throw Error("每份文件最多100题。");
  const numbers=questions.map((q:any)=>q.sourceNumber);if(numbers.some((n:any)=>!Number.isSafeInteger(n)||n<1||n>10000)||new Set(numbers).size!==numbers.length)throw Error("原卷题号必须为不重复的正整数。");
  const pages=questions.map((q:any)=>q.sourcePage);
  if(pages.some((page:any)=>page!=null&&(!Number.isSafeInteger(page)||page<1||page>120)))throw Error("PDF 页码无效。");
  const input=validateMaterial({...g,source:source.source,sourceUrl:source.sourceUrl,rights:"permission",shareConfirmed:true,fileIds:[],authorAlias:"private",reason:field(g.reason??"上传者人工核对分级，非官方难度核验",1000),questions:questions.map((q:any)=>({...q,analysis:field(q.analysis??"",12000,false)||"原卷未提供解析；未补造。"}))});
  if(input.payload.questions.some((q:any)=>q.kind==="mc"&&new Set(q.options.map((x:string)=>x.trim())).size!==4))throw Error("选项重复。");
  return {title:input.title,subject:input.subject,section:input.section,tier:input.tier,locator,reason:input.payload.reason,text:input.payload.text,questions:input.payload.questions.map((q:any,j:number)=>({...q,sourceNumber:numbers[j],...(pages[j]!=null?{sourcePage:pages[j]}:{})})),groupIndex:i+1};
 });
}
export function units(row:any){
 const p=JSON.parse(row.payload);if(!p.approved)return [];
 return p.groups.flatMap((g:any)=>{
  const id="private-import:"+row.id+":g"+g.groupIndex+":r"+row.revision,source=row.source+" · 原文件："+row.filename+" · "+g.locator;
  const base={id,subject:g.subject,section:g.section,tier:g.tier,title:g.title,classificationStatus:"本人核对，难度为人工标注",reason:g.reason,text:g.text,paragraphs:g.text?g.text.split(/\n\s*\n/):[],source,sourceUrl:row.source_url,materialId:id,importId:row.id,sourceFile:row.filename,sourceHash:row.sha256,sourceLocator:g.locator,questions:g.questions.map((q:any)=>({...q,sourceId:"private-import:"+row.id+":g"+g.groupIndex+":q"+q.sourceNumber,originalNumber:q.sourceNumber,sourceNumber:g.section==="cloze"?q.id:q.sourceNumber,source:source+(q.sourcePage?" · PDF第"+q.sourcePage+"页":"")+" · 原题"+q.sourceNumber}))};
  return ["reading","cloze","ordering","gap-seven","modern","classical","poem"].includes(g.section)?[base]:base.questions.map((q:any)=>({...base,id:id+":q"+q.id,materialId:id+":q"+q.id,questions:[q]}));
 });
}
