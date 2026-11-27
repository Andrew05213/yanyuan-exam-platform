import {AccessError,fail,principal,privateHeaders,readLimitedText,sameOrigin} from '../../../../lib/user-access';
import {runStudyAI,studyAIProvider} from '../../../../lib/study-ai';

const dimensions=['学业能力','专业偏好','院校平台','地域偏好','职业规划','风险偏好','费用约束','家庭决策','备考路径','信息完整性'];
export async function POST(request:Request){
  try{
    const user=principal(request);
    sameOrigin(request);
    const b=JSON.parse(await readLimitedText(request,1200));
    if(b?.consent!==true||!Number.isInteger(b.dimension)||!dimensions[b.dimension]||
       !Array.isArray(b.levels)||b.levels.length!==2||b.levels.some((n:unknown)=>n!==null&&(!Number.isInteger(n)||Number(n)<0||Number(n)>3))||
       !['初问','条件明确','仍不确定','条件有冲突'].includes(b.feedback))throw new AccessError('请确认发送的维度及回答。',400);
    const question=await runStudyAI(await studyAIProvider(),user,crypto.randomUUID(),'admissions-followup',[
      {role:'system',content:'为外国语保送生设计一个具体的情境取舍追问，结合本维度两项等级（0至3或未知）和上一轮反馈。让学生能据此重新评估自己的选择。禁止索取身份、家庭金额或任何个人标识，禁止给录取意见。仅返回 JSON 对象 question，最多160字。'},
      {role:'user',content:JSON.stringify({维度:dimensions[b.dimension],等级:b.levels,上轮反馈:b.feedback})},
    ],raw=>{
      const q=JSON.parse(raw)?.question;
      if(typeof q!=='string'||!q.trim()||q.length>160)throw Error();
      return q.trim();
    },{since:new Date(Date.now()-86400000).toISOString(),limit:30});
    return Response.json({question},{headers:privateHeaders});
  }catch(error){return fail(error instanceof SyntaxError?new AccessError('请求格式无效。',400):error,'追问暂不可用。');}
}
