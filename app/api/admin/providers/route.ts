import {adminPrincipal} from '../../../../lib/admin-access';
import {listProviders,saveProvider,selectDefaultProvider,keyStorageReady} from '../../../../lib/admin-providers';
import {adminReply,adminFail,adminWrite} from '../../../../lib/admin-http';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{adminPrincipal(request);return adminReply({providers:await listProviders(),encryptionReady:keyStorageReady()});}catch(error){return adminFail(error);}
}
export async function POST(request:Request){
 try{const {user,body}=await adminWrite(request);const provider=body?.action==='select-default'?await selectDefaultProvider(body,user.id):await saveProvider(body,user.id);return adminReply({provider});}catch(error){return adminFail(error);}
}

