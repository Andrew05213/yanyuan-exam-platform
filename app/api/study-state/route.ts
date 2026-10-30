import {principal,fail} from '../../../lib/user-access';
import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{
    const user=principal(request),scope="(r.owner_id=? OR (r.owner_id IS NULL AND ?=1))",bind=[user.id,user.legacyOwner?1:0];
    if(!env.DB)throw Error('No DB');
    const generated=await env.DB.prepare(`SELECT DISTINCT json_extract(q.value,'$.sourceId') AS id FROM archive_records r, json_each(r.payload,'$.blocks') b, json_each(b.value,'$.questions') q WHERE ${scope} AND r.kind='packet' AND json_extract(q.value,'$.sourceId') IS NOT NULL LIMIT 20000`).bind(...bind).all<{id:string}>();
    const attempted=await env.DB.prepare(`SELECT DISTINCT json_extract(q.value,'$.sourceId') AS id FROM archive_records r, json_each(r.payload,'$.packet.blocks') b, json_each(b.value,'$.questions') q WHERE ${scope} AND r.kind IN ('written-attempt','review-attempt') AND json_extract(r.payload,'$.answers."'||json_extract(q.value,'$.id')||'"') IS NOT NULL AND trim(CAST(json_extract(r.payload,'$.answers."'||json_extract(q.value,'$.id')||'"') AS TEXT)) != '' AND json_extract(q.value,'$.sourceId') IS NOT NULL UNION SELECT DISTINCT json_extract(e.value,'$.sourceId') AS id FROM archive_records r,json_each(r.payload,'$.entries') e WHERE ${scope} AND r.kind='error-set' AND json_extract(e.value,'$.sourceId') IS NOT NULL UNION SELECT DISTINCT json_extract(a.value,'$.paperId')||':'||answers.key AS id FROM archive_records r,json_each(r.payload,'$.attempts') a,json_each(a.value,'$.answers') answers WHERE ${scope} AND r.kind='legacy-backup' LIMIT 20000`).bind(...bind,...bind,...bind).all<{id:string}>();
    const material=await env.DB.prepare(`SELECT DISTINCT json_extract(b.value,'$.materialId') AS id FROM archive_records r,json_each(r.payload,'$.blocks') b WHERE ${scope} AND r.kind='packet' AND json_extract(b.value,'$.materialId') IS NOT NULL LIMIT 5000`).bind(...bind).all<{id:string}>();
    return Response.json({generatedIds:generated.results.map(r=>r.id),attemptedIds:attempted.results.map(r=>r.id),generatedMaterials:material.results.map(r=>r.id)},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return fail(error,'学习索引暂时无法读取；本次未自动关闭去重。');}
}
