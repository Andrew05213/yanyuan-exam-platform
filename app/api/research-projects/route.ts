import {storage} from '../../../db/store';
import {AccessError,fail,principal,privateHeaders,readLimitedText,sameOrigin} from '../../../lib/user-access';
import {noteId} from '../../literature/notes';
import {
  addMilestone,createProject,invite,linkPrivateNote,respond,revoke,role,setMilestone,
  transition,unlinkPrivateNote,updateProject,viewProject,
} from '../../../lib/research-projects/core.mjs';

export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders});
const missing=()=>new AccessError('研究项目不存在或无法访问。',404);
const stale=()=>new AccessError('项目已更新，请重新读取后重试。',409);
const bad=()=>new AccessError('请检查项目字段。',400);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Member={userId:string;state:string;key:string};
type Project={id:string;ownerId:string;title:string;question:string;description:string;status:string;revision:number;
  members:Member[];milestones:{id:string;title:string;done:boolean}[];links:{ownerId:string;noteId:string}[]};
type Row={payload:string;updatedAt:string};
type Note={id:string;title:string};
type LinkedNote=Note&{folder:string};
type Store=ReturnType<typeof storage>;

// Visibility is scoped in the database, including invitations and current membership.
const membershipScope="p.owner_id=? OR (p.status='active'"+
  " AND EXISTS(SELECT 1 FROM json_each(p.payload,'$.members') m WHERE json_extract(m.value,'$.userId')=? AND json_extract(m.value,'$.state') IN ('active','pending'))"+
  " AND EXISTS(SELECT 1 FROM research_memberships WHERE user_id=p.owner_id AND state='active' AND role IN ('member','moderator'))"+
  " AND EXISTS(SELECT 1 FROM research_memberships WHERE user_id=? AND state='active' AND role IN ('member','moderator'))"+
  " AND NOT EXISTS(SELECT 1 FROM research_blocks WHERE (blocker_id=p.owner_id AND blocked_id=?) OR (blocker_id=? AND blocked_id=p.owner_id)))";
const scopeArgs=(actor:string)=>[actor,actor,actor,actor,actor];
const safeId=(value:unknown)=>{if(typeof value!=='string'||!uuid.test(value))throw missing();return value;};
const readProject=(row:Row)=>JSON.parse(row.payload) as Project;

async function notes(db:Store,actor:string){
  return (await db.prepare("SELECT id,title FROM entries WHERE user_id=? AND folder='active' ORDER BY updated_at DESC,id LIMIT 300").bind(actor).all<Note>()).results;
}

function summary(project:Project,actor:string,updatedAt:string){
  return {id:project.id,title:project.title,status:project.status,revision:project.revision,
    role:role(project,actor)??'invited',updatedAt};
}

async function detail(project:Project,actor:string,db:Store){
  const view=viewProject(project,actor);
  const ownedIds=project.links.filter(l=>l.ownerId===actor).map(l=>l.noteId);
  const links=ownedIds.length?(await db.prepare("SELECT l.value AS id,COALESCE(e.title,'笔记已不可用') AS title,COALESCE(e.folder,'missing') AS folder"+
    " FROM json_each(?) l LEFT JOIN entries e ON e.user_id=? AND e.id=l.value ORDER BY e.updated_at DESC,l.value")
    .bind(JSON.stringify(ownedIds),actor).all<LinkedNote>()).results:[];
  return {id:view.id,title:view.title,question:view.question,description:view.description,status:view.status,
    revision:view.revision,role:view.role,milestones:view.milestones,
    links,
    ...(view.role==='owner'?{members:project.members.map(m=>({id:m.key,state:m.state}))}:{})};
}

async function loadProject(db:Store,actor:string,id:string){
  const row=await db.prepare("SELECT p.payload,p.updated_at AS updatedAt FROM research_projects p WHERE p.id=? AND ("+membershipScope+")")
    .bind(id,...scopeArgs(actor)).first<Row>();
  if(!row)throw missing();
  return {project:readProject(row),updatedAt:row.updatedAt};
}

async function allowedPair(db:Store,a:string,b:string,write=false){
  return !!await db.prepare("SELECT 1 FROM research_memberships a JOIN research_memberships b"+
    " ON b.user_id=? AND b.state='active' AND b.role IN ('member','moderator')"+
    " WHERE a.user_id=? AND a.state='active' AND a.role IN ('member','moderator')"+
    " AND (?=0 OR a.mute_until IS NULL OR a.mute_until<=?)"+
    " AND NOT EXISTS(SELECT 1 FROM research_blocks WHERE (blocker_id=a.user_id AND blocked_id=b.user_id) OR (blocker_id=b.user_id AND blocked_id=a.user_id))")
    .bind(b,a,write?1:0,new Date().toISOString()).first();
}

function failure(error:unknown){
  const message=error instanceof Error?error.message:'';
  if(message==='revision_conflict')return fail(stale());
  if(message==='not_found')return fail(missing());
  if(message==='invitation_denied')return fail(new AccessError('双方须有有效的研究社区资格，才能邀请或接受。',403));
  if(message==='already_invited'||message==='duplicate_link')return fail(new AccessError('这项记录已存在，请刷新。',409));
  if(/^(invalid_|project_inactive|member_limit|milestone_limit|link_limit)/.test(message))return fail(bad());
  return fail(error,'研究项目暂不可用，请稍后重试。');
}

