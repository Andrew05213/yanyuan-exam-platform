CREATE TABLE research_topics (
 id text PRIMARY KEY NOT NULL,
 owner_id text NOT NULL,
 title text NOT NULL,
 description text NOT NULL,
 created_at text NOT NULL
);
--> statement-breakpoint
CREATE INDEX research_topics_created_idx ON research_topics (created_at,id);
--> statement-breakpoint
CREATE INDEX research_topics_owner_idx ON research_topics (owner_id);
--> statement-breakpoint
CREATE TABLE research_publications (
 id text PRIMARY KEY NOT NULL,
 topic_id text NOT NULL,
 owner_id text NOT NULL,
 entry_id text NOT NULL,
 title text NOT NULL,
 content text NOT NULL,
 language text,
 source_language text,
 discipline text,
 source_updated_at text NOT NULL,
 revision integer DEFAULT 1 NOT NULL,
 created_at text NOT NULL,
 updated_at text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX research_publications_source_idx ON research_publications (owner_id,entry_id,topic_id);
--> statement-breakpoint
CREATE INDEX research_publications_topic_idx ON research_publications (topic_id,updated_at,id);
