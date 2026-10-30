import {principal,privateHeaders} from '../../../lib/user-access';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const u=principal(request);return Response.json({authenticated:true,userId:u.id,legacyOwner:u.legacyOwner},{headers:privateHeaders});}catch{return Response.json({authenticated:false},{headers:privateHeaders});}}
