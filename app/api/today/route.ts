import {env} from "cloudflare:workers";
import {principal, fail, privateHeaders} from "../../../lib/user-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = principal(request);
    if(!env.DB) throw Error("missing database");
    const notes = env.DB.prepare(`SELECT id,title,updated_at,review_on,work_id,tags FROM entries
      WHERE user_id=? ORDER BY updated_at DESC`).bind(user.id);
    const records = env.DB.prepare(`SELECT id,title,kind,updated_at,
      json_extract(payload,'$.kind') AS subtype, json_extract(payload,'$.packet.id') AS packet,
      json_extract(payload,'$.parentId') AS parent, json_extract(payload,'$.correct') AS correct,
      json_extract(payload,'$.total') AS total FROM archive_records
      WHERE (owner_id=? OR (owner_id IS NULL AND ?=1))
      AND kind IN ('packet','written-attempt','oral-attempt','error-set','review-attempt')
      ORDER BY updated_at DESC,id DESC`).bind(user.id,user.legacyOwner ? 1 : 0);
    const [n,a] = await env.DB.batch<Record<string,string|number|null>>([notes,records]);
    const entries = n.results, rows = a.results;
    const now = Date.now(), day = 86400000;
    const date = new Date(now + 8*3600000).toISOString().slice(0,10);
    const week = (value: unknown) => Date.parse(String(value)) >= now - 7*day;
    const completed = new Set(rows.filter(r=>r.kind==="written-attempt").map(r=>r.packet));
    const packet = rows.find(r=>r.kind==="packet" && r.subtype==="written" && !completed.has(r.id));
    const reviews = new Map<unknown,typeof rows>();
    for(const r of rows.filter(r=>r.kind==="review-attempt")) {
      const group = reviews.get(r.parent) ?? [];
      group.push(r); reviews.set(r.parent,group);
    }
    const due = rows.filter(r=>r.kind==="error-set").filter(r=>{
      const history = reviews.get(r.id) ?? [];
      if(!history.length) return true;
      let streak=0;
      for(const h of history) { if(!h.total || h.correct!==h.total) break; streak++; }
      const days=[1,3,7,14][Math.min(streak,3)];
      return Date.parse(String(history[0].updated_at))+days*day<=now;
    });
    const item=(r:Record<string,unknown>)=>({id:r.id,title:r.title});
    const recent=entries.find(e=>e.work_id);
    return Response.json({notes:entries.filter(e=>e.review_on && String(e.review_on)<=date).map(item),
      recent:recent && item(recent), packet:packet && item(packet), mistakes:due.map(item),
      week:{practice:rows.filter(r=>['written-attempt','oral-attempt'].includes(String(r.kind))&&week(r.updated_at)).length,
        review:rows.filter(r=>r.kind==="review-attempt"&&week(r.updated_at)).length,
        notes:entries.filter(e=>week(e.updated_at)).length,
        oral:entries.filter(e=>String(e.tags||'').includes('面试复练')&&week(e.updated_at)).length}},
      {headers:privateHeaders});
  } catch(error) { return fail(error,"暂时无法读取今日学习记录。"); }
}
