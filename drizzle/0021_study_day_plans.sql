CREATE TABLE `study_day_plans` (
 `user_id` text NOT NULL,
 `day` text NOT NULL,
 `version` text NOT NULL,
 `payload` text NOT NULL,
 `updated_at` text NOT NULL,
 PRIMARY KEY(`user_id`,`day`)
);
