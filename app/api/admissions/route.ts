import {storage} from '../../../db/store';
import {AccessError,fail,principal,privateHeaders,readLimitedText,sameOrigin} from '../../../lib/user-access';
import {admissionPlan,admissionsLanguages,defaultAdmissionsYear,assessAdmissions} from '../../../lib/admissions/plan';
import {admissionsSchools} from '../../../lib/admissions/policies';

export const dynamic='force-dynamic';
const reply=(value:unknown)=>Response.json(value,{headers:privateHeaders});
const unavailable='择校规划暂不可用，请稍后重试。';
const conflict=()=>new AccessError('方案已在另一处修改。请重新读取，再提交本次修改。',409);

export async function GET(request:Request){
  try{
    const {id}=principal(request);
    const row=await storage().prepare('SELECT payload,version,updated_at AS updatedAt FROM admissions_plans WHERE user_id=?')
      .bind(id).first<{payload:string;version:string;updatedAt:string}>();
    const plan=row?admissionPlan(JSON.parse(row.payload)):null;
    return reply({plan,version:row?.version??null,updatedAt:row?.updatedAt??null,
      analysis:plan?assessAdmissions(plan):null,schools:admissionsSchools,languages:admissionsLanguages,defaultYear:defaultAdmissionsYear()});
  }catch(error){return fail(error,unavailable);}
}

export async function POST(request:Request){
  try{
    principal(request);sameOrigin(request);
    return reply({analysis:assessAdmissions(admissionPlan(JSON.parse(await readLimitedText(request,16000))))});
  }catch(error){return fail(error instanceof SyntaxError?new AccessError('方案格式无效。',400):error,unavailable);}
}

export async function PUT(request:Request){
  try{
    const {id}=principal(request);sameOrigin(request);
    const body=JSON.parse(await readLimitedText(request,16000));
    const plan=admissionPlan(body?.plan),expected=body?.version;
    if(expected!==null&&(typeof expected!=='string'||!expected||expected.length>64))throw new AccessError('请重新读取方案版本。',400);
    const version=crypto.randomUUID(),updatedAt=new Date().toISOString(),payload=JSON.stringify(plan),db=storage();
    const statement=expected===null
      ? db.prepare('INSERT INTO admissions_plans(user_id,payload,version,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO NOTHING').bind(id,payload,version,updatedAt)
      : db.prepare('UPDATE admissions_plans SET payload=?,version=?,updated_at=? WHERE user_id=? AND version=?').bind(payload,version,updatedAt,id,expected);
    if(!(await statement.run()).meta.changes)throw conflict();
    return reply({plan,version,updatedAt,analysis:assessAdmissions(plan)});
  }catch(error){return fail(error instanceof SyntaxError?new AccessError('方案格式无效。',400):error,unavailable);}
}

export async function DELETE(request:Request){
  try{
    const {id}=principal(request);sameOrigin(request);
    const version=request.headers.get('If-Match');
    if(!version||version.length>64)throw new AccessError('请重新读取方案版本。',400);
    const result=await storage().prepare('DELETE FROM admissions_plans WHERE user_id=? AND version=?').bind(id,version).run();
    if(!result.meta.changes)throw conflict();
    return reply({ok:true});
  }catch(error){return fail(error,unavailable);}
}
