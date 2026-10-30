import {env} from 'cloudflare:workers';
import {eq,or,and,isNull,sql} from 'drizzle-orm';
export type Principal={id:string;legacyOwner:boolean};
export class AccessError extends Error{constructor(message:string,public status=401){super(message);}}
export function principal(request:Request):Principal{
 const id=request.headers.get('oai-authenticated-user-id');
 if(!id||id.length>300)throw new AccessError('请登录后使用自己的学习资料库。');
 const expected=(env as unknown as Record<string,unknown>).LEGACY_OWNER_EMAIL;
 const email=request.headers.get('oai-authenticated-user-email');
 return {id,legacyOwner:typeof expected==='string'&&!!expected.trim()&&email?.trim().toLowerCase()===expected.trim().toLowerCase()};
}
export function owned(column:any,user:Principal){return or(eq(column,user.id),and(isNull(column),sql`${user.legacyOwner?1:0}=1`))!;}
export function owns(ownerId:string|null|undefined,user:Principal){return ownerId===user.id||(ownerId==null&&user.legacyOwner);}
export function sameOrigin(request:Request){const origin=request.headers.get('Origin'),url=new URL(request.url);try{if(request.headers.get('Sec-Fetch-Site')==='cross-site'||(origin&&new URL(origin).host!==url.host&&new URL(origin).host!==request.headers.get('Host')))throw Error();}catch{throw new AccessError('请从本站页面提交。',403);}}
export const privateHeaders={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export function fail(error:unknown,fallback='操作未完成，请重试。'){return Response.json({error:error instanceof AccessError?error.message:fallback},{status:error instanceof AccessError?error.status:503,headers:privateHeaders});}
