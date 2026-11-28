(function(root){
"use strict";
// Deliberately conservative: identify only numbered, four-option MCQs and explicit answers.
function parse(raw){
 const text=String(raw??"").replace(/\r\n?/g,"\n").normalize("NFKC").trim();
 if(text.length>60000)throw Error("一次识别最多60000字，请分段处理。");
 const blocks=[],warnings=[];let current=null;
 const key=new Map();const lines=text.split("\n");
 for(const line0 of lines){const line=line0.trim();if(!line)continue;
  const keyLine=line.match(/^(?:参考答案|答案汇总|Answer\s*key)\s*[:：]?\s*(.*)$/i);
  if(keyLine && (!current || !/^[A-D]$/i.test(keyLine[1]))){for(const m of keyLine[1].matchAll(/(\d{1,3})\s*[.、:)]\s*([A-D])\b/gi)){
    const number=Number(m[1]);
    if(!key.has(number))key.set(number,new Set());
    key.get(number).add(m[2].toUpperCase());
   }continue;}
  const q=line.match(/^(\d{1,3})[.、)]\s*(.+)$/);
  if(q){current={number:Number(q[1]),lines:[q[2]]};blocks.push(current);}
  else if(current)current.lines.push(line);
  else warnings.push("题前文字未自动归入题干，请核对配套材料。");
 }
 const seen=new Set(),questions=[];
 for(const b of blocks){
  if(seen.has(b.number)){warnings.push("重复原题号 "+b.number+"，需人工分段。");continue;}seen.add(b.number);
  const all=b.lines.join("\n"),analysis=all.match(/(?:^|\n)(?:解析|Explanation)\s*[:：]\s*([\s\S]*)$/i);
  const content=all.split(/\n(?:参考答案|答案|Answer|解析|Explanation)\s*[:：]/i)[0];
  const opts=[...content.matchAll(/(?:^|\s)([A-D])[.、)]\s*/g)];
  if(opts.length!==4||opts.map(x=>x[1]).join("")!=="ABCD"){warnings.push("第 "+b.number+" 题不是可安全自动识别的四选一，需人工录入。");continue;}
  const stem=content.slice(0,opts[0].index).trim(),options=opts.map((x,i)=>content.slice(x.index+x[0].length,i+1<opts.length?opts[i+1].index:content.length).trim());
  if(!stem||options.some(x=>!x)){warnings.push("第 "+b.number+" 题题干或选项缺失。");continue;}
  const answers=new Set(key.get(b.number));
  const answerLines=all.split(/\n(?:解析|Explanation)\s*[:：]/i)[0];
  for(const match of answerLines.matchAll(/^(?:参考答案|答案|Answer)\s*[:：]\s*([A-D])(?:[ \t]|$)/gim))answers.add(match[1].toUpperCase());
  const answer=answers.size===1?[...answers][0]:"";
  if(answers.size>1)warnings.push("第 "+b.number+" 题答案冲突，已清空待核对。");
  if(!answers.size)warnings.push("第 "+b.number+" 题缺少答案，不能未经核对入库。");
  questions.push({sourceNumber:b.number,kind:"mc",stem,options,answer,analysis:analysis?.[1]?.trim()||"",tag:""});
 }
 if(!blocks.length)warnings.push("未找到编号题；请检查OCR、题目格式或手工整理。");
 if(questions.length>50)warnings.push("超过50题，请分组。");
 return {questions:questions.slice(0,50),warnings:[...new Set(warnings)].slice(0,100)};
}
root.ExamImportParser={parse};
})(typeof window!=="undefined"?window:globalThis);
