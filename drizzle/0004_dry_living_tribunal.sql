CREATE TABLE `shopping_items` (
	`user` text NOT NULL,
	`key` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user`, `key`)
);
