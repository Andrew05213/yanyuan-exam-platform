import {adminDb} from './admin-access';
import {AdminInputError,estimateCostMicros,validateUsage,type Pricing,type UsageCounts,CURRENCIES} from './admin-contracts';
import {AccessError,type Principal} from './user-access';

export type BillingProvider={id:string;name:string;model:string;currency:string;revision:number;pricing:Pricing};
const tasks=['writing','translation','oral','oral-audio','question-generation','literature-feedback','research-assistant','admissions-followup'] as const;
export type UsageEvent={requestId:string;task:typeof tasks[number];status:'success'|'error'|'unknown';counts:UsageCounts;elapsedMs?:number|null};

// Call only from server-side model execution, using a trusted user and a pricing
// snapshot taken before the request. There is deliberately no public ingestion API.
export async function recordAIUsage(user:Principal,provider:BillingProvider,event:UsageEvent,quota?:{since:string;limit:number}){
 if(!user.id||user.id.length>300||!/^provider-[a-f0-9-]{36}$/.test(provider.id)||!event.requestId||event.requestId.length>160||/[\r\n\u0000]/.test(event.requestId)||!tasks.includes(event.task)||!['success','error','unknown'].includes(event.status)||!CURRENCIES.includes(provider.currency as any))throw new AdminInputError('用量记录字段不正确。');
 validateUsage(event.counts);
 if(event.elapsedMs!==undefined&&event.elapsedMs!==null&&(!Number.isSafeInteger(event.elapsedMs)||event.elapsedMs<0))throw new AdminInputError('请求耗时不正确。');
 const cost=estimateCostMicros(event.counts,provider.pricing),id='usage-'+crypto.randomUUID(),db=adminDb();
 const snapshot=JSON.stringify({revision:provider.revision,inputPriceMicros:provider.pricing.inputPriceMicros,cachedInputPriceMicros:provider.pricing.cachedInputPriceMicros,outputPriceMicros:provider.pricing.outputPriceMicros});
 const guard=quota?'(SELECT COUNT(*) FROM ai_usage_events WHERE user_id=? AND task=? AND created_at>=?) < ?':'1';
 const r=await db.prepare('INSERT INTO ai_usage_events(id,request_id,user_id,provider_id,provider_name,model,task,status,currency,input_tokens,cached_input_tokens,output_tokens,estimated_cost_micros,pricing_snapshot,elapsed_ms,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE '+guard+' ON CONFLICT(provider_id,request_id) DO NOTHING').bind(id,event.requestId,user.id,provider.id,provider.name,provider.model,event.task,event.status,provider.currency,event.counts.inputTokens,event.counts.cachedInputTokens,event.counts.outputTokens,cost,snapshot,event.elapsedMs??null,new Date().toISOString(),...(quota?[user.id,event.task,quota.since,quota.limit]:[])).run();
 if(!r.meta.changes){const old=await db.prepare('SELECT id,user_id,task,input_tokens,cached_input_tokens,output_tokens FROM ai_usage_events WHERE provider_id=? AND request_id=?').bind(provider.id,event.requestId).first<any>();if(!old&&quota)throw new AccessError('AI 请求次数已达上限，请稍后重试。',429);if(!old||old.user_id!==user.id||old.task!==event.task||old.input_tokens!==event.counts.inputTokens||old.cached_input_tokens!==event.counts.cachedInputTokens||old.output_tokens!==event.counts.outputTokens)throw new AdminInputError('重复请求的用量内容不一致。');return {id:old.id,duplicate:true};}
 return {id,duplicate:false};
}

function dateOnly(value:string){
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(value))throw new AdminInputError('日期格式不正确。');
 const n=new Date(value+'T00:00:00Z');if(!Number.isFinite(n.getTime())||n.toISOString().slice(0,10)!==value)throw new AdminInputError('日期不正确。');return value;
}

