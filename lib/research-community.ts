// SQL fragments only accept compile-time aliases and target types, never request fields.
export type TargetKind="topic"|"publication"|"annotation"|"reply";
export function visible(alias:string,kind:TargetKind){
 return "NOT EXISTS(SELECT 1 FROM research_hidden h WHERE h.target_kind='"+kind+"' AND h.target_id="+alias+".id) AND NOT EXISTS(SELECT 1 FROM research_blocks b WHERE (b.blocker_id=? AND b.blocked_id="+alias+".owner_id) OR (b.blocked_id=? AND b.blocker_id="+alias+".owner_id))";
}
export const viewer=(id:string)=>[id,id];
export function publicationVisible(alias:string){
 return visible(alias,"publication")+" AND EXISTS(SELECT 1 FROM research_topics t WHERE t.id="+alias+".topic_id AND "+visible("t","topic")+")";
}
export const publicationViewer=(id:string)=>[id,id,id,id];
export function paragraphs(content:string){return content.split(/\r?\n+/).map(p=>p.trim()).filter(Boolean);}