export async function GET(request:Request){
  try{
    const {id:actor}=principal(request),db=storage(),params=new URL(request.url).searchParams;
    const requested=params.get('id');
    if(requested){
      const {project,updatedAt}=await loadProject(db,actor,safeId(requested));
      if(!role(project,actor))return json({project:summary(project,actor,updatedAt),notes:[]});
      const [projectDetail,own]=await Promise.all([detail(project,actor,db),notes(db,actor)]);
      return json({project:projectDetail,notes:own});
    }
    const offset=Number(params.get('offset')??0);
    const search=params.get('q')?.trim()??'';
    if(!Number.isSafeInteger(offset)||offset<0||offset>10000||search.length>120)throw bad();
    const rows=(await db.prepare("SELECT p.payload,p.updated_at AS updatedAt FROM research_projects p WHERE ("+membershipScope+
      ") AND (?='' OR instr(lower(json_extract(p.payload,'$.title')),lower(?))>0)"+
      " ORDER BY p.updated_at DESC,p.id LIMIT 51 OFFSET ?").bind(...scopeArgs(actor),search,search,offset).all<Row>()).results;
    const member=await db.prepare("SELECT id FROM research_memberships WHERE user_id=? AND state='active' AND role IN ('member','moderator')").bind(actor).first<{id:string}>();
    return json({projects:rows.slice(0,50).map(r=>summary(readProject(r),actor,r.updatedAt)),
      next:rows.length>50?offset+50:null,collaborationCode:member?.id??null});
  }catch(error){return failure(error);}
}

export async function POST(request:Request){
  try{
    const {id:actor}=principal(request);sameOrigin(request);
    const db=storage(),body=JSON.parse(await readLimitedText(request,16000)),now=new Date().toISOString();
    if(!body||typeof body!=='object'||Array.isArray(body))throw bad();
    if(body.action==='create'){
      const p=createProject({projectId:crypto.randomUUID(),actor,title:body.title,question:body.question??'',description:body.description??''});
      const created=await db.prepare('INSERT INTO research_projects(id,owner_id,payload,status,revision,updated_at) SELECT ?,?,?,?,?,?'+
        ' WHERE (SELECT count(*) FROM research_projects WHERE owner_id=?)<50')
        .bind(p.id,actor,JSON.stringify(p),p.status,p.revision,now,actor).run();
      if(!created.meta.changes)throw new AccessError('每位用户最多保存 50 个研究项目。',409);
      return json({id:p.id},201);
    }
    const id=safeId(body.id),{project:p}=await loadProject(db,actor,id);
    const expected=body.revision;
    if(!Number.isSafeInteger(expected)||p.revision!==expected)throw stale();
    const isOwner=p.ownerId===actor;
    if(!isOwner&&!role(p,actor)&&!['respond','leave'].includes(body.action))throw missing();
    let next:Project;
    switch(body.action){
      case 'update':
        next=updateProject(p,actor,expected,{title:body.title,question:body.question,description:body.description});break;
      case 'archive':
      case 'restore':
        next=transition(p,actor,expected,body.action==='archive'?'archived':'active');break;
      case 'delete': {
        if(body.confirm!==true)throw bad();
        transition(p,actor,expected,'deleted');
        const result=await db.prepare('DELETE FROM research_projects WHERE id=? AND owner_id=? AND revision=?').bind(id,actor,expected).run();
        if(!result.meta.changes)throw stale();
        return json({ok:true});
      }
      case 'invite': {
        if(!isOwner)throw missing();
        const code=safeId(body.code);
        const target=await db.prepare("SELECT user_id AS uid FROM research_memberships WHERE id=? AND state='active'").bind(code).first<{uid:string}>();
        if(!target||!await allowedPair(db,actor,target.uid,true))throw new Error('invitation_denied');
        next=invite(p,actor,expected,target.uid,true);
        next.members=next.members.filter(m=>['pending','active'].includes(m.state));
        next.members=next.members.map(m=>m.userId===target.uid?{...m,key:crypto.randomUUID()}:m);
        break;
      }
      case 'respond':
        next=respond(p,actor,expected,body.accept,body.accept!==true||await allowedPair(db,actor,p.ownerId));break;
      case 'leave':
        next=revoke(p,actor,expected,actor);break;
      case 'revoke':{
        if(!isOwner)throw missing();
        const member=p.members.find(m=>m.key===body.memberId);
        if(!member)throw missing();
        next=revoke(p,actor,expected,member.userId);break;
      }
      case 'milestone-add':
        next=addMilestone(p,actor,expected,{id:crypto.randomUUID(),title:body.title});break;
      case 'milestone-toggle':
        next=setMilestone(p,actor,expected,body.milestoneId,body.done);break;
      case 'link':{
        if(!noteId(body.noteId))throw bad();
        const note=await db.prepare('SELECT id,user_id AS ownerId,folder FROM entries WHERE user_id=? AND id=?').bind(actor,body.noteId).first();
        next=linkPrivateNote(p,actor,expected,note);break;
      }
      case 'unlink':
        next=unlinkPrivateNote(p,actor,expected,body.noteId);break;
      default:throw bad();
    }
    const result=await db.prepare('UPDATE research_projects AS p SET payload=?,status=?,revision=?,updated_at=? WHERE p.id=? AND p.revision=? AND ('+membershipScope+')')
      .bind(JSON.stringify(next),next.status,next.revision,now,id,expected,...scopeArgs(actor)).run();
    if(!result.meta.changes)throw stale();
    return json({ok:true,id});
  }catch(error){return failure(error instanceof SyntaxError?bad():error);}
}
