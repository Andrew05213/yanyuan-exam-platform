import {adminPrincipal} from '../../../../lib/admin-access';
import {adminReply,adminFail} from '../../../../lib/admin-http';
import {readUsage} from '../../../../lib/ai-usage';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{adminPrincipal(request);return adminReply(await readUsage(new URL(request.url).searchParams));}catch(error){return adminFail(error);}}

