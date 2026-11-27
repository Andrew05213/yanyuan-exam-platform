CREATE TABLE `note_versions` (
 `user_id` text NOT NULL,
 `note_id` text NOT NULL,
 `revision` integer NOT NULL,
 `title` text NOT NULL,
 `content` text NOT NULL,
 `updated_at` text NOT NULL,
 PRIMARY KEY(`user_id`,`note_id`,`revision`)
);
--> statement-breakpoint
CREATE TRIGGER note_versions_capture AFTER UPDATE OF title,content ON entries
WHEN OLD.title IS NOT NEW.title OR OLD.content IS NOT NEW.content
BEGIN
 INSERT OR IGNORE INTO note_versions(user_id,note_id,revision,title,content,updated_at) VALUES(OLD.user_id,OLD.id,OLD.revision,OLD.title,OLD.content,OLD.updated_at);
 DELETE FROM note_versions WHERE user_id=OLD.user_id AND note_id=OLD.id AND revision NOT IN (SELECT revision FROM note_versions WHERE user_id=OLD.user_id AND note_id=OLD.id ORDER BY revision DESC LIMIT 20);
END;
--> statement-breakpoint
CREATE TRIGGER note_versions_delete AFTER DELETE ON entries BEGIN
 DELETE FROM note_versions WHERE user_id=OLD.user_id AND note_id=OLD.id;
END;
