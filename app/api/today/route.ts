import {storage} from "../../../db/store";
import {principal,privateHeaders,fail} from "../../../lib/user-access";
export const dynamic="force-dynamic";
type Note={id:string;title:string;reviewOn:string|null;updatedAt:string};
type RecordSummary={kind:string;title:string;updatedAt:string};
export async function GET(request:Request){
 try{
  const user=principal(request),db=storage();
  // The China deployment uses the same Shanghai calendar as the existing learning report.
  const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  const start=new Date(today+"T00:00:00+08:00").toISOString(),end=new Date(Date.parse(start)+86400000).toISOString();
  const owned="(owner_id=? OR (owner_id IS NULL AND ?=1))",args=[user.id,user.legacyOwner?1:0];
  const [dueCount,due,recent,records,errors,edits,activity]=await Promise.all([
   db.prepare("SELECT count(*) AS n FROM entries WHERE user_id=? AND folder='active' AND review_on IS NOT NULL AND review_on<>'' AND review_on<=?").bind(user.id,today).first<{n:number}>(),
   db.prepare("SELECT id,title,review_on AS reviewOn,updated_at AS updatedAt FROM entries WHERE user_id=? AND folder='active' AND review_on IS NOT NULL AND review_on<>'' AND review_on<=? ORDER BY review_on,id LIMIT 8").bind(user.id,today).all<Note>(),
   db.prepare("SELECT id,title,review_on AS reviewOn,updated_at AS updatedAt FROM entries WHERE user_id=? AND folder='active' AND length(trim(content))>0 ORDER BY updated_at DESC,id LIMIT 5").bind(user.id).all<Note>(),
   db.prepare("SELECT kind,title,updated_at AS updatedAt FROM archive_records WHERE "+owned+" AND kind IN ('packet','oral-attempt','written-attempt','review-attempt','essay','error-set') ORDER BY updated_at DESC,id LIMIT 5").bind(...args).all<RecordSummary>(),
   db.prepare("SELECT count(*) AS n FROM archive_records WHERE "+owned+" AND kind='error-set'").bind(...args).first<{n:number}>(),
   db.prepare("SELECT count(*) AS n FROM entries WHERE user_id=? AND folder='active' AND updated_at>=? AND updated_at<?").bind(user.id,start,end).first<{n:number}>(),
   db.prepare("SELECT count(*) AS n FROM archive_records WHERE "+owned+" AND updated_at>=? AND updated_at<? AND kind IN ('packet','oral-attempt','written-attempt','review-attempt','essay','error-set')").bind(...args,start,end).first<{n:number}>()
  ]);
  return Response.json({today,timeZone:"Asia/Shanghai",dueCount:dueCount?.n??0,due:due.results,recentNotes:recent.results,recentRecords:records.results,errorSets:errors?.n??0,notesUpdatedToday:edits?.n??0,recordsUpdatedToday:activity?.n??0},{headers:privateHeaders});
 }catch(e){return fail(e,"今日学习记录暂不可用，请稍后重试。");}
}
