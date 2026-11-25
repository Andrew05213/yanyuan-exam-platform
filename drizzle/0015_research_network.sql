CREATE TABLE research_links (id text PRIMARY KEY NOT NULL, source_id text NOT NULL REFERENCES research_publications(id) ON DELETE CASCADE, target_id text NOT NULL REFERENCES research_publications(id) ON DELETE CASCADE, source_revision integer NOT NULL, target_revision integer NOT NULL, kind text NOT NULL, created_at text NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX research_links_unique_idx ON research_links(source_id,target_id,source_revision,target_revision,kind);
--> statement-breakpoint
CREATE INDEX research_links_target_idx ON research_links(target_id,target_revision);
--> statement-breakpoint
CREATE TABLE research_references (id text PRIMARY KEY NOT NULL, topic_id text NOT NULL REFERENCES research_topics(id) ON DELETE CASCADE, owner_id text NOT NULL, title text NOT NULL, authors text NOT NULL, year text NOT NULL, identifier text NOT NULL, created_at text NOT NULL);
--> statement-breakpoint
CREATE INDEX research_references_topic_idx ON research_references(topic_id,created_at);
--> statement-breakpoint
CREATE INDEX research_references_owner_idx ON research_references(owner_id);
