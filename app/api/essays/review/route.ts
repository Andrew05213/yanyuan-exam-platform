import {principal,AccessError,fail} from '../../../../lib/user-access';
import {saveEssayReview} from '../../../../lib/study-store';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  try{
    const user=principal(request);const origin=request.headers.get('Origin'),url=new URL(request.url);
    if(request.headers.get('Sec-Fetch-Site')==='cross-site'||(origin&&new URL(origin).host!==url.host&&new URL(origin).host!==request.headers.get('Host')))return Response.json({error:'请从本站导入批改'},{status:403});
    const raw=await request.text();if(raw.length>750000)return Response.json({error:'批改文件过大'},{status:413});
    const body=JSON.parse(raw);if(typeof body.essayId!=='string'||typeof body.sourceHash!=='string')throw Error('缺少原稿编号或版本校验');
    const record=await saveEssayReview(user,body.essayId,body.sourceHash,body.review,'导入批改');
    return Response.json({record},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){if(error instanceof AccessError)return fail(error);return Response.json({error:(error as Error).message||'批改导入未完成'},{status:400,headers:{'Cache-Control':'private, no-store'}});}
}
