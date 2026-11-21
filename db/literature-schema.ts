import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
export const entries = sqliteTable("entries", { userId: text("user_id").notNull(), id: text("id").notNull(), tags:text("tags"), locator:text("locator"), reviewOn:text("review_on"), workId: text("work_id"), title: text("title").notNull(), content: text("content").notNull().default(""), status: text("status").notNull().default("未开始"), updatedAt: text("updated_at").notNull() }, t => [primaryKey({columns:[t.userId,t.id]})]);

export const materials = sqliteTable("materials", {
  userId: text("user_id").notNull(),
  id: text("id").notNull(),
  data: text("data").notNull(),
  deleted: integer("deleted").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
}, t => [primaryKey({ columns: [t.userId, t.id] })]);
