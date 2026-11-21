CREATE TABLE `admin_access_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_access_log_created_idx` ON `admin_access_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `oral_audio` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`object_key` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oral_audio_owner_created_idx` ON `oral_audio` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `quality_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`target_key` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`admin_note` text DEFAULT '' NOT NULL,
	`handled_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `quality_feedback_owner_idx` ON `quality_feedback` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `quality_feedback_status_idx` ON `quality_feedback` (`status`,`updated_at`);
