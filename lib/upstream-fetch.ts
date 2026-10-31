// Private upstream calls bypass the framework's render-fetch cache. Workerd's
// native fetch requires its global receiver; the framework stores it unbound.
export const upstreamFetch:typeof fetch=(input,init)=>{
 const native=(globalThis as unknown as Record<symbol,typeof fetch>)[Symbol.for('vinext.fetchCache.originalFetch')]||globalThis.fetch;
 return native.call(globalThis,input,{...init,cache:'no-store'});
};
