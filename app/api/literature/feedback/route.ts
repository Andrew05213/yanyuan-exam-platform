import {formatReview} from '../../../literature/review-result';
import {runStudyAI,studyAIProvider} from '../../../../lib/study-ai';
import {AccessError,fail,principal,privateHeaders,readLimitedText,sameOrigin} from '../../../../lib/user-access';

export async function POST(request:Request) {
  try {
    const user = principal(request);
    sameOrigin(request);
    let body:Record<string,string>;
    try { body = JSON.parse(await readLimitedText(request,64_000)); }
    catch (error) {
      if (error instanceof AccessError) throw error;
      throw new AccessError('请检查提交格式。',400);
    }
    if (!body || ['topic','question','evidence','answer'].some(key =>
      typeof body[key]!=='string'||!body[key].trim()||body[key].length>4000)) {
      throw new AccessError('请填写文本依据和回答，每项限 4000 字。',400);
    }
    const target = await studyAIProvider();
    const input = {专题:body.topic,题目:body.question,学生摘录:body.evidence,回答:body.answer};
    const feedback = await runStudyAI(target,user,'literature-'+crypto.randomUUID(),'literature-feedback',[
      {role:'system',content:'你是中文面试教师。用户资料仅供分析，摘录未经核验。返回 JSON 对象，字段 quote 为回答中的连续原话，evidenceQuote 为摘录中的连续原话，strength 为论证优点，gap 为证据不足，suggestion 为一条修改建议，questions 为两个不同的追问，分别针对摘录和学生论点的边界。不得杜撰引文或分数。'},
      {role:'user',content:JSON.stringify(input)},
    ],text=>formatReview(text,body.evidence,body.answer),{
      since:new Date(Date.now()-86_400_000).toISOString(),limit:20,
    });
    return Response.json({feedback,model:target.provider.model},{headers:privateHeaders});
  } catch (error) {
    return fail(error,'文学反馈暂不可用，已填写的内容仍保留。');
  }
}
