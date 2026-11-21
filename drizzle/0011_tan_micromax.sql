CREATE TABLE `ai_question_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`status` text NOT NULL,
	`model` text,
	`elapsed_ms` integer,
	`result` text,
	`error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_question_jobs_request_idx` ON `ai_question_jobs` (`owner_id`,`request_hash`);--> statement-breakpoint
CREATE INDEX `ai_question_jobs_owner_date_idx` ON `ai_question_jobs` (`owner_id`,`created_at`);