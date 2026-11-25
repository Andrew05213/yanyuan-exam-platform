CREATE TABLE research_annotations (id text PRIMARY KEY NOT NULL, publication_id text NOT NULL REFERENCES research_publications(id) ON DELETE CASCADE, owner_id text NOT NULL, revision integer NOT NULL, paragraph_index integer NOT NULL, quote text NOT NULL, body text NOT NULL, created_at text NOT NULL);
--> statement-breakpoint
CREATE INDEX research_annotations_publication_idx ON research_annotations(publication_id,revision,created_at);
--> statement-breakpoint
CREATE INDEX research_annotations_owner_idx ON research_annotations(owner_id,created_at);
--> statement-breakpoint
CREATE TABLE research_replies (id text PRIMARY KEY NOT NULL, annotation_id text NOT NULL REFERENCES research_annotations(id) ON DELETE CASCADE, owner_id text NOT NULL, body text NOT NULL, created_at text NOT NULL);
--> statement-breakpoint
CREATE INDEX research_replies_annotation_idx ON research_replies(annotation_id,created_at);
--> statement-breakpoint
CREATE INDEX research_replies_owner_idx ON research_replies(owner_id,created_at);
--> statement-breakpoint
CREATE TABLE research_blocks (id text PRIMARY KEY NOT NULL, blocker_id text NOT NULL, blocked_id text NOT NULL, label text NOT NULL, created_at text NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX research_blocks_pair_idx ON research_blocks(blocker_id,blocked_id);
--> statement-breakpoint
CREATE INDEX research_blocks_reverse_idx ON research_blocks(blocked_id,blocker_id);
--> statement-breakpoint
CREATE TABLE research_reports (id text PRIMARY KEY NOT NULL, reporter_id text NOT NULL, target_kind text NOT NULL, target_id text NOT NULL, target_revision integer NOT NULL, category text NOT NULL, snapshot text NOT NULL, status text DEFAULT 'pending' NOT NULL, created_at text NOT NULL, resolved_by text, resolved_at text);
--> statement-breakpoint
CREATE UNIQUE INDEX research_reports_unique_idx ON research_reports(reporter_id,target_kind,target_id,target_revision);
--> statement-breakpoint
CREATE INDEX research_reports_status_idx ON research_reports(status,created_at);
--> statement-breakpoint
CREATE TABLE research_hidden (target_kind text NOT NULL, target_id text NOT NULL, report_id text NOT NULL, created_at text NOT NULL, PRIMARY KEY(target_kind,target_id));
