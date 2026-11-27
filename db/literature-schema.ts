import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";
export const entries = sqliteTable("entries", { userId: text("user_id").notNull(), id: text("id").notNull(), tags:text("tags"), language:text("language"), sourceLanguage:text("source_language"), discipline:text("discipline"), locator:text("locator"), reviewOn:text("review_on"), workId: text("work_id"), title: text("title").notNull(), content: text("content").notNull().default(""), status: text("status").notNull().default("未开始"), updatedAt: text("updated_at").notNull(), revision: integer("revision").notNull().default(1), folder: text("folder",{enum:["active","archived","trash"]}).notNull().default("active") }, t => [primaryKey({columns:[t.userId,t.id]})]);

export const materials = sqliteTable("materials", {
  userId: text("user_id").notNull(),
  id: text("id").notNull(),
  data: text("data").notNull(),
  deleted: integer("deleted").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
}, t => [primaryKey({ columns: [t.userId, t.id] })]);

// Sharing is explicit: community tables store voluntary copies of private entries.
export const researchTopics = sqliteTable("research_topics", {
  id:text("id").primaryKey(), ownerId:text("owner_id").notNull(),
  title:text("title").notNull(), description:text("description").notNull(),
  createdAt:text("created_at").notNull(),
}, t=>[index("research_topics_created_idx").on(t.createdAt,t.id),index("research_topics_owner_idx").on(t.ownerId)]);
export const researchPublications = sqliteTable("research_publications", {
  id:text("id").primaryKey(), topicId:text("topic_id").notNull(),
  ownerId:text("owner_id").notNull(), entryId:text("entry_id").notNull(),
  title:text("title").notNull(), content:text("content").notNull(),
  language:text("language"), sourceLanguage:text("source_language"), discipline:text("discipline"),
  sourceUpdatedAt:text("source_updated_at").notNull(), revision:integer("revision").notNull().default(1),
  createdAt:text("created_at").notNull(), updatedAt:text("updated_at").notNull(),
},t=>[uniqueIndex("research_publications_source_idx").on(t.ownerId,t.entryId,t.topicId),index("research_publications_topic_idx").on(t.topicId,t.updatedAt,t.id)]);

export const researchAnnotations=sqliteTable("research_annotations",{
 id:text("id").primaryKey(),publicationId:text("publication_id").notNull().references(()=>researchPublications.id,{onDelete:"cascade"}),ownerId:text("owner_id").notNull(),
 revision:integer("revision").notNull(),paragraphIndex:integer("paragraph_index").notNull(),quote:text("quote").notNull(),body:text("body").notNull(),createdAt:text("created_at").notNull(),
},t=>[index("research_annotations_publication_idx").on(t.publicationId,t.revision,t.createdAt),index("research_annotations_owner_idx").on(t.ownerId,t.createdAt)]);
export const researchReplies=sqliteTable("research_replies",{
 id:text("id").primaryKey(),annotationId:text("annotation_id").notNull().references(()=>researchAnnotations.id,{onDelete:"cascade"}),ownerId:text("owner_id").notNull(),body:text("body").notNull(),createdAt:text("created_at").notNull(),
},t=>[index("research_replies_annotation_idx").on(t.annotationId,t.createdAt),index("research_replies_owner_idx").on(t.ownerId,t.createdAt)]);
export const researchBlocks=sqliteTable("research_blocks",{
 id:text("id").primaryKey(),blockerId:text("blocker_id").notNull(),blockedId:text("blocked_id").notNull(),label:text("label").notNull(),createdAt:text("created_at").notNull(),
},t=>[uniqueIndex("research_blocks_pair_idx").on(t.blockerId,t.blockedId),index("research_blocks_reverse_idx").on(t.blockedId,t.blockerId)]);
export const researchReports=sqliteTable("research_reports",{
 id:text("id").primaryKey(),reporterId:text("reporter_id").notNull(),targetKind:text("target_kind").notNull(),targetId:text("target_id").notNull(),targetRevision:integer("target_revision").notNull(),category:text("category").notNull(),snapshot:text("snapshot").notNull(),status:text("status").notNull().default("pending"),createdAt:text("created_at").notNull(),resolvedBy:text("resolved_by"),resolvedAt:text("resolved_at"),
},t=>[uniqueIndex("research_reports_unique_idx").on(t.reporterId,t.targetKind,t.targetId,t.targetRevision),index("research_reports_status_idx").on(t.status,t.createdAt)]);
export const researchHidden=sqliteTable("research_hidden",{
 targetKind:text("target_kind").notNull(),targetId:text("target_id").notNull(),reportId:text("report_id").notNull(),createdAt:text("created_at").notNull(),
},t=>[primaryKey({columns:[t.targetKind,t.targetId]})]);

