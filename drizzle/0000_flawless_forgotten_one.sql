CREATE TABLE `members` (
	`session` text NOT NULL,
	`user` text NOT NULL,
	`name` text NOT NULL,
	PRIMARY KEY(`session`, `user`)
);
--> statement-breakpoint
CREATE TABLE `ratings` (
	`session` text NOT NULL,
	`user` text NOT NULL,
	`sample` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`session`, `user`, `sample`)
);
--> statement-breakpoint
CREATE TABLE `tastings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`status` text NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`data` text NOT NULL,
	`token` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
