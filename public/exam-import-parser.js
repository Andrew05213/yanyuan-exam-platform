(function(root){
"use strict";
// Recognize numbered four-option questions and explicitly printed answers.
function parse(raw){
 return parsePages([raw],50,false);
}

function parsePages(pages,limit=100,keepRepeatedNumbers=true){
 const normalized=pages.map(page=>String(page??"").replace(/\r\n?/g,"\n").normalize("NFKC"));
 if(normalized.join("\n").length>60000)throw Error("一次识别最多60000字，请分段处理。");
 const blocks=[],warnings=[],key=new Map(),counts=new Map();
 let current=null,inAnswerKey=false;
 const answerPairs=/(\d{1,3})(?:\s*[.、:)]\s*|\s+)([A-D])\b/gi;
 function saveAnswers(line){
  for(const match of line.matchAll(answerPairs)){
   const number=Number(match[1]);
   if(!key.has(number))key.set(number,new Set());
   key.get(number).add(match[2].toUpperCase());
  }
 }
 normalized.forEach((text,index)=>{
  const lines=text.trim().split("\n");
  for(const [lineIndex,rawLine] of lines.entries()){
   const line=rawLine.trim();
   if(!line)continue;
   if((lineIndex===0||lineIndex===lines.length-1)&&/^(?:第\s*\d+\s*页(?:\s*[/，,]\s*共?\s*\d+\s*页)?|[-–—]\s*\d+\s*[-–—])$/.test(line))continue;
   const heading=line.match(/^(?:参考答案|答案汇总|Answer\s*key)(?=$|\s|[:：])\s*[:：]?\s*(.*)$/i);
   if(heading&&(!current||!/^[A-D]$/i.test(heading[1]))){
    current=null;
    inAnswerKey=true;
    saveAnswers(heading[1]);
    continue;
   }
   if(inAnswerKey){
    const remaining=line.replace(answerPairs,"").replace(/[\s,，、;；]+/g,"");
    if(!remaining){saveAnswers(line);continue;}
   }
   const q=line.match(/^(\d{1,3})[.、)]\s*(.+)$/);
   if(q){
    inAnswerKey=false;
    const number=Number(q[1]);
    current={number,page:index+1,lines:[q[2]]};
    blocks.push(current);
    counts.set(number,(counts.get(number)||0)+1);
   }else if(current)current.lines.push(line);
   else if(!inAnswerKey)warnings.push("题前文字未自动归入题干，请核对配套材料。");
  }
 });
 const seen=new Set(),questions=[];
 for(const block of blocks){
  const {number,page,lines}=block;
  if(!keepRepeatedNumbers&&seen.has(number)){warnings.push("重复原题号 "+number+"，需人工分段。");continue;}
  seen.add(number);
  const all=lines.join("\n"),analysis=all.match(/(?:^|\n)(?:解析|Explanation)\s*[:：]\s*([\s\S]*)$/i);
  const content=all.split(/\n(?:参考答案|答案|Answer|解析|Explanation)\s*[:：]/i)[0];
  const optionsFound=[...content.matchAll(/(?:^|\s)([A-D])[.、)]\s*/g)];
  const label=keepRepeatedNumbers?"第 "+page+" 页第 "+number+" 题":"第 "+number+" 题";
  if(optionsFound.map(match=>match[1]).join("")!=="ABCD"){
   warnings.push(label+"不是可安全自动识别的四选一，需人工录入。");
   continue;
  }
  const stem=content.slice(0,optionsFound[0].index).trim();
  const options=optionsFound.map((match,i)=>content.slice(match.index+match[0].length,optionsFound[i+1]?.index??content.length).trim());
  if(!stem||options.some(option=>!option)){warnings.push(label+"题干或选项缺失。");continue;}
  const ambiguousKey=counts.get(number)>1&&key.has(number);
  const answers=new Set(ambiguousKey?undefined:key.get(number));
  if(ambiguousKey)warnings.push(label+"原题号重复，请核对卷末答案归属。");
  const answerLines=all.split(/\n(?:解析|Explanation)\s*[:：]/i)[0];
  for(const match of answerLines.matchAll(/^(?:参考答案|答案|Answer)\s*[:：]\s*([A-D])(?:[ \t]|$)/gim))answers.add(match[1].toUpperCase());
  const answer=answers.size===1?[...answers][0]:"";
  if(answers.size>1)warnings.push(label+"答案冲突，已清空待核对。");
  if(!answers.size)warnings.push(label+"缺少答案，不能未经核对入库。");
  questions.push({sourceNumber:number,...(keepRepeatedNumbers?{sourcePage:page}:{}),kind:"mc",stem,options,answer,analysis:analysis?.[1]?.trim()||"",tag:""});
 }
 if(!blocks.length)warnings.push("未找到编号题；请检查OCR、题目格式或手工整理。");
 if(keepRepeatedNumbers&&questions.length>limit)throw Error("每份最多100题，请拆分试卷。");
 if(questions.length>limit)warnings.push("超过50题，请分组。");
 return {questions:questions.slice(0,limit),warnings:[...new Set(warnings)].slice(0,100)};
}
root.ExamImportParser={parse,parsePages};
})(typeof window!=="undefined"?window:globalThis);
