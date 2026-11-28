import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import {sql} from 'drizzle-orm';

export const admissionsPlans = sqliteTable('admissions_plans', {
  userId: text('user_id').primaryKey().notNull(),
  payload: text('payload').notNull(),
  version: text('version').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const researchProjects = sqliteTable('research_projects', {
  id:text('id').primaryKey().notNull(),
  ownerId:text('owner_id').notNull(),
  payload:text('payload').notNull(),
  status:text('status').notNull(),
  revision:integer('revision').notNull(),
  updatedAt:text('updated_at').notNull(),
}, t=>[index('research_projects_owner_idx').on(t.ownerId,t.updatedAt)]);
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

export const siteUsers=sqliteTable('site_users',{
 id:text('id').primaryKey(),email:text('email'),displayName:text('display_name'),lastSeenAt:text('last_seen_at').notNull(),
});

export const aiProviders=sqliteTable('ai_providers',{
 id:text('id').primaryKey(),name:text('name').notNull(),protocol:text('protocol').notNull(),baseUrl:text('base_url').notNull(),model:text('model').notNull(),currency:text('currency').notNull(),
 enabled:integer('enabled').notNull().default(1),isDefault:integer('is_default').notNull().default(0),revision:integer('revision').notNull().default(1),
 encryptedKey:text('encrypted_key'),keyUpdatedAt:text('key_updated_at'),inputPriceMicros:integer('input_price_micros'),cachedInputPriceMicros:integer('cached_input_price_micros'),outputPriceMicros:integer('output_price_micros'),
 createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('ai_providers_one_default_idx').on(t.isDefault).where(sql`${t.isDefault}=1`)]);

export const aiTaskSettings=sqliteTable('ai_task_settings',{
 task:text('task').primaryKey(),providerId:text('provider_id'),model:text('model'),revision:integer('revision').notNull().default(1),updatedAt:text('updated_at').notNull(),updatedBy:text('updated_by').notNull(),
});

export const aiUsageEvents=sqliteTable('ai_usage_events',{
 id:text('id').primaryKey(),requestId:text('request_id').notNull(),userId:text('user_id').notNull(),providerId:text('provider_id').notNull(),providerName:text('provider_name').notNull(),model:text('model').notNull(),task:text('task').notNull(),status:text('status').notNull(),currency:text('currency').notNull(),
 inputTokens:integer('input_tokens'),cachedInputTokens:integer('cached_input_tokens'),outputTokens:integer('output_tokens'),estimatedCostMicros:text('estimated_cost_micros'),pricingSnapshot:text('pricing_snapshot').notNull(),elapsedMs:integer('elapsed_ms'),createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('ai_usage_request_idx').on(t.providerId,t.requestId),index('ai_usage_user_date_idx').on(t.userId,t.createdAt),index('ai_usage_provider_date_idx').on(t.providerId,t.createdAt),index('ai_usage_date_idx').on(t.createdAt)]);

export const adminAuditEvents=sqliteTable('admin_audit_events',{
 id:text('id').primaryKey(),actorId:text('actor_id').notNull(),action:text('action').notNull(),providerId:text('provider_id').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('admin_audit_date_idx').on(t.createdAt)]);

export const adminAccessLog=sqliteTable('admin_access_log',{
 id:text('id').primaryKey(),actorId:text('actor_id').notNull(),action:text('action').notNull(),targetId:text('target_id'),createdAt:text('created_at').notNull(),
},t=>[index('admin_access_log_created_idx').on(t.createdAt)]);

export const oralAudio=sqliteTable('oral_audio',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),objectKey:text('object_key').notNull(),mime:text('mime').notNull(),size:integer('size').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('oral_audio_owner_created_idx').on(t.ownerId,t.createdAt)]);

export const qualityFeedback=sqliteTable('quality_feedback',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),targetKey:text('target_key').notNull(),kind:text('kind').notNull(),title:text('title').notNull(),payload:text('payload').notNull(),status:text('status').notNull().default('open'),adminNote:text('admin_note').notNull().default(''),handledBy:text('handled_by'),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[index('quality_feedback_owner_idx').on(t.ownerId,t.updatedAt),index('quality_feedback_status_idx').on(t.status,t.updatedAt)]);

