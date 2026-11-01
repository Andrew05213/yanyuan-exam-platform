import {adminPrincipal} from '../../../../lib/admin-access';
import {adminReply,adminFail,adminWrite} from '../../../../lib/admin-http';
import {audioSettings,saveAudioSettings} from '../../../../lib/oral-audio-settings';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{adminPrincipal(request);return adminReply({settings:await audioSettings()});}catch(e){return adminFail(e);}
}
export async function POST(request:Request){
 try{const {user,body}=await adminWrite(request);return adminReply({settings:await saveAudioSettings(body,user.id)});}catch(e){return adminFail(e);}
}
