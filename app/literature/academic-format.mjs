export function parseNote(source){
 if(typeof source!=="string"||source.length>100000)throw Error("invalid_note");
 const blocks=[],footnotes=[],seen=new Set();let fence=null,code=[];
 for(const line of source.split(/\r?\n/)){
  if(fence!==null){if(/^```\s*$/.test(line)){blocks.push({kind:"code",text:code.join("\n")});fence=null;code=[];}else code.push(line);continue;}
  if(/^```[\w+-]*\s*$/.test(line)){fence=true;continue;}
  const foot=line.match(/^\[\^([A-Za-z0-9_-]{1,40})\]:\s*(.*)$/);
  if(foot){if(seen.has(foot[1])){blocks.push({kind:"paragraph",text:line});continue;}seen.add(foot[1]);footnotes.push({id:foot[1],text:foot[2]});continue;}
  const heading=line.match(/^(#{1,3})\s+(.+)$/);if(heading){blocks.push({kind:"heading",level:heading[1].length,text:heading[2]});continue;}
  const math=line.match(/^\$\$(.+)\$\$\s*$/);if(math){blocks.push({kind:"math",text:math[1]});continue;}
  const bullet=line.match(/^[-*]\s+(.+)$/);if(bullet){blocks.push({kind:"bullet",text:bullet[1]});continue;}
  const ordered=line.match(/^(\d{1,5})\.\s+(.+)$/);if(ordered){blocks.push({kind:"ordered",text:ordered[2],number:ordered[1]});continue;}
  const quote=line.match(/^>\s?(.*)$/);if(quote){blocks.push({kind:"quote",text:quote[1]});continue;}
  blocks.push({kind:line.trim()?"paragraph":"space",text:line});
 }
 if(fence!==null)blocks.push({kind:"code",text:code.join("\n")});
 return {blocks,footnotes};
}

export function inlineNote(text){
 const result=[];let cursor=0;
 const pattern=/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[\^[A-Za-z0-9_-]{1,40}\]|\$[^$\n]+\$)/g;
 for(const m of text.matchAll(pattern)){
  if(m.index>cursor)result.push({kind:"text",text:text.slice(cursor,m.index)});
  const raw=m[0],kind=raw.startsWith("`")?"code":raw.startsWith("**")?"bold":raw.startsWith("*")?"italic":raw.startsWith("[^")?"footnote":"math";
  result.push({kind,text:kind==="footnote"?raw.slice(2,-1):kind==="bold"?raw.slice(2,-2):raw.slice(1,-1)});
  cursor=m.index+raw.length;
 }
 if(cursor<text.length)result.push({kind:"text",text:text.slice(cursor)});
 return result;
}

export function formulaTokens(text){
 const symbols={alpha:"α",beta:"β",gamma:"γ",delta:"δ",theta:"θ",lambda:"λ",mu:"μ",pi:"π",sigma:"σ",phi:"φ",omega:"ω",Delta:"Δ",Sigma:"Σ",sum:"∑",int:"∫",infty:"∞",times:"×",cdot:"·",leq:"≤",geq:"≥",neq:"≠",rightarrow:"→",sqrt:"√"};
 const plain=s=>s.replace(/\\([A-Za-z]+)/g,(whole,name)=>Object.prototype.hasOwnProperty.call(symbols,name)?symbols[name]:whole);
 const out=[];let cursor=0;const p=/\\frac\{([^{}]*)\}\{([^{}]*)\}|([_^])(?:\{([^{}]*)\}|([A-Za-z0-9]))/g;
 for(const m of text.matchAll(p)){if(m.index>cursor)out.push({kind:"text",text:plain(text.slice(cursor,m.index))});out.push(m[1]!==undefined?{kind:"fraction",top:plain(m[1]),bottom:plain(m[2])}:{kind:m[3]==="^"?"sup":"sub",text:plain(m[4]??m[5])});cursor=m.index+m[0].length;}
 if(cursor<text.length)out.push({kind:"text",text:plain(text.slice(cursor))});return out;
}
