CREATE TABLE private_exam_imports(id text PRIMARY KEY NOT NULL,owner_id text NOT NULL,sha256 text NOT NULL,filename text NOT NULL,mime text NOT NULL,size integer NOT NULL,object_key text NOT NULL,source text NOT NULL,source_url text NOT NULL,rights text NOT NULL,payload text NOT NULL,revision integer DEFAULT 1 NOT NULL,created_at text NOT NULL,updated_at text NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX private_exam_imports_owner_hash ON private_exam_imports(owner_id,sha256);
