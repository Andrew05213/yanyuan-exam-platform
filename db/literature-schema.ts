import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";
export const entries = sqliteTable("entries", { userId: text("user_id").notNull(), id: text("id").notNull(), tags:text("tags"), language:text("language"), sourceLanguage:text("source_language"), discipline:text("discipline"), locator:text("locator"), reviewOn:text("review_on"), workId: text("work_id"), title: text("title").notNull(), content: text("content").notNull().default(""), status: text("status").notNull().default("未开始"), updatedAt: text("updated_at").notNull() }, t => [primaryKey({columns:[t.userId,t.id]})]);

export const materials = sqliteTable("materials", {
  userId: text("user_id").notNull(),
  id: text("id").notNull(),
  data: text("data").notNull(),
  deleted: integer("deleted").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
}, t => [primaryKey({ columns: [t.userId, t.id] })]);

 
// Sharing is explicit: no private entry is readable through these tables.
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
