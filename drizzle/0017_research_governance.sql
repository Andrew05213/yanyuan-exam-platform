CREATE TABLE `research_memberships` (`user_id` text PRIMARY KEY NOT NULL, `id` text NOT NULL, `role` text NOT NULL DEFAULT 'member', `state` text NOT NULL DEFAULT 'active', `mute_until` text, `reason` text NOT NULL DEFAULT '', `revision` integer NOT NULL DEFAULT 1, `change_id` text NOT NULL, `created_at` text NOT NULL, `updated_at` text NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `research_memberships_id_idx` ON `research_memberships` (`id`);
--> statement-breakpoint
CREATE TABLE `research_invites` (`id` text PRIMARY KEY NOT NULL, `code_hash` text NOT NULL, `created_by` text NOT NULL, `created_at` text NOT NULL, `expires_at` text NOT NULL, `revoked_at` text, `used_by` text, `used_at` text, `claim_id` text);
--> statement-breakpoint
CREATE UNIQUE INDEX `research_invites_hash_idx` ON `research_invites` (`code_hash`);
--> statement-breakpoint
CREATE TABLE `research_governance_audit` (`id` text PRIMARY KEY NOT NULL, `actor_id` text NOT NULL, `action` text NOT NULL, `target_id` text NOT NULL, `reason` text NOT NULL, `created_at` text NOT NULL);
--> statement-breakpoint
CREATE INDEX `research_governance_audit_created_idx` ON `research_governance_audit` (`created_at`);
--> statement-breakpoint
CREATE TABLE `research_appeals` (`id` text PRIMARY KEY NOT NULL, `user_id` text NOT NULL, `member_revision` integer NOT NULL, `body` text NOT NULL, `status` text NOT NULL DEFAULT 'pending', `resolution` text, `resolved_by` text, `created_at` text NOT NULL, `resolved_at` text);
--> statement-breakpoint
CREATE UNIQUE INDEX `research_appeals_revision_idx` ON `research_appeals` (`user_id`, `member_revision`);
--> statement-breakpoint
CREATE INDEX `research_appeals_status_idx` ON `research_appeals` (`status`, `created_at`);
