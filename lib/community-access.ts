import {storage} from "../db/store";
import {isAdmin} from "./admin-access";
import {AccessError} from "./user-access";
type Member={id:string;role:string;state:string;muteUntil:string|null;reason:string;revision:number};
export async function communityAccess(request:Request,uid:string){
 if(isAdmin(request))return {role:"admin",state:"active",read:true,write:true,moderate:true,member:null as Member|null};
 const member=await storage().prepare("SELECT id,role,state,mute_until AS muteUntil,reason,revision FROM research_memberships WHERE user_id=?").bind(uid).first<Member>();
 const valid=!!member&&["member","moderator"].includes(member.role);
 const read=valid&&member.state==="active";
 const write=read&&(!member.muteUntil||member.muteUntil<=new Date().toISOString());
 return {role:valid?member.role:"student",state:valid?member.state:"not-invited",read,write,moderate:write&&member.role==="moderator",member};
}
export async function requireCommunity(request:Request,uid:string,mode:"read"|"write"|"moderate"="read"){
 const access=await communityAccess(request,uid);
 if(!access[mode])throw new AccessError(mode==="moderate"?"仅授权社区管理员可审核。":mode==="write"&&access.read?"社区发布权限暂时暂停；仍可学习、阅读及举报。":"研究社区需要有效邀请及成员资格。私人学习空间不受影响。",403);
 return access;
}
