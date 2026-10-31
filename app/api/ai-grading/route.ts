import {principal,sameOrigin,fail} from '../../../lib/user-access';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};

// Future integration point for writing, translation and oral-transcript grading.
// Adding credentials alone does not enable this placeholder. No provider is called.
const unavailable=()=>({
 enabled:false,
 status:'not_configured',
 code:'AI_GRADING_NOT_CONFIGURED',
 message:'AI 批改暂未配置',
 kinds:['writing','translation','oral'],
 score:null,
});

export async function GET(){
 return Response.json(unavailable(),{headers});
}

export async function POST(request:Request){
 try{
  principal(request);
  sameOrigin(request);
  return Response.json(unavailable(),{status:503,headers});
 }catch(error){return fail(error);}
}