export const researchLinks=sqliteTable("research_links",{
 id:text("id").primaryKey(),sourceId:text("source_id").notNull().references(()=>researchPublications.id,{onDelete:"cascade"}),targetId:text("target_id").notNull().references(()=>researchPublications.id,{onDelete:"cascade"}),sourceRevision:integer("source_revision").notNull(),targetRevision:integer("target_revision").notNull(),kind:text("kind").notNull(),createdAt:text("created_at").notNull(),
},t=>[uniqueIndex("research_links_unique_idx").on(t.sourceId,t.targetId,t.sourceRevision,t.targetRevision,t.kind),index("research_links_target_idx").on(t.targetId,t.targetRevision)]);
export const researchReferences=sqliteTable("research_references",{
 id:text("id").primaryKey(),topicId:text("topic_id").notNull().references(()=>researchTopics.id,{onDelete:"cascade"}),ownerId:text("owner_id").notNull(),title:text("title").notNull(),authors:text("authors").notNull(),year:text("year").notNull(),identifier:text("identifier").notNull(),createdAt:text("created_at").notNull(),
},t=>[index("research_references_topic_idx").on(t.topicId,t.createdAt),index("research_references_owner_idx").on(t.ownerId)]);

export const researchMemberships=sqliteTable("research_memberships",{
 userId:text("user_id").primaryKey().notNull(),
 id:text("id").notNull(),
 role:text("role").notNull().default("member"),
 state:text("state").notNull().default("active"),
 muteUntil:text("mute_until"),
 reason:text("reason").notNull().default(""),
 revision:integer("revision").notNull().default(1),
 changeId:text("change_id").notNull(),
 createdAt:text("created_at").notNull(),
 updatedAt:text("updated_at").notNull()
},t=>[uniqueIndex("research_memberships_id_idx").on(t.id)]);

export const researchInvites=sqliteTable("research_invites",{
 id:text("id").primaryKey().notNull(),
 codeHash:text("code_hash").notNull(),
 createdBy:text("created_by").notNull(),
 createdAt:text("created_at").notNull(),
 expiresAt:text("expires_at").notNull(),
 revokedAt:text("revoked_at"),
 usedBy:text("used_by"),
 usedAt:text("used_at"),
 claimId:text("claim_id")
},t=>[uniqueIndex("research_invites_hash_idx").on(t.codeHash)]);

export const researchGovernanceAudit=sqliteTable("research_governance_audit",{
 id:text("id").primaryKey().notNull(),
 actorId:text("actor_id").notNull(),
 action:text("action").notNull(),
 targetId:text("target_id").notNull(),
 reason:text("reason").notNull(),
 createdAt:text("created_at").notNull()
},t=>[index("research_governance_audit_created_idx").on(t.createdAt)]);

export const researchAppeals=sqliteTable("research_appeals",{
 id:text("id").primaryKey().notNull(),
 userId:text("user_id").notNull(),
 memberRevision:integer("member_revision").notNull(),
 body:text("body").notNull(),
 status:text("status").notNull().default("pending"),
 resolution:text("resolution"),
 resolvedBy:text("resolved_by"),
 createdAt:text("created_at").notNull(),
 resolvedAt:text("resolved_at")
},t=>[uniqueIndex("research_appeals_revision_idx").on(t.userId,t.memberRevision),index("research_appeals_status_idx").on(t.status,t.createdAt)]);

// Previous private title/body snapshots; bounded by the migration trigger.
export const noteVersions=sqliteTable("note_versions",{
 userId:text("user_id").notNull(),noteId:text("note_id").notNull(),revision:integer("revision").notNull(),title:text("title").notNull(),content:text("content").notNull(),updatedAt:text("updated_at").notNull(),
},t=>[primaryKey({columns:[t.userId,t.noteId,t.revision]})]);
