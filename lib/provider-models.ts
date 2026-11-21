import {AdminInputError,publicBaseUrl,isOpenAIProtocol} from './admin-contracts';
import {upstreamFetch} from './upstream-fetch';
export function modelListUrl(baseUrl:string,extraHosts=''){
 const base=publicBaseUrl(baseUrl),url=new URL(base);
 const hosts=new Set(['api.deepseek.com','api.openai.com','api.mistral.ai','api.groq.com','openrouter.ai','api.siliconflow.cn',...extraHosts.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)]);
 if(!hosts.has(url.hostname))throw new AdminInputError('该上游尚未允许获取模型，请在服务端配置 AI_MODEL_HOSTS 后重试。');
 return base+'/models';
}
export function modelMetadata(payload:any,key:string){
 if(!Array.isArray(payload?.data)||payload.data.length>1000)throw new AdminInputError('上游返回的模型列表格式不正确。');
 const text=(v:unknown,max=150)=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u001f]/.test(v)&&!v.includes(key)?v:undefined;
 const count=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0?Number(v):undefined;
 const list=(v:any)=>Array.isArray(v)?v.slice(0,20).map(x=>text(x,50)).filter(Boolean):undefined;
 const seen=new Set<string>(),models=[];
 for(const row of payload.data){if(!row||typeof row!=='object')continue;const id=text(row.id);if(!id||seen.has(id))continue;seen.add(id);models.push({id,name:text(row.name),ownedBy:text(row.owned_by),contextWindow:count(row.context_window),maxOutputTokens:count(row.max_output_tokens),inputModalities:list(row.input_modalities),outputModalities:list(row.output_modalities),effortLevels:list(row.effort?.supported_levels)});}
 return models;
}
export async function fetchModelList(provider:{baseUrl:string;protocol:string;apiKey:string},extraHosts='',request:typeof fetch=upstreamFetch){
 if(!isOpenAIProtocol(provider.protocol))throw new AdminInputError('当前支持 OpenAI Chat Completions / Responses 的模型列表；其他协议可手动填写模型。');
 const url=modelListUrl(provider.baseUrl,extraHosts),controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{
  let response:Response;try{response=await request(url,{method:'GET',headers:{Authorization:'Bearer '+provider.apiKey,Accept:'application/json'},redirect:'manual',signal:controller.signal});}catch{throw new AdminInputError('连接上游失败或超时，请检查接口地址后重试。');}
  if(!response.ok){await response.body?.cancel();throw new AdminInputError(response.status===401||response.status===403?'上游拒绝访问，请检查已保存的 API Key。':response.status===429?'上游请求过多，请稍后重试。':'上游暂时无法返回模型列表。');}
  const reader=response.body?.getReader();if(!reader)throw new AdminInputError('上游返回为空。');let size=0;const chunks:Uint8Array[]=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>512000){await reader.cancel();throw new AdminInputError('上游模型列表过大。');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
  let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new AdminInputError('上游未返回有效的模型列表。');}
  return modelMetadata(body,provider.apiKey);
 }catch(e){if(e instanceof AdminInputError)throw e;throw new AdminInputError('获取模型列表失败，请稍后重试。');}finally{clearTimeout(timeout);}
}
