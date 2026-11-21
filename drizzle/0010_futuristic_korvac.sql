CREATE TABLE `question_bank` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`subject` text NOT NULL,
	`section` text NOT NULL,
	`difficulty` text DEFAULT '进阶' NOT NULL,
	`source` text DEFAULT 'ai' NOT NULL,
	`review_status` text DEFAULT 'pending' NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `question_bank_owner_updated_idx` ON `question_bank` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `question_bank_owner_subject_idx` ON `question_bank` (`owner_id`,`subject`);