ALTER TABLE `entries` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `entries` ADD `folder` text DEFAULT 'active' NOT NULL;