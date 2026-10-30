import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
// Owner-scoped records. NULL is reserved for pre-publication legacy records.
export const archiveRecords = sqliteTable("archive_records", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id"),
  kind: text("kind").notNull(),
  schoolId: text("school_id").notNull(),
  title: text("title").notNull(),
  payload: text("payload").notNull(),
  revision: integer("revision").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, table => [index("archive_records_updated_idx").on(table.updatedAt)]);

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id"),
  objectKey: text("object_key").notNull(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at").notNull(),
});

export const communityMaterials = sqliteTable("community_materials", {
  id:text("id").primaryKey(),ownerId:text("owner_id").notNull(),title:text("title").notNull(),subject:text("subject").notNull(),section:text("section").notNull(),tier:text("tier").notNull(),payload:text("payload").notNull(),authorAlias:text("author_alias").notNull(),active:integer("active").notNull().default(1),revision:integer("revision").notNull().default(1),createdAt:text("created_at").notNull(),updatedAt:text("updated_at").notNull(),
},t=>[index("community_materials_owner_idx").on(t.ownerId),index("community_materials_active_idx").on(t.active,t.updatedAt)]);
export const materialFiles=sqliteTable("material_files",{
 id:text("id").primaryKey(),ownerId:text("owner_id").notNull(),materialId:text("material_id"),objectKey:text("object_key").notNull(),filename:text("filename").notNull(),mime:text("mime").notNull(),size:integer("size").notNull(),createdAt:text("created_at").notNull(),
});
