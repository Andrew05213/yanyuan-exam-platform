export function formatReview(raw:string, evidence:string, answer:string) {
  const value=JSON.parse(raw);
  for(const field of ['quote','evidenceQuote','strength','gap','suggestion']){
    if(typeof value?.[field]!=='string'||!value[field].trim())throw Error('Incomplete feedback');
  }
  if(!answer.includes(value.quote)||!evidence.includes(value.evidenceQuote))throw Error('Unmatched quotation');
  if(!Array.isArray(value.questions)||value.questions.length!==2||
     value.questions.some((q:unknown)=>typeof q!=='string'||!q.trim())||
     value.questions[0].trim()===value.questions[1].trim())throw Error('Invalid questions');
  return ['你的回答 · '+value.quote,'你提交的依据 · '+value.evidenceQuote,'论证优点 · '+value.strength,
    '证据缺口 · '+value.gap,'修改建议 · '+value.suggestion,...value.questions.map((q:string,i:number)=>'追问 '+(i+1)+' · '+q)].join('\n\n');
}
