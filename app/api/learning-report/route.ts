import {and,desc,inArray,sql} from 'drizzle-orm';
import {getDb} from '../../../db/index';
import {archiveRecords} from '../../../db/schema';
import {principal,owned,fail,privateHeaders} from '../../../lib/user-access';
import {buildLearningReport} from '../../../lib/learning-report';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 const user=principal(request),db=getDb();
 const rows=await db.select({id:archiveRecords.id,size:sql<number>`length(cast(${archiveRecords.payload} as blob))`}).from(archiveRecords).where(and(owned(archiveRecords.ownerId,user),inArray(archiveRecords.kind,['error-set','written-attempt','review-attempt']))).orderBy(desc(archiveRecords.updatedAt),desc(archiveRecords.id)).limit(2001);
 // Bound total JSON memory as well as record count. Private packet snapshots can be large.
 let bytes=0;const ids:string[]=[];for(const r of rows.slice(0,2000)){if(bytes+r.size>8_000_000)break;bytes+=r.size;ids.push(r.id);}
 const records=[];for(let i=0;i<ids.length;i+=50){const batch=await db.select({id:archiveRecords.id,kind:archiveRecords.kind,updatedAt:archiveRecords.updatedAt,createdAt:archiveRecords.createdAt,payload:archiveRecords.payload}).from(archiveRecords).where(and(owned(archiveRecords.ownerId,user),inArray(archiveRecords.id,ids.slice(i,i+50))));for(const r of batch)records.push({...r,payload:JSON.parse(r.payload)});}
 return Response.json({...buildLearningReport(records),recordsUsed:records.length,truncated:rows.length>2000||ids.length<Math.min(rows.length,2000),generatedAt:new Date().toISOString()},{headers:privateHeaders});
}catch(e){return fail(e,'分析报告暂时无法生成。');}}
