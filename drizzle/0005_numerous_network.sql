CREATE TABLE `pending_profiles` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`history_names` text DEFAULT '[]' NOT NULL,
	`mime` text DEFAULT '' NOT NULL,
	`avatar` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
