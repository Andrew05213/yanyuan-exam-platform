CREATE TABLE `archive_records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`school_id` text NOT NULL,
	`title` text NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `archive_records_updated_idx` ON `archive_records` (`updated_at`);