ALTER TABLE research_topics ADD COLUMN language_id text;
--> statement-breakpoint
ALTER TABLE research_topics ADD COLUMN discipline text;
--> statement-breakpoint
ALTER TABLE research_topics ADD COLUMN catalog_id text;
--> statement-breakpoint
CREATE INDEX research_topics_classification_idx ON research_topics(language_id,discipline,created_at);
