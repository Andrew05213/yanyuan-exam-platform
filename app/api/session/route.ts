import {principal,privateHeaders} from '../../../lib/user-access';
import {isAdmin,rememberUser} from '../../../lib/admin-access';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const u=principal(request);try{await rememberUser(request,u.id);}catch{/* Identity remains valid if profile tracking is temporarily unavailable. */}return Response.json({authenticated:true,userId:u.id,legacyOwner:u.legacyOwner,admin:isAdmin(request),authMode:request.headers.get('x-yanyuan-lan')==='1'?'lan':undefined},{headers:privateHeaders});}catch{return Response.json({authenticated:false},{headers:privateHeaders});}}

