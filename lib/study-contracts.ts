export const WRITING_DIMENSIONS = [
  {name:"审题与内容完成度",max:20},{name:"论证与逻辑",max:25},
  {name:"结构与衔接",max:15},{name:"语法与句法",max:20},
  {name:"词汇与表达",max:15},{name:"拼写、标点与格式",max:5},
];
export const normalizeText=(value:string)=>value.replace(/\s+/g," ").trim();
export async function textHash(text:string){
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,"0")).join("");
}
export function validateReview(review:any,originalText:string){
  if(!review||!Array.isArray(review.sentences)||!review.sentences.length||!Array.isArray(review.dimensions)||review.dimensions.length!==6)throw Error("批改须包含逐句分析与六维评分。");
  const fields=['original','languageIssue','logicIssue','minimalEdit','matureExpression'];
  for(const sentence of review.sentences)if(fields.some(f=>typeof sentence[f]!=="string"||!sentence[f].trim()))throw Error("每句须有原句、语言诊断、逻辑诊断、最小修改和成熟表达。");
  if(normalizeText(review.sentences.map((s:any)=>s.original).join(" "))!==normalizeText(originalText))throw Error("逐句批改未完整覆盖当前原稿，或原句被擅自改写；请保留原稿每一句与拼写。");
  let sum=0,partial=false;
  for(let i=0;i<6;i++){
    const d=review.dimensions[i],spec=WRITING_DIMENSIONS[i];
    if(d.name!==spec.name||d.max!==spec.max||typeof d.reason!=="string")throw Error("请使用约定的六维百分制评分表，并写明各项依据。");
    if(d.score===null){partial=true;continue;}
    if(!Number.isFinite(d.score)||d.score<0||d.score>spec.max)throw Error("评分超出本项满分范围。");sum+=d.score;
  }
  if(partial?review.total!==null:review.total!==sum)throw Error("总分须等于六项实际得分之和；信息不足时须标为暂评或不计完整总分。");
  if(!Array.isArray(review.priorities)||review.priorities.length!==3||!Array.isArray(review.vocabulary)||!Array.isArray(review.paragraphs)||typeof review.optimizedText!=="string"||typeof review.summary!=="string")throw Error("批改还须包含最需改的三项、段落论证、词块和优化全文。");
}
export function validateStudyPayload(kind:string,payload:any,existingPayload?:any){
  if(kind==='essay'){
    if(typeof payload.originalText!=="string"||payload.originalText.length>40000||!Array.isArray(payload.images)||payload.images.length>12||payload.images.some((p:any)=>typeof p.id!=="string"||!/^asset-[a-f0-9-]{36}$/.test(p.id)))throw Error("作文原稿或图片信息不完整。");
    if(existingPayload?.firstReview&&payload.originalText!==existingPayload.originalText)throw Error("这份原稿已有首次评分。请把修改稿另存为新练习，保留首次原稿与成绩。");
    if(payload.firstReview)validateReview(payload.firstReview,payload.originalText);
    if(payload.latestReview)validateReview(payload.latestReview,payload.originalText);
    if(existingPayload?.firstReview&&JSON.stringify(payload.firstReview)!==JSON.stringify(existingPayload.firstReview))throw Error("首次批改记录须保留；后续复评写入新的复评记录。");
  }
  if(kind==='preset'&&(!payload.config||typeof payload.name!=="string"))throw Error("预设名称或配置不完整。");
  if(kind==='error-set'&&(!Array.isArray(payload.entries)||payload.entries.length<1||payload.entries.length>200||!payload.packet))throw Error("错题档案内容不完整。");
  if(kind==='review-attempt'&&(!payload.parentId||!payload.answers))throw Error("复习记录须关联原错题档案。");
}
export function reviewTemplate(){return {
  sourceHash:"从get_essay返回值原样复制",reviewer:"ChatGPT 当前对话",
  summary:"仅评价原稿；题目缺失时说明审题暂评。",
  dimensions:WRITING_DIMENSIONS.map(d=>({...d,score:null,reason:"结合原稿说明"})),total:null,
  priorities:["最需改的第一项","第二项","第三项"],
  sentences:[{original:"逐句完整复制原稿，保留错误",languageIssue:"错误、可提升或语言基本正确",logicIssue:"句子作用与具体论证问题；没有问题则说明",minimalEdit:"最小必要修改",matureExpression:"自然成熟表达；新增推理需说明"}],
  paragraphs:[{index:1,role:"本段作用",chain:"主张→机制→例子→回扣",gap:"缺失环节或逻辑成立",fix:"具体补链建议"}],
  vocabulary:[{original:"原表达",recommended:"可迁移词块",meaning:"中文释义",condition:"搭配与适用条件",example:"在本题中的英文例句"}],
  optimizedText:"保留原稿立场、遵守原题字数的英文优化全文",optimizedWordCount:0,
  nextSteps:["下一篇可执行目标"],provisional:true,
};}
