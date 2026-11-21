import {modelListUrl} from './provider-models';
import {AdminInputError,isOpenAIProtocol} from './admin-contracts';
import {reportedUsage,gradingPrompt,validatedGrade,type gradingSource} from './grading-contracts';
import {upstreamFetch} from './upstream-fetch';
export async function executeGrading(provider:{baseUrl:string;protocol:string;model:string;apiKey:string},source:ReturnType<typeof gradingSource>,essay:boolean,extraHosts='',request:typeof fetch=upstreamFetch){
 if(!isOpenAIProtocol(provider.protocol))throw new AdminInputError('默认 Provider 须使用 OpenAI Chat Completions / Responses 协议。');
 const responses=provider.protocol==='openai-responses',url=modelListUrl(provider.baseUrl,extraHosts).replace(/\/models$/,responses?'/responses':'/chat/completions');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),90000),start=Date.now();let counts=reportedUsage(null),sent=false,status:'success'|'error'|'unknown'='unknown',result:any=null,error='';
 try{
  const host=new URL(url).hostname,prompt=gradingPrompt(source,essay),body=responses?{model:provider.model,input:prompt,store:false,stream:false,text:{format:{type:'json_object'}},max_output_tokens:essay?8000:4000}:{model:provider.model,messages:prompt,stream:false,response_format:{type:'json_object'},...(host==='api.openai.com'?{store:false,max_completion_tokens:essay?8000:4000}:{max_tokens:essay?8000:3000}),...(host==='api.deepseek.com'?{thinking:{type:'disabled'}}:{})};
  sent=true;const response=await request.call(globalThis,url,{method:'POST',headers:{Authorization:'Bearer '+provider.apiKey,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'manual',signal:controller.signal});
  status='error';const reader=response.body?.getReader();if(!reader)throw Error();let size=0;const chunks:Uint8Array[]=[];try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1000000){await reader.cancel();throw Error();}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}const payload=JSON.parse(new TextDecoder().decode(bytes));counts=reportedUsage(payload.usage,provider.protocol);status='error';
  if(!response.ok)throw new AdminInputError(response.status===401||response.status===403?'上游拒绝访问，请管理员检查默认 Provider 的密钥。':response.status===429?'上游繁忙，请稍后重试。':'上游未完成批改，请稍后重试。');
  let content:unknown;
  if(responses){
   if(payload.status!=='completed'||payload.error||payload.incomplete_details||!Array.isArray(payload.output))throw new AdminInputError('AI 输出被截断或未正常完成，本次未计入成绩。');
   const parts=payload.output.filter((item:any)=>item?.type==='message'&&item.role==='assistant').flatMap((item:any)=>{if(item.status&&item.status!=='completed'||!Array.isArray(item.content))throw Error();return item.content;});
   if(!parts.length||parts.some((part:any)=>part?.type!=='output_text'||typeof part.text!=='string'))throw new AdminInputError('AI 未返回可用的文字批改，本次未计入成绩。');
   content=parts.map((part:any)=>part.text).join('');
  }else{if(payload.choices?.[0]?.finish_reason!=='stop')throw new AdminInputError('AI 输出被截断或未正常完成，本次未计入成绩。');content=payload.choices[0].message?.content;}
  if(typeof content!=='string'||content.includes(provider.apiKey))throw Error();
  result=validatedGrade(JSON.parse(content),source,essay);if(JSON.stringify(result).includes(provider.apiKey))throw Error();status='success';
 }catch(e){error=e instanceof AdminInputError?e.message:'AI 批改未完成或返回格式无效，请稍后重试。';if(error.includes(provider.apiKey))error='AI 批改未完成，请稍后重试。';}
 finally{clearTimeout(timeout);}
 return {sent,status,counts,result,error,elapsedMs:Date.now()-start};
}
