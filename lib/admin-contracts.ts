export const PROTOCOLS=['openai-compatible','anthropic','gemini','custom'] as const;
export const CURRENCIES=['USD','CNY','EUR'] as const;
export class AdminInputError extends Error{}
export function priceToMicros(value:unknown):number|null{
 if(value===null||value===undefined||value==='')return null;
 if(typeof value!=='string'||!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/.test(value))throw new AdminInputError('单价须为非负数，最多保留六位小数。');
 const [whole,fraction='']=value.split('.');return Number(BigInt(whole)*BigInt(1000000)+BigInt(fraction.padEnd(6,'0')));
}
export function microsToPrice(value:unknown){
 if(value===null||value===undefined)return '';
 const n=BigInt(String(value));return (n/BigInt(1000000)).toString()+'.'+(n%BigInt(1000000)).toString().padStart(6,'0');
}
export function publicBaseUrl(value:unknown){
 try{if(typeof value!=='string'||value.length>1500)throw Error();const u=new URL(value);const host=u.hostname.toLowerCase().replace(/\.$/,'');
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.port&&u.port!=='443'||!host.includes('.')||/^[\d.]+$/.test(host)||host.includes(':')||host.startsWith('[')||/(?:^|\.)(?:localhost|local|internal|lan)$/.test(host))throw Error();
 u.hostname=host;return u.toString().replace(/\/+$/,'');}catch{throw new AdminInputError('Provider 地址须为公开 HTTPS 地址，不得包含密钥、账号、查询参数或内网地址。');}
}
export function providerInput(body:any){
 if(!body||typeof body!=='object'||Array.isArray(body))throw new AdminInputError('配置字段不完整。');
 const fields=new Set(['id','expectedRevision','name','protocol','baseUrl','model','currency','enabled','apiKey','clearKey','inputPrice','cachedInputPrice','outputPrice']);
 if(Object.keys(body).some(k=>!fields.has(k)))throw new AdminInputError('存在不支持的配置字段。');
 const text=(name:string,max:number)=>{const v=body[name];if(typeof v!=='string'||!v.trim()||v.length>max||/[\r\n\u0000]/.test(v))throw new AdminInputError('请检查名称、接口协议和模型等配置。');return v.trim();};
 const id=body.id;if(id!==undefined&&(typeof id!=='string'||!/^provider-[a-f0-9-]{36}$/.test(id)))throw new AdminInputError('Provider 编号不正确。');
 const revision=body.expectedRevision??0;if(!Number.isSafeInteger(revision)||revision<0||(!id&&revision!==0))throw new AdminInputError('配置版本不正确。');
 if(!PROTOCOLS.includes(body.protocol)||!CURRENCIES.includes(body.currency)||typeof body.enabled!=='boolean')throw new AdminInputError('接口协议、币种或启用状态不正确。');
 if(body.clearKey!==undefined&&typeof body.clearKey!=='boolean')throw new AdminInputError('密钥操作不正确。');
 let key:string|undefined;
 if(body.apiKey!==undefined){if(typeof body.apiKey!=='string')throw new AdminInputError('密钥格式不正确。');const candidate=body.apiKey.trim();if(candidate.length>4096||candidate&&(/\s/.test(candidate)||candidate.length<8))throw new AdminInputError('密钥格式不正确。');key=candidate||undefined;}
 if(key&&body.clearKey)throw new AdminInputError('更换和清除密钥不能同时提交。');
 return {id,revision,name:text('name',80),protocol:body.protocol as string,baseUrl:publicBaseUrl(body.baseUrl),model:text('model',150),currency:body.currency as string,enabled:body.enabled,key,clearKey:!!body.clearKey,inputPriceMicros:priceToMicros(body.inputPrice),cachedInputPriceMicros:priceToMicros(body.cachedInputPrice),outputPriceMicros:priceToMicros(body.outputPrice)};
}
export type UsageCounts={inputTokens:number|null;cachedInputTokens:number|null;outputTokens:number|null};
export type Pricing={inputPriceMicros:number|null;cachedInputPriceMicros:number|null;outputPriceMicros:number|null};
export function validateUsage(counts:UsageCounts){
 for(const value of Object.values(counts))if(value!==null&&(!Number.isSafeInteger(value)||value<0||value>100000000))throw new AdminInputError('Token 用量不正确。');
 if(counts.inputTokens!==null&&counts.cachedInputTokens!==null&&counts.cachedInputTokens>counts.inputTokens)throw new AdminInputError('缓存 Token 不能超过输入 Token。');
}
export function estimateCostMicros(counts:UsageCounts,prices:Pricing):string|null{
 validateUsage(counts);const {inputTokens:input,cachedInputTokens:cached,outputTokens:output}=counts;
 if(input===null||cached===null||output===null)return null;
 const parts:[[number,number|null],[number,number|null],[number,number|null]]=[[input-cached,prices.inputPriceMicros],[cached,prices.cachedInputPriceMicros],[output,prices.outputPriceMicros]];
 let sum=BigInt(0);for(const [tokens,price] of parts){if(!tokens)continue;if(price===null)return null;if(!Number.isSafeInteger(price)||price<0)throw new AdminInputError('模型单价不正确。');sum+=BigInt(tokens)*BigInt(price);}
 return ((sum+BigInt(500000))/BigInt(1000000)).toString();
}

