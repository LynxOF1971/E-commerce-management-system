CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`until` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cases` (
	`id` text PRIMARY KEY NOT NULL,
	`creator` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`creator` text NOT NULL,
	`status` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`hash` text NOT NULL,
	`salt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);