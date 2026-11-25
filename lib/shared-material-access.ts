import {sql} from "drizzle-orm";
import {communityMaterials} from "../db/schema";
export function sharedMaterialVisible(uid:string){
 return sql`NOT EXISTS(SELECT 1 FROM research_hidden h WHERE h.target_kind='material' AND h.target_id=${communityMaterials.id}) AND NOT EXISTS(SELECT 1 FROM research_blocks b WHERE (b.blocker_id=${uid} AND b.blocked_id=${communityMaterials.ownerId}) OR (b.blocked_id=${uid} AND b.blocker_id=${communityMaterials.ownerId}))`;
}
