export type GroundSource={key:string;kind:"private"|"publication";id:string;title:string;version:string;language:string;paragraphs:{number:number;text:string}[];truncated:boolean};
export type QuestionEvidence={kind:GroundSource["kind"];id:string;title:string;version:string;language:string;paragraph:number;quote:string};
export function groundParagraphs(content:string){
 const all=content.split(/\r?\n+/).map(x=>x.trim()).filter(Boolean);
 let remaining=3600;const paragraphs:GroundSource["paragraphs"]=[];
 for(const [i,p] of all.entries()){
  if(remaining<=0||paragraphs.length>=60)break;
  const text=p.slice(0,remaining);paragraphs.push({number:i+1,text});remaining-=text.length;
 }
 return {paragraphs,truncated:paragraphs.length<all.length||paragraphs.some(p=>p.text.length<all[p.number-1].length)};
}
function field(value:unknown,max:number){if(typeof value!=="string"||!value.trim()||value.length>max||/\u0000/.test(value))throw Error("证据字段无效。");return value;}
export function validateQuestionEvidence(raw:unknown):QuestionEvidence[]{
 if(!Array.isArray(raw)||raw.length<1||raw.length>4)throw Error("每题须有1至4条材料依据。");
 return raw.map(x=>{
  if(!x||typeof x!=="object"||Array.isArray(x))throw Error("证据格式无效。");
  if(x.kind!=="private"&&x.kind!=="publication")throw Error("证据类型无效。");
  const id=field(x.id,100),title=field(x.title,240),version=field(x.version,80),quote=field(x.quote,180);
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||!(x.kind==="private"?Number.isFinite(Date.parse(version)):/^[1-9]\d{0,8}$/.test(version))||!Number.isInteger(x.paragraph)||x.paragraph<1||x.paragraph>60)throw Error("证据定位无效。");
  const language=typeof x.language==="string"&&x.language.length<=100?x.language:"";
  return {kind:x.kind,id,title,version,language,paragraph:x.paragraph,quote};
 });
}
export function verifiedEvidence(raw:unknown,sources:GroundSource[]):QuestionEvidence[]{
 if(!Array.isArray(raw)||raw.length<1||raw.length>4)throw Error("每题必须引用1至4条材料依据。");
 const results=raw.map(x=>{
  if(!x||typeof x!=="object"||Object.keys(x).some(k=>!["source","paragraph","quote"].includes(k)))throw Error("引用格式错误。");
  const source=sources.find(s=>s.key===x.source),paragraph=source?.paragraphs.find(p=>p.number===x.paragraph);
  const quote=field(x.quote,180);
  if(!source||!paragraph||!paragraph.text.includes(quote))throw Error("引文不在指定材料段落内。");
  return {kind:source.kind,id:source.id,title:source.title,version:source.version,language:source.language,paragraph:paragraph.number,quote};
 });
 return validateQuestionEvidence(results);
}
