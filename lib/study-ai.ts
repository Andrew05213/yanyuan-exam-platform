import {env} from 'cloudflare:workers';
import {isOpenAIProtocol} from './admin-contracts';
import {providerForExecution} from './admin-providers';
import {finalizeAIUsage,recordAIUsage,type UsageEvent} from './ai-usage';
import {configuredAIFetch} from './configured-ai-fetch';
import {reportedUsage} from './grading-contracts';
import {modelListUrl} from './provider-models';
import {AccessError,readLimitedText,type Principal} from './user-access';

export async function studyAIProvider() {
  const provider = await providerForExecution();
  if (!isOpenAIProtocol(provider.protocol)) throw new AccessError('默认 Provider 须支持 Chat Completions 或 Responses。', 409);
  const responses = provider.protocol === 'openai-responses';
  const url = modelListUrl(provider.baseUrl, env.AI_MODEL_HOSTS).replace(/\/models$/, responses ? '/responses' : '/chat/completions');
  return {provider, responses, url};
}

type Target = Awaited<ReturnType<typeof studyAIProvider>>;
type Message = {role:'system'|'user';content:string};

export async function runStudyAI<T>(
  target:Target, user:Principal, requestId:string,
  task:Extract<UsageEvent['task'],'question-generation'|'literature-feedback'|'research-assistant'>,
  messages:Message[], parse:(text:string)=>T, quota?:{since:string;limit:number},
) {
  const {provider,responses,url} = target;
  const event:UsageEvent = {requestId,task,status:'unknown',counts:reportedUsage(null)};
  const reservation = await recordAIUsage(user,provider,event,quota);
  if (reservation.duplicate) throw new AccessError('请求已提交。',409);
  const start = Date.now();
  try {
    const host = new URL(url).hostname;
    const body = responses
      ? {model:provider.model,input:messages,text:{format:{type:'json_object'}},store:false,max_output_tokens:8000}
      : {model:provider.model,messages,response_format:{type:'json_object'},
         ...(host==='api.openai.com'?{store:false,max_completion_tokens:8000}:{max_tokens:4500}),
         ...(host==='api.deepseek.com'?{thinking:{type:'disabled'}}:{})};
    const response = await configuredAIFetch()(url,{
      method:'POST',redirect:'manual',signal:AbortSignal.timeout(90000),
      headers:{Authorization:'Bearer '+provider.apiKey,'Content-Type':'application/json'},body:JSON.stringify(body),
    });
    event.status = 'error';
    const payload = JSON.parse(await readLimitedText(response,1_000_000));
    event.counts = reportedUsage(payload?.usage,provider.protocol);
    if (!response.ok) throw new AccessError('模型服务未完成请求，请稍后重试。',502);
    let text:unknown;
    if (responses) {
      if (payload.status!=='completed'||payload.error||payload.incomplete_details||!Array.isArray(payload.output)) throw Error();
      const parts = payload.output.filter((item:any)=>item?.type==='message'&&item.role==='assistant')
        .flatMap((item:any)=>item.status&&item.status!=='completed'?[]:item.content||[]);
      if (!parts.length||parts.some((item:any)=>item?.type!=='output_text'||typeof item.text!=='string')) throw Error();
      text = parts.map((item:any)=>item.text).join('');
    } else if (payload.choices?.[0]?.finish_reason==='stop') {
      text = payload.choices[0].message?.content;
    }
    if (typeof text!=='string'||!text.trim()||text.includes(provider.apiKey)) throw Error();
    const result = parse(text);
    if (JSON.stringify(result).includes(provider.apiKey)) throw Error();
    event.status = 'success';
    return result;
  } catch {
    throw new AccessError('模型未返回完整有效的结果，请重试。',502);
  } finally {
    await finalizeAIUsage(user,provider,{...event,elapsedMs:Date.now()-start});
  }
}
