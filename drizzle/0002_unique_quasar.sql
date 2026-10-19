CREATE TABLE `avatars` (
	`user` text PRIMARY KEY NOT NULL,
	`mime` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`history_names` text DEFAULT '[]' NOT NULL,
	`avatar_version` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
