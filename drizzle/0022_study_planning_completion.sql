CREATE TABLE study_plan_preferences(user_id text PRIMARY KEY NOT NULL,version text NOT NULL,payload text NOT NULL,updated_at text NOT NULL);
--> statement-breakpoint
CREATE TABLE study_review_events(user_id text NOT NULL,day text NOT NULL,task_id text NOT NULL,kind text NOT NULL,source_id text NOT NULL,outcome text NOT NULL,level integer NOT NULL,due text NOT NULL,occurred_at text NOT NULL,PRIMARY KEY(user_id,day,task_id));
--> statement-breakpoint
CREATE INDEX study_review_events_latest_idx ON study_review_events(user_id,task_id,day);
--> statement-breakpoint
INSERT INTO study_review_events SELECT p.user_id,p.day,json_extract(t.value,'$.id'),json_extract(t.value,'$.kind'),json_extract(t.value,'$.sourceId'),json_extract(t.value,'$.review.outcome'),json_extract(t.value,'$.review.level'),json_extract(t.value,'$.review.due'),json_extract(t.value,'$.review.at') FROM study_day_plans p,json_each(p.payload,'$.tasks') t WHERE json_extract(t.value,'$.review.due') IS NOT NULL;
--> statement-breakpoint
CREATE TRIGGER study_reviews_insert AFTER INSERT ON study_day_plans BEGIN
 INSERT INTO study_review_events SELECT NEW.user_id,NEW.day,json_extract(t.value,'$.id'),json_extract(t.value,'$.kind'),json_extract(t.value,'$.sourceId'),json_extract(t.value,'$.review.outcome'),json_extract(t.value,'$.review.level'),json_extract(t.value,'$.review.due'),json_extract(t.value,'$.review.at') FROM json_each(NEW.payload,'$.tasks') t WHERE json_extract(t.value,'$.review.due') IS NOT NULL;
END;
--> statement-breakpoint
CREATE TRIGGER study_reviews_update AFTER UPDATE OF payload ON study_day_plans BEGIN
 DELETE FROM study_review_events WHERE user_id=OLD.user_id AND day=OLD.day;
 INSERT INTO study_review_events SELECT NEW.user_id,NEW.day,json_extract(t.value,'$.id'),json_extract(t.value,'$.kind'),json_extract(t.value,'$.sourceId'),json_extract(t.value,'$.review.outcome'),json_extract(t.value,'$.review.level'),json_extract(t.value,'$.review.due'),json_extract(t.value,'$.review.at') FROM json_each(NEW.payload,'$.tasks') t WHERE json_extract(t.value,'$.review.due') IS NOT NULL;
END;
--> statement-breakpoint
CREATE TRIGGER study_reviews_delete AFTER DELETE ON study_day_plans BEGIN
 DELETE FROM study_review_events WHERE user_id=OLD.user_id AND day=OLD.day;
END;
