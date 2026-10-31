import {AdminInputError} from './admin-contracts';
import {AccessError,privateHeaders,sameOrigin} from './user-access';
import {adminPrincipal} from './admin-access';
export const adminReply=(value:unknown,status=200)=>Response.json(value,{status,headers:privateHeaders});
export function adminFail(error:unknown){
 if(error instanceof AccessError)return adminReply({error:error.message},error.status);
 if(error instanceof AdminInputError)return adminReply({error:error.message},400);
 return adminReply({error:'后台操作未完成，请稍后重试。'},503);
}
export async function adminWrite(request:Request){
 const user=adminPrincipal(request);sameOrigin(request);
 if(!request.headers.get('Content-Type')?.includes('application/json'))throw new AccessError('请提交 JSON 配置。',415);
 if(Number(request.headers.get('Content-Length'))>32768)throw new AccessError('配置内容过大。',413);
 const reader=request.body?.getReader();if(!reader)throw new AdminInputError('配置内容为空。');
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>32768){await reader.cancel();throw new AccessError('配置内容过大。',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new AdminInputError('配置格式不完整。');}
 return {user,body};
}
