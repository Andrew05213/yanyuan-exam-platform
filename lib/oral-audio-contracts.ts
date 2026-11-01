import {AccessError} from './user-access';
export const AUDIO_MAX_BYTES=10*1024*1024;
export function wavMetrics(bytes:Uint8Array){
 const bad=()=>new AccessError('原音分析需要1—300秒、10 MB以内的16位PCM WAV；其他格式仍可保存播放。',415);
 if(bytes.length<44||bytes.length>AUDIO_MAX_BYTES)throw bad();const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),str=(p:number,n:number)=>String.fromCharCode(...bytes.slice(p,p+n));
 if(str(0,4)!=='RIFF'||str(8,4)!=='WAVE'||v.getUint32(4,true)+8!==bytes.length)throw bad();
 let channels=0,rate=0,align=0,dataStart=-1,dataLength=0,fmt=false,p=12;
 for(;p+8<=bytes.length;){const tag=str(p,4),n=v.getUint32(p+4,true),start=p+8;if(start+n>bytes.length)throw bad();
  if(tag==='fmt '){if(fmt||n<16||v.getUint16(start,true)!==1||v.getUint16(start+14,true)!==16)throw bad();fmt=true;channels=v.getUint16(start+2,true);rate=v.getUint32(start+4,true);align=v.getUint16(start+12,true);if(![1,2].includes(channels)||rate<8000||rate>48000||align!==channels*2||v.getUint32(start+8,true)!==rate*align)throw bad();}
  if(tag==='data'){if(dataStart!==-1)throw bad();dataStart=start;dataLength=n;}p=start+n+n%2;if(p>bytes.length)throw bad();
 }
 if(p!==bytes.length||!fmt||dataStart<0||!dataLength||dataLength%align)throw bad();const frames=dataLength/align,duration=frames/rate;if(duration<1||duration>300)throw bad();
 const window=Math.round(rate*.02);let silent=0,run=0,pauses=0,longest=0,peak=0;const finish=()=>{if(run/rate>=.3){pauses++;longest=Math.max(longest,run/rate);}run=0;};
 for(let i=0;i<frames;i+=window){let sum=0;const count=Math.min(window,frames-i);for(let j=0;j<count;j++){let sample=0;for(let c=0;c<channels;c++){const s=v.getInt16(dataStart+(i+j)*align+c*2,true)/32768;sample+=s;peak=Math.max(peak,Math.abs(s));}sum+=(sample/channels)**2;}if(Math.sqrt(sum/count)<.015){silent+=count;run+=count;}else finish();}finish();
 return {durationSeconds:Math.round(duration*100)/100,estimatedSilentSeconds:Math.round(silent/rate*100)/100,estimatedPauseCount:pauses,longestEstimatedPauseSeconds:Math.round(longest*100)/100,nearSilent:peak<.02,scope:'静音与停顿是能量阈值估计，包含首尾静音，不是精确人声检测。'};
}
export function audioRate(transcript:string,duration:number,language='English'){
 if(language!=='English'||!transcript.trim()||/[^\u0000-\u024f\u2000-\u206f]/u.test(transcript))return {wordCount:null,wordsPerMinute:null};const wordCount=(transcript.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)||[]).length;return {wordCount,wordsPerMinute:wordCount?Math.round(wordCount*60/duration):null};
}
export function validateAudioFeedback(input:unknown,duration:number){
 const bad=()=>new AccessError('音频模型反馈格式无效，不生成分数。',502),text=(v:unknown,n:number):v is string=>typeof v==='string'&&v.length<=n;
 if(!input||typeof input!=='object'||Array.isArray(input))throw bad();const r=input as Record<string,unknown>;
 if(typeof r.assessable!=='boolean'||!text(r.transcript,16000)||!text(r.summary,2000)||typeof r.confidence!=='string'||!['low','medium','high'].includes(r.confidence)||!Array.isArray(r.issues)||r.issues.length>20||!Array.isArray(r.practice)||r.practice.length>10||r.practice.some((s:unknown)=>!text(s,600)))throw bad();
 const pronunciation=r.pronunciation,fluency=r.fluency;if(r.assessable?(!text(pronunciation,2000)||!text(fluency,2000)):(pronunciation!==null||fluency!==null))throw bad();if(!r.assessable&&(r.transcript!==''||r.issues.length))throw bad();
 const issues=r.issues.map((value:unknown)=>{if(!value||typeof value!=='object'||Array.isArray(value))throw bad();const s=value as Record<string,unknown>;if(typeof s.startSeconds!=='number'||typeof s.endSeconds!=='number'||!Number.isFinite(s.startSeconds)||!Number.isFinite(s.endSeconds)||s.startSeconds<0||s.endSeconds<s.startSeconds||s.endSeconds>duration||!text(s.heard,300)||!text(s.advice,1000))throw bad();return {startSeconds:s.startSeconds,endSeconds:s.endSeconds,heard:s.heard,advice:s.advice};});
 return {assessable:r.assessable,transcript:r.transcript,summary:r.summary,confidence:r.confidence,pronunciation:pronunciation as string|null,fluency:fluency as string|null,issues,practice:r.practice as string[]};
}
