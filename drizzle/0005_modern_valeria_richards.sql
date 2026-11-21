CREATE TABLE `ai_grading_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`record_id` text NOT NULL,
	`question_id` text DEFAULT '' NOT NULL,
	`source_hash` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`provider_id` text NOT NULL,
	`model` text NOT NULL,
	`result` text,
	`error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_grading_owner_date_idx` ON `ai_grading_jobs` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_grading_one_pending_idx` ON `ai_grading_jobs` (`owner_id`) WHERE "ai_grading_jobs"."status"='pending';