export const aiGradingJobs=sqliteTable('ai_grading_jobs',{
 id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),recordId:text('record_id').notNull(),questionId:text('question_id').notNull().default(''),sourceHash:text('source_hash').notNull(),kind:text('kind').notNull(),status:text('status').notNull(),providerId:text('provider_id').notNull(),model:text('model').notNull(),result:text('result'),error:text('error'),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[index('ai_grading_owner_date_idx').on(t.ownerId,t.createdAt),uniqueIndex('ai_grading_one_pending_idx').on(t.ownerId).where(sql`${t.status}='pending'`)]);
// Owner-scoped personal question bank. AI-generated items are stored only
// after the user confirms them, with an explicit review state. Payload holds
// one catalog-compatible unit (subject/section/tier/questions[]); the columns
// duplicate the fields needed for listing and filtering without parsing JSON.
export const questionBank = sqliteTable("question_bank", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  subject: text("subject").notNull(),
  section: text("section").notNull(),
  difficulty: text("difficulty").notNull().default("进阶"),
  source: text("source").notNull().default("ai"),
  reviewStatus: text("review_status").notNull().default("pending"),
  payload: text("payload").notNull(),
  revision: integer("revision").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, t => [
  index("question_bank_owner_updated_idx").on(t.ownerId, t.updatedAt),
  index("question_bank_owner_subject_idx").on(t.ownerId, t.subject),
]);

// One row per AI topic-generation attempt. Used for per-account rate limits,
// idempotent replays and failure records. Results never contain the API key.
export const aiQuestionJobs = sqliteTable("ai_question_jobs", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  requestHash: text("request_hash").notNull(),
  status: text("status").notNull(),
  model: text("model"),
  elapsedMs: integer("elapsed_ms"),
  result: text("result"),
  error: text("error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, t => [
  index("ai_question_jobs_request_idx").on(t.ownerId, t.requestHash),
  index("ai_question_jobs_owner_date_idx").on(t.ownerId, t.createdAt),
]);

export * from "./literature-schema";

export const studyDayPlans=sqliteTable("study_day_plans",{
 userId:text("user_id").notNull(),day:text("day").notNull(),version:text("version").notNull(),payload:text("payload").notNull(),updatedAt:text("updated_at").notNull(),
},t=>[primaryKey({columns:[t.userId,t.day]})]);

export const studyPlanPreferences=sqliteTable("study_plan_preferences",{
 userId:text("user_id").primaryKey().notNull(),version:text("version").notNull(),payload:text("payload").notNull(),updatedAt:text("updated_at").notNull(),
});
export const studyReviewEvents=sqliteTable("study_review_events",{
 userId:text("user_id").notNull(),day:text("day").notNull(),taskId:text("task_id").notNull(),kind:text("kind").notNull(),sourceId:text("source_id").notNull(),outcome:text("outcome").notNull(),level:integer("level").notNull(),due:text("due").notNull(),occurredAt:text("occurred_at").notNull(),
},t=>[primaryKey({columns:[t.userId,t.day,t.taskId]}),index("study_review_events_latest_idx").on(t.userId,t.taskId,t.day)]);

export const studyReviewReschedules=sqliteTable("study_review_reschedules",{
 userId:text("user_id").notNull(),taskId:text("task_id").notNull(),day:text("day").notNull(),due:text("due").notNull(),version:text("version").notNull(),updatedAt:text("updated_at").notNull(),
},t=>[primaryKey({columns:[t.userId,t.taskId]})]);

export const privateKnowledgeGraphs=sqliteTable("private_knowledge_graphs",{
 userId:text("user_id").primaryKey().notNull(),version:text("version").notNull(),payload:text("payload").notNull(),updatedAt:text("updated_at").notNull(),
});

export const privateReferenceLibraries=sqliteTable("private_reference_libraries",{
 userId:text("user_id").primaryKey().notNull(),version:text("version").notNull(),payload:text("payload").notNull(),updatedAt:text("updated_at").notNull(),
});
