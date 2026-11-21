CREATE TABLE `admin_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`provider_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_audit_date_idx` ON `admin_audit_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `ai_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`protocol` text NOT NULL,
	`base_url` text NOT NULL,
	`model` text NOT NULL,
	`currency` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`is_default` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`encrypted_key` text,
	`key_updated_at` text,
	`input_price_micros` integer,
	`cached_input_price_micros` integer,
	`output_price_micros` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_providers_one_default_idx` ON `ai_providers` (`is_default`) WHERE "ai_providers"."is_default"=1;--> statement-breakpoint
CREATE TABLE `ai_usage_events` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`user_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`provider_name` text NOT NULL,
	`model` text NOT NULL,
	`task` text NOT NULL,
	`status` text NOT NULL,
	`currency` text NOT NULL,
	`input_tokens` integer,
	`cached_input_tokens` integer,
	`output_tokens` integer,
	`estimated_cost_micros` text,
	`pricing_snapshot` text NOT NULL,
	`elapsed_ms` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_usage_request_idx` ON `ai_usage_events` (`provider_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `ai_usage_user_date_idx` ON `ai_usage_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_usage_provider_date_idx` ON `ai_usage_events` (`provider_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_usage_date_idx` ON `ai_usage_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `site_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`display_name` text,
	`last_seen_at` text NOT NULL
);

