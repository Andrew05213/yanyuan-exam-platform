CREATE TABLE `community_materials` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`subject` text NOT NULL,
	`section` text NOT NULL,
	`tier` text NOT NULL,
	`payload` text NOT NULL,
	`author_alias` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `community_materials_owner_idx` ON `community_materials` (`owner_id`);--> statement-breakpoint
CREATE INDEX `community_materials_active_idx` ON `community_materials` (`active`,`updated_at`);--> statement-breakpoint
CREATE TABLE `material_files` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`material_id` text,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `archive_records` ADD `owner_id` text;--> statement-breakpoint
ALTER TABLE `attachments` ADD `owner_id` text;