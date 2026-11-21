import {modelListUrl} from './provider-models';
import {AdminInputError} from './admin-contracts';
import {reportedUsage,gradingPrompt,validatedGrade,type gradingSource} from './grading-contracts';
import {upstreamFetch} from './upstream-fetch';
export async function executeGrading(provider:{baseUrl:string;protocol:string;model:string;apiKey:string},source:ReturnType<typeof gradingSource>,essay:boolean,extraHosts='',request:typeof fetch=upstreamFetch){
 if(provider.protocol!=='openai-compatible')throw new AdminInputError('默认 Provider 须使用 OpenAI 兼容协议（支持 DeepSeek）。');
 const url=modelListUrl(provider.baseUrl,extraHosts).replace(/\/models$/,'/chat/completions');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),90000),start=Date.now();let counts=reportedUsage(null),sent=false,status:'success'|'error'|'unknown'='unknown',result:any=null,error='';
 try{
  sent=true;const response=await request.call(globalThis,url,{method:'POST',headers:{Authorization:'Bearer '+provider.apiKey,'Content-Type':'application/json'},body:JSON.stringify({model:provider.model,messages:gradingPrompt(source,essay),stream:false,response_format:{type:'json_object'},max_tokens:essay?8000:3000,...(new URL(url).hostname==='api.deepseek.com'?{thinking:{type:'disabled'}}:{})}),redirect:'manual',signal:controller.signal});
  status='error';const reader=response.body?.getReader();if(!reader)throw Error();let size=0;const chunks:Uint8Array[]=[];try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1000000){await reader.cancel();throw Error();}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}const payload=JSON.parse(new TextDecoder().decode(bytes));counts=reportedUsage(payload.usage);status='error';
  if(!response.ok)throw new AdminInputError(response.status===401||response.status===403?'上游拒绝访问，请管理员检查默认 Provider 的密钥。':response.status===429?'上游繁忙，请稍后重试。':'上游未完成批改，请稍后重试。');
  if(payload.choices?.[0]?.finish_reason!=='stop')throw new AdminInputError('AI 输出被截断或未正常完成，本次未计入成绩。');
  const content=payload.choices[0].message?.content;if(typeof content!=='string'||content.includes(provider.apiKey))throw Error();
  result=validatedGrade(JSON.parse(content),source,essay);if(JSON.stringify(result).includes(provider.apiKey))throw Error();status='success';
 }catch(e){error=e instanceof AdminInputError?e.message:'AI 批改未完成或返回格式无效，请稍后重试。';if(error.includes(provider.apiKey))error='AI 批改未完成，请稍后重试。';}
 finally{clearTimeout(timeout);}
 return {sent,status,counts,result,error,elapsedMs:Date.now()-start};
}

