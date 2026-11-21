// Private upstream calls bypass the framework's render-fetch cache. Workerd's
// native fetch requires its global receiver; the framework stores it unbound.
export const upstreamFetch:typeof fetch=(input,init)=>{
 const native=(globalThis as unknown as Record<symbol,typeof fetch>)[Symbol.for('vinext.fetchCache.originalFetch')]||globalThis.fetch;
 return native.call(globalThis,input,{...init,cache:'no-store'});
};

// The local Worker does not inherit HTTP_PROXY. Relay only the official OpenAI
// host through an authenticated loopback bridge; other Providers retain their path.
export function createAIFetch(relay:{url?:string;token?:string},request:typeof fetch=upstreamFetch):typeof fetch{
 return (input,init)=>{
  const target=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(target.hostname!=='api.openai.com'||!relay.url&&!relay.token)return request(input,init);
  let local:URL;try{local=new URL(relay.url||'');if(local.protocol!=='http:'||local.hostname!=='127.0.0.1'||local.pathname!=='/forward'||local.username||local.password||local.search||local.hash||!relay.token||relay.token.length<32||target.protocol!=='https:'||target.username||target.password||target.port&&target.port!=='443')throw Error();}catch{throw new Error('OpenAI 出站代理配置无效。');}
  const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));
  headers.set('x-yanyuan-upstream',target.href);headers.set('x-yanyuan-relay-token',relay.token!);
  return request(local.href,{...init,headers,redirect:'manual',cache:'no-store'});
 };
}
