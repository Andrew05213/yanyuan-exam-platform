import catalog from '../public/difficulty.json';
export function validateMaterial(body:any){
 const c=catalog as any,subject=body?.subject,section=body?.section,tier=body?.tier;
 if(!c.sections[subject]?.some((s:any)=>s.id===section)||!c.tiers[subject]?.some((t:any)=>t.id===tier))throw Error('请选择有效的科目、部分和难度档位。');
 const field=(value:any,max:number,required=true)=>{if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw Error('资料文字缺失或超过长度限制。');return value.trim();};
 const title=field(body.title,150),alias=field(body.authorAlias||'学习者',40),text=field(body.text||'',60000,false),source=field(body.source,500),sourceUrl=field(body.sourceUrl||'',1000,false),reason=field(body.reason,1000);
 if(sourceUrl){const u=new URL(sourceUrl);if(u.protocol!=='https:')throw Error('来源链接请使用https。');}
 if(!['original','permission','public-domain'].includes(body.rights)||body.shareConfirmed!==true)throw Error('请确认资料使用权限，以及主动发布到共享区的范围。');
 if(!Array.isArray(body.questions)||body.questions.length>50)throw Error('每份资料最多50题，也可以仅分享原始资料。');
 if(!Array.isArray(body.fileIds)||body.fileIds.length>6||body.fileIds.some((id:any)=>typeof id!=='string'||!/^material-file-[a-f0-9-]{36}$/.test(id)))throw Error('资料附件信息不完整。');
 if(!text&&!body.questions.length&&!body.fileIds.length)throw Error('请至少提供正文、题目或附件。');
 const questions=body.questions.map((q:any,i:number)=>{
  const kind=q.kind||'mc',base:any={id:i+1,sourceNumber:i+1,kind,stem:field(q.stem,6000),analysis:field(q.analysis,12000),tag:field(q.tag||'用户分享',100)};
  if(kind==='mc'){if(!Array.isArray(q.options)||q.options.length!==4||!['A','B','C','D'].includes(q.answer))throw Error('选择题须有四个选项和一个A—D答案。');base.options=q.options.map((v:any)=>field(v,4000));base.answer=q.answer;}
  else if(kind==='fill'){if(!Array.isArray(q.accepted)||!q.accepted.length||q.accepted.length>12)throw Error('填空题须提供可接受答案。');base.accepted=q.accepted.map((v:any)=>field(v,300));}
  else if(kind==='order'){if(!q.paragraphs||typeof q.paragraphs!=='object'||Array.isArray(q.paragraphs)||Object.keys(q.paragraphs).length<3||Object.keys(q.paragraphs).length>8||Object.keys(q.paragraphs).some(k=>!/^([A-H])$/.test(k)))throw Error('排序题须提供A—H段落。');base.paragraphs=Object.fromEntries(Object.entries(q.paragraphs).map(([k,v])=>[k,field(v,8000)]));const letters=Object.keys(base.paragraphs).sort().join('');if(!Array.isArray(q.accepted)||!q.accepted.length||q.accepted.some((v:any)=>typeof v!=='string'||v.split('').sort().join('')!==letters))throw Error('排序答案须恰好使用所有段落字母。');base.accepted=q.accepted;}
  else if(kind==='writing'||kind==='translation'){base.text=field(q.text||'',20000,false);base.reference=field(q.reference||'',20000,false);}
  else throw Error('不支持的题型。');
  const expected=section==='fill'?'fill':section==='ordering'?'order':section==='writing'?'writing':section==='translation'?'translation':'mc';
  if(kind!==expected)throw Error('题型与所选部分不符，请按部分分别发布。');
  return base;
 });
 if(['reading','cloze','modern','classical','poem'].includes(section)&&questions.length&&!text)throw Error('阅读、完形和语文题组须附完整配套正文。');
 if(section==='cloze'&&questions.length){const blanks=[...text.matchAll(/\[(\d+)\]/g)].map(m=>Number(m[1]));if(new Set(blanks).size!==questions.length||questions.some((_:any,i:number)=>!blanks.includes(i+1)))throw Error('完形空号须从[1]开始，与题目一一对应。');}
 return {title,authorAlias:alias,subject,section,tier,payload:{schema:1,text,source,sourceUrl,reason,rights:body.rights,questions,fileIds:body.fileIds,sharedAt:new Date().toISOString()}};
}
export function publicMaterial(row:any){const {ownerId,payload,...metadata}=row;return {...metadata,active:!!row.active,...JSON.parse(typeof payload==='string'?payload:JSON.stringify(payload))};}
export function materialUnit(row:any){const p=publicMaterial(row);if(!p.active||!p.questions.length)return null;const id='community:'+p.id+':r'+p.revision;return {id,subject:p.subject,section:p.section,tier:p.tier,classificationStatus:'上传者自标，未审核',reason:p.reason,title:p.title,text:p.text,paragraphs:p.text?p.text.split(/\n\s*\n/):[],source:p.source+' · 分享者：'+p.authorAlias,sourceUrl:p.sourceUrl,materialId:id,communityId:p.id,questions:p.questions.map((q:any)=>({...q,sourceId:id+':'+q.id}))};}

// Passage tasks remain whole; individual-question sections count actual questions.
export function materialUnits(row:any){
 const unit=materialUnit(row);if(!unit)return [];
 if(['reading','cloze','ordering','modern','classical','poem'].includes(unit.section))return [unit];
 return unit.questions.map((q:any)=>({...unit,id:unit.id+':q'+q.id,materialId:unit.id+':q'+q.id,questions:[q]}));
}
