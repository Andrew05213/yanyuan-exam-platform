import {adminPrincipal,rememberUser} from '../../../../lib/admin-access';
import {keyStorageReady} from '../../../../lib/admin-providers';
import {adminReply,adminFail} from '../../../../lib/admin-http';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{const user=adminPrincipal(request);try{await rememberUser(request,user.id);}catch{/* Session authorization does not depend on profile tracking. */}return adminReply({admin:true,userId:user.id,email:request.headers.get('oai-authenticated-user-email')||null,encryptionReady:keyStorageReady(),gradingServiceStatus:'integrated'});}catch(error){return adminFail(error);}
}

