import {env} from "cloudflare:workers";
import {AccessError} from "./user-access";

export function canAccessResearchCommunity(userId:string) {
  const configured=(env as unknown as Record<string,unknown>).RESEARCH_COMMUNITY_USER_IDS;
  return typeof configured==="string"&&configured.split(",").some(id=>id.trim()===userId);
}

export function requireResearchCommunity(userId:string) {
  if(!canAccessResearchCommunity(userId))throw new AccessError("研究社区仅向获邀账号开放。",403);
}
