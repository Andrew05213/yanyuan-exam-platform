// Stage 03 isolated state transition contract. No production IO. Actor and community authorization must come from trusted server context, not clients.
function fail(code){throw new Error(code)}

function id(v){if(typeof v!=="string"||!v.trim()||v.length>300)fail("invalid_id");return v}

function title(v){if(typeof v!=="string"||!v.trim()||v.trim().length>120)fail("invalid_title");return v.trim()}

function body(v,max=4000){if(typeof v!=="string"||v.length>max)fail("invalid_text");return v}

function revision(p,expected){if(!Number.isSafeInteger(expected)||p.revision!==expected)fail("revision_conflict")}

function active(p){if(p.status!=="active")fail("project_inactive")}

function owner(p,actor){if(p.ownerId!==id(actor))fail("not_found")}

export function role(p,actor){if(!p||typeof actor!=="string"||!actor.trim()||p.status==="deleted")return null;if(p.ownerId===actor)return "owner";return p.status==="active"&&p.members.some(m=>m.userId===actor&&m.state==="active")?"collaborator":null}

export function createProject({projectId,actor,title:label,question="",description=""}){return {id:id(projectId),ownerId:id(actor),title:title(label),question:body(question,1000),description:body(description),status:"active",revision:1,members:[],milestones:[],links:[]}}

export function viewProject(p,actor){const r=role(p,actor);if(!r)fail("not_found");const {id:pid,title:label,question,description,status,revision:rev}=p;return {id:pid,title:label,question,description,status,revision:rev,role:r,milestones:p.milestones.map(m=>({...m})),links:p.links.filter(l=>l.ownerId===actor).map(l=>({...l})),...(r==="owner"?{members:p.members.map(m=>({...m}))}:{})}}

export function updateProject(p,actor,expected,patch){owner(p,actor);revision(p,expected);active(p);if(!patch||typeof patch!=="object"||Object.keys(patch).some(k=>!["title","question","description"].includes(k)))fail("invalid_patch");return {...p,...("title"in patch?{title:title(patch.title)}:{}),...("question"in patch?{question:body(patch.question,1000)}:{}),...("description"in patch?{description:body(patch.description)}:{}),revision:p.revision+1}}

export function transition(p,actor,expected,to){owner(p,actor);revision(p,expected);if(!({active:["archived","deleted"],archived:["active","deleted"],deleted:[]})[p.status]?.includes(to))fail("invalid_transition");return {...p,status:to,revision:p.revision+1}}

export function invite(p,actor,expected,target,authorizedCommunityPair){owner(p,actor);revision(p,expected);active(p);id(target);if(authorizedCommunityPair!==true||target===actor)fail("invitation_denied");if(p.members.some(m=>m.userId===target&&["pending","active"].includes(m.state)))fail("already_invited");if(p.members.filter(m=>["pending","active"].includes(m.state)).length>=10)fail("member_limit");return {...p,members:[...p.members.filter(m=>m.userId!==target),{userId:target,state:"pending"}],revision:p.revision+1}}

export function respond(p,actor,expected,accept,authorizedCommunityPair){revision(p,expected);active(p);id(actor);if(typeof accept!=="boolean")fail("invalid_response");if(!p.members.some(m=>m.userId===actor&&m.state==="pending"))fail("not_found");if(accept&&authorizedCommunityPair!==true)fail("invitation_denied");return {...p,members:p.members.map(m=>m.userId===actor?{...m,state:accept?"active":"declined"}:m),revision:p.revision+1}}

export function revoke(p,actor,expected,target){revision(p,expected);active(p);if(actor!==p.ownerId&&actor!==target)fail("not_found");if(!p.members.some(m=>m.userId===target&&["active","pending"].includes(m.state)))fail("not_found");return {...p,members:p.members.map(m=>m.userId===target?{...m,state:"revoked"}:m),links:p.links.filter(l=>l.ownerId!==target),revision:p.revision+1}}

export function addMilestone(p,actor,expected,m){owner(p,actor);revision(p,expected);active(p);id(m.id);if(p.milestones.length>=100||p.milestones.some(x=>x.id===m.id))fail("milestone_limit_or_duplicate");return {...p,milestones:[...p.milestones,{id:m.id,title:title(m.title),done:false}],revision:p.revision+1}}

export function setMilestone(p,actor,expected,mid,done){owner(p,actor);revision(p,expected);active(p);if(typeof done!=="boolean"||!p.milestones.some(x=>x.id===mid))fail("invalid_milestone");return {...p,milestones:p.milestones.map(m=>m.id===mid?{...m,done}:m),revision:p.revision+1}}

export function linkPrivateNote(p,actor,expected,note){if(!role(p,actor))fail("not_found");revision(p,expected);active(p);if(!note||note.ownerId!==actor||note.folder!=="active")fail("not_found");id(note.id);if(p.links.some(l=>l.ownerId===actor&&l.noteId===note.id))fail("duplicate_link");if(p.links.filter(l=>l.ownerId===actor).length>=100)fail("link_limit");return {...p,links:[...p.links,{ownerId:actor,noteId:note.id}],revision:p.revision+1}}

export function unlinkPrivateNote(p,actor,expected,noteId){if(!role(p,actor))fail("not_found");revision(p,expected);active(p);if(!p.links.some(l=>l.ownerId===actor&&l.noteId===noteId))fail("not_found");return {...p,links:p.links.filter(l=>!(l.ownerId===actor&&l.noteId===noteId)),revision:p.revision+1}}
