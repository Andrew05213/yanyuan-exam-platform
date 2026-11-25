import {storage} from "../../../../db/store";
import {principal,AccessError,fail,privateHeaders,readLimitedText,sameOrigin} from "../../../../lib/user-access";
import {communityAccess,requireCommunity} from "../../../../lib/community-access";
import {isAdmin} from "../../../../lib/admin-access";
export const dynamic="force-dynamic";
const json=(x:unknown,status=200)=>Response.json(x,{status,headers:privateHeaders});
const id=(x:unknown)=>{if(typeof x!=="string"||!/^[a-f0-9-]{36}$/i.test(x))throw new AccessError("编号无效。",400);return x;};
const reason=(x:unknown)=>{if(typeof x!=="string"||!x.trim()||x.length>500)throw new AccessError("请填写处理依据（最多500字）。",400);return x.trim();};
const now=()=>new Date().toISOString();
const db=storage;
const hash=async(code:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(code))),x=>x.toString(16).padStart(2,"0")).join("");
const audit=(d:ReturnType<typeof storage>,actor:string,action:string,target:string,why:string,date:string)=>d.prepare("INSERT INTO research_governance_audit(id,actor_id,action,target_id,reason,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),actor,action,target,why,date);
export async function GET(request:Request){try{
 const uid=principal(request).id,access=await communityAccess(request,uid),params=new URL(request.url).searchParams,d=db();
 if(params.has("manage")){
  await requireCommunity(request,uid,"moderate");
  const raw=params.get("offset")||"0";if(!/^\d{1,5}$/.test(raw)||Number(raw)>10000)throw new AccessError("分页无效。",400);const offset=Number(raw);
  const members=(await d.prepare("SELECT id,role,state,mute_until AS muteUntil,reason,revision,updated_at AS updatedAt FROM research_memberships ORDER BY updated_at DESC,id LIMIT 51 OFFSET ?").bind(offset).all()).results;
  const appeals=(await d.prepare("SELECT a.id,m.id AS memberId,a.member_revision AS memberRevision,a.body,a.status,a.resolution,a.created_at AS createdAt FROM research_appeals a JOIN research_memberships m ON m.user_id=a.user_id WHERE a.status='pending' AND (?=1 OR m.role='member') ORDER BY a.created_at LIMIT 51").bind(isAdmin(request)?1:0).all()).results;
  const invites=isAdmin(request)?(await d.prepare("SELECT id,created_at AS createdAt,expires_at AS expiresAt,revoked_at AS revokedAt,used_at AS usedAt FROM research_invites ORDER BY created_at DESC LIMIT 100").all()).results:[];
  const logs=isAdmin(request)?(await d.prepare("SELECT id,actor_id AS actorId,action,target_id AS targetId,reason,created_at AS createdAt FROM research_governance_audit ORDER BY created_at DESC LIMIT 100").all()).results:[];
  return json({members:members.slice(0,50),nextOffset:members.length>50?offset+50:null,appeals:appeals.slice(0,50),invites,logs});
 }
 const appeals=(await d.prepare("SELECT id,member_revision AS memberRevision,status,resolution,created_at AS createdAt FROM research_appeals WHERE user_id=? ORDER BY created_at DESC LIMIT 20").bind(uid).all()).results;
 return json({...access,appeals});
 }catch(e){return fail(e,"社区权限暂不可用。");}}
export async function POST(request:Request){try{
 const uid=principal(request).id; sameOrigin(request);
 let b:Record<string,unknown>;try{b=JSON.parse(await readLimitedText(request,8000));}catch(e){if(e instanceof AccessError)throw e;throw new AccessError("请求无效。",400);}
 if(!b||typeof b!=="object"||Array.isArray(b))throw new AccessError("请求无效。",400);
 const d=db(),date=now(),action=b.action;
 if(action==="redeem"){
  if(typeof b.code!=="string"||!/^[a-f0-9]{64}$/.test(b.code))throw new AccessError("邀请码无效或已失效。",400);
  const access=await communityAccess(request,uid);if(access.role!=="student")throw new AccessError("已有社区资格记录，请联系管理员处理恢复或申诉。",409);
  const h=await hash(b.code),claim=crypto.randomUUID(),member=crypto.randomUUID(),log=crypto.randomUUID();
  const result=await d.batch([
   d.prepare("UPDATE research_invites SET used_by=?,used_at=?,claim_id=? WHERE code_hash=? AND revoked_at IS NULL AND used_at IS NULL AND expires_at>? AND NOT EXISTS(SELECT 1 FROM research_memberships WHERE user_id=?)").bind(uid,date,claim,h,date,uid),
   d.prepare("INSERT INTO research_memberships(user_id,id,role,state,revision,change_id,created_at,updated_at) SELECT ?,?,'member','active',1,?,?,? WHERE EXISTS(SELECT 1 FROM research_invites WHERE claim_id=? AND used_by=?)").bind(uid,member,claim,date,date,claim,uid),
   d.prepare("INSERT INTO research_governance_audit(id,actor_id,action,target_id,reason,created_at) SELECT ?,?,'redeem',?,'社区邀请兑换',? WHERE EXISTS(SELECT 1 FROM research_memberships WHERE user_id=? AND change_id=?)").bind(log,uid,member,date,uid,claim)
  ]);
  if(!result[0].meta.changes||!result[1].meta.changes)throw new AccessError("邀请码无效或已失效。",409);return json({ok:true});
 }
 if(action==="appeal"){
  const a=await communityAccess(request,uid);
  if(!a.member||a.write)throw new AccessError("当前没有可申诉的社区权限限制。",409);
  const body=reason(b.reason);
  const r=await d.prepare("INSERT INTO research_appeals(id,user_id,member_revision,body,created_at) SELECT ?,user_id,revision,?,? FROM research_memberships WHERE user_id=? AND revision=? ON CONFLICT(user_id,member_revision) DO NOTHING").bind(crypto.randomUUID(),body,date,uid,a.member.revision).run();
  if(!r.meta.changes)throw new AccessError("该次处理已经提交申诉。",409);return json({ok:true},201);
 }
 if(action==="createInvite"||action==="revokeInvite"){
  if(!isAdmin(request))throw new AccessError("仅系统管理员可管理邀请。",403);
  if(action==="createInvite"){
   const ttl=b.days===undefined?7:b.days;if(typeof ttl!=="number"||!Number.isInteger(ttl)||ttl<1||ttl>30)throw new AccessError("有效期须为1至30天。",400);
   const raw=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join(""),invite=crypto.randomUUID(),expires=new Date(Date.now()+ttl*86400000).toISOString();
   await d.batch([d.prepare("INSERT INTO research_invites(id,code_hash,created_by,created_at,expires_at) VALUES(?,?,?,?,?)").bind(invite,await hash(raw),uid,date,expires),audit(d,uid,"invite-create",invite,"单次社区邀请",date)]);
   return json({id:invite,code:raw,expiresAt:expires},201);
  }
  const invite=id(b.id),why=reason(b.reason),log=crypto.randomUUID();
  const r=await d.batch([d.prepare("UPDATE research_invites SET revoked_at=? WHERE id=? AND used_at IS NULL AND revoked_at IS NULL").bind(date,invite),d.prepare("INSERT INTO research_governance_audit(id,actor_id,action,target_id,reason,created_at) SELECT ?,?,'invite-revoke',?,?,? WHERE EXISTS(SELECT 1 FROM research_invites WHERE id=? AND revoked_at=?)").bind(log,uid,invite,why,date,invite,date)]);
  if(!r[0].meta.changes)throw new AccessError("邀请不可撤销或已使用。",409);return json({ok:true});
 }
 await requireCommunity(request,uid,"moderate");
 if(action==="member"){
  const member=id(b.id),why=reason(b.reason),change=crypto.randomUUID(),revision=b.revision;
  if(typeof revision!=="number"||!Number.isSafeInteger(revision)||revision<1)throw new AccessError("请重新读取成员版本。",400);
  const current=await d.prepare("SELECT user_id AS uid,role,state,revision FROM research_memberships WHERE id=?").bind(member).first<{uid:string;role:string;state:string;revision:number}>();
  if(!current)throw new AccessError("成员不存在。",404);
  if(current.uid===uid||(!isAdmin(request)&&current.role!=="member"))throw new AccessError("不能处理自己或越权处理管理员。",403);
  const decision=b.decision;
  let role=current.role,state=current.state,mute:string|null=null;
  if(decision==="mute"){const days=b.days;if(typeof days!=="number"||!Number.isInteger(days)||days<1||days>30||state!=="active")throw new AccessError("禁言期限须为1至30天，且成员须有效。",400);mute=new Date(Date.now()+days*86400000).toISOString();}
  else if(decision==="suspend")state="suspended";
  else if(decision==="revoke")state="revoked";
  else if(decision==="restore")state="active";
  else if(decision==="promote"||decision==="demote"){if(!isAdmin(request)||state!=="active")throw new AccessError("仅系统管理员可任命有效社区成员。",403);role=decision==="promote"?"moderator":"member";}
  else throw new AccessError("处理方式无效。",400);
  const r=await d.batch([
   d.prepare("UPDATE research_memberships SET role=?,state=?,mute_until=?,reason=?,revision=revision+1,change_id=?,updated_at=? WHERE id=? AND revision=?").bind(role,state,mute,why,change,date,member,revision),
   d.prepare("INSERT INTO research_governance_audit(id,actor_id,action,target_id,reason,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM research_memberships WHERE id=? AND change_id=?)").bind(crypto.randomUUID(),uid,"member-"+decision,member,why,date,member,change)
  ]);
  if(!r[0].meta.changes)throw new AccessError("成员权限已更新，请刷新。",409);return json({ok:true});
 }
 if(action==="resolveAppeal"){
  const appeal=id(b.id),why=reason(b.reason),decision=b.decision;
  if(decision!=="accepted"&&decision!=="dismissed")throw new AccessError("处理方式无效。",400);
  const a=await d.prepare("SELECT a.user_id AS uid,a.member_revision AS revision,m.id AS memberId,m.role,m.revision AS currentRevision FROM research_appeals a JOIN research_memberships m ON m.user_id=a.user_id WHERE a.id=? AND a.status='pending'").bind(appeal).first<{uid:string;revision:number;memberId:string;role:string;currentRevision:number}>();
  if(!a||a.uid===uid||(!isAdmin(request)&&a.role!=="member"))throw new AccessError("申诉不存在或不可处理。",404);
  // Acceptance is a documented review outcome; restoration is a separate version-checked member decision.
  const r=await d.batch([d.prepare("UPDATE research_appeals SET status=?,resolution=?,resolved_by=?,resolved_at=? WHERE id=? AND status='pending'").bind(decision,why,uid,date,appeal),d.prepare("INSERT INTO research_governance_audit(id,actor_id,action,target_id,reason,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM research_appeals WHERE id=? AND resolved_by=? AND resolved_at=?)").bind(crypto.randomUUID(),uid,"appeal-"+decision,a.memberId,why,date,appeal,uid,date)]);
  if(!r[0].meta.changes)throw new AccessError("申诉已处理。",409);return json({ok:true,restoreSeparately:decision==="accepted"});
 }
 throw new AccessError("未知操作。",400);
 }catch(e){return fail(e,"社区治理操作未完成。");}}
