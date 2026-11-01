CREATE TABLE `ai_task_settings` (
	`task` text PRIMARY KEY NOT NULL,
	`provider_id` text,
	`model` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