export async function finalizeAIUsage(user:Principal,provider:BillingProvider,event:UsageEvent){
 validateUsage(event.counts);const cost=estimateCostMicros(event.counts,provider.pricing),db=adminDb();
 const r=await db.prepare("UPDATE ai_usage_events SET status=?,input_tokens=?,cached_input_tokens=?,output_tokens=?,estimated_cost_micros=?,elapsed_ms=? WHERE provider_id=? AND request_id=? AND user_id=? AND task=? AND status='unknown' AND input_tokens IS NULL AND cached_input_tokens IS NULL AND output_tokens IS NULL").bind(event.status,event.counts.inputTokens,event.counts.cachedInputTokens,event.counts.outputTokens,cost,event.elapsedMs??null,provider.id,event.requestId,user.id,event.task).run();
 if(!r.meta.changes){const old=await db.prepare('SELECT status,input_tokens,cached_input_tokens,output_tokens FROM ai_usage_events WHERE provider_id=? AND request_id=? AND user_id=? AND task=?').bind(provider.id,event.requestId,user.id,event.task).first<any>();if(!old||old.status!==event.status||old.input_tokens!==event.counts.inputTokens||old.cached_input_tokens!==event.counts.cachedInputTokens||old.output_tokens!==event.counts.outputTokens)throw new AdminInputError('用量状态已更新，不能覆盖。');}
}
export function usageQuery(params:URLSearchParams){
 const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10),from=dateOnly(params.get('from')||today.slice(0,8)+'01'),to=dateOnly(params.get('to')||today);
 if(from>to)throw new AdminInputError('开始日期不能晚于结束日期。');
 const start=new Date(from+'T00:00:00+08:00').toISOString(),end=new Date(new Date(to+'T00:00:00+08:00').getTime()+86400000).toISOString();
 if(new Date(end).getTime()-new Date(start).getTime()>366*86400000)throw new AdminInputError('每次最多查询366天。');
 const userId=params.get('userId')||'',query=params.get('q')||'',providerId=params.get('providerId')||'',status=params.get('status')||'',view=params.get('view')||'users';
 if(userId.length>300||query.length>200||providerId&&!/^provider-[a-f0-9-]{36}$/.test(providerId)||status&&!['success','error','unknown'].includes(status)||!['users','events'].includes(view))throw new AdminInputError('筛选条件不正确。');
 const page=Number(params.get('page')||1),limit=Number(params.get('limit')||50);if(!Number.isSafeInteger(page)||page<1||page>100000||!Number.isSafeInteger(limit)||limit<1||limit>100)throw new AdminInputError('分页参数不正确。');
 return {from,to,start,end,userId,query,providerId,status,view,page,limit,offset:(page-1)*limit};
}
const sums=`COUNT(e.id) AS requests,
 COALESCE(SUM(e.input_tokens),0) AS input_tokens,COALESCE(SUM(e.cached_input_tokens),0) AS cached_input_tokens,COALESCE(SUM(e.output_tokens),0) AS output_tokens,
 SUM(CASE WHEN e.id IS NOT NULL AND (e.input_tokens IS NULL OR e.output_tokens IS NULL OR e.cached_input_tokens IS NULL) THEN 1 ELSE 0 END) AS unreported_requests,
 SUM(CASE WHEN e.id IS NOT NULL AND e.estimated_cost_micros IS NULL THEN 1 ELSE 0 END) AS unpriced_requests,
 SUM(CASE WHEN e.status='error' THEN 1 ELSE 0 END) AS failed_requests,
 CAST(COALESCE(SUM(CAST(e.estimated_cost_micros AS INTEGER)),0) AS TEXT) AS known_cost_micros`;
const statistics=(r:any)=>({requests:Number(r.requests),inputTokens:Number(r.input_tokens),cachedInputTokens:Number(r.cached_input_tokens),outputTokens:Number(r.output_tokens),totalTokens:Number(r.input_tokens)+Number(r.output_tokens),unreportedRequests:Number(r.unreported_requests||0),unpricedRequests:Number(r.unpriced_requests||0),failedRequests:Number(r.failed_requests||0),knownCostMicros:String(r.known_cost_micros||'0'),estimatedCostMicros:Number(r.unpriced_requests||0)>0?null:String(r.known_cost_micros||'0')});
const identities=`WITH identities AS (
 SELECT id FROM site_users UNION SELECT owner_id FROM archive_records WHERE owner_id IS NOT NULL
 UNION SELECT owner_id FROM attachments WHERE owner_id IS NOT NULL UNION SELECT owner_id FROM community_materials
 UNION SELECT user_id FROM ai_usage_events
), accounts AS (SELECT i.id,s.email,s.display_name,s.last_seen_at FROM identities i LEFT JOIN site_users s ON s.id=i.id) `;
export async function readUsage(params:URLSearchParams){
 const q=usageQuery(params),db=adminDb(),eventTerms=['e.created_at>=?','e.created_at<?'],eventArgs:any[]=[q.start,q.end],userTerms:string[]=[],userArgs:any[]=[];
 if(q.providerId){eventTerms.push('e.provider_id=?');eventArgs.push(q.providerId);}if(q.status){eventTerms.push('e.status=?');eventArgs.push(q.status);}
 if(q.userId){userTerms.push('u.id=?');userArgs.push(q.userId);}if(q.query){userTerms.push('(u.id LIKE ? OR u.email LIKE ? OR u.display_name LIKE ?)');userArgs.push(...Array(3).fill('%'+q.query+'%'));}
 const userWhere=userTerms.length?' WHERE '+userTerms.join(' AND '):'';
 const userJoin=' FROM accounts u LEFT JOIN ai_usage_events e ON e.user_id=u.id AND '+eventTerms.join(' AND ')+userWhere;
 const group=' GROUP BY u.id,u.email,u.display_name,u.last_seen_at,e.currency';
 const eventWhere=[...eventTerms,...(q.userId?['e.user_id=?']:[]),...(q.query?['(e.user_id LIKE ? OR u.email LIKE ? OR u.display_name LIKE ?)']:[])].join(' AND ');
 const eventValues=[...eventArgs,...userArgs];
 const totals=await db.prepare('SELECT e.currency,'+sums+' FROM ai_usage_events e LEFT JOIN site_users u ON u.id=e.user_id WHERE '+eventWhere+' GROUP BY e.currency').bind(...eventValues).all<any>();
 let rows:any[],total:number;
 if(q.view==='users'){
  const count=await db.prepare(identities+'SELECT COUNT(*) AS n FROM (SELECT u.id,e.currency'+userJoin+group+')').bind(...eventValues).first<{n:number}>();total=count?.n||0;
  const result=await db.prepare(identities+'SELECT u.id AS user_id,u.email,u.display_name,u.last_seen_at,e.currency,'+sums+userJoin+group+' ORDER BY requests DESC,u.id,e.currency LIMIT ? OFFSET ?').bind(...eventValues,q.limit,q.offset).all<any>();
  rows=result.results.map(r=>({userId:r.user_id,email:r.email,displayName:r.display_name,lastSeenAt:r.last_seen_at,currency:r.currency,...statistics(r)}));
 }else{
  const join=' FROM ai_usage_events e LEFT JOIN site_users u ON u.id=e.user_id WHERE '+eventWhere;
  const count=await db.prepare('SELECT COUNT(*) AS n'+join).bind(...eventValues).first<{n:number}>();total=count?.n||0;
  const result=await db.prepare('SELECT e.id,e.request_id,e.user_id,u.email,u.display_name,e.provider_name,e.model,e.task,e.status,e.currency,e.input_tokens,e.cached_input_tokens,e.output_tokens,e.estimated_cost_micros,e.elapsed_ms,e.created_at'+join+' ORDER BY e.created_at DESC,e.id DESC LIMIT ? OFFSET ?').bind(...eventValues,q.limit,q.offset).all<any>();
  rows=result.results.map(r=>({id:r.id,requestId:r.request_id,userId:r.user_id,email:r.email,displayName:r.display_name,providerName:r.provider_name,model:r.model,task:r.task,status:r.status,currency:r.currency,inputTokens:r.input_tokens,cachedInputTokens:r.cached_input_tokens,outputTokens:r.output_tokens,estimatedCostMicros:r.estimated_cost_micros,elapsedMs:r.elapsed_ms,createdAt:r.created_at}));
 }
 return {range:{from:q.from,to:q.to,timeZone:'Asia/Shanghai'},view:q.view,totals:totals.results.map(r=>({currency:r.currency,...statistics(r)})),rows,pagination:{page:q.page,limit:q.limit,total,pages:Math.max(1,Math.ceil(total/q.limit))},costBasis:'configured_price_estimate',gradingServiceStatus:'integrated'};
}
