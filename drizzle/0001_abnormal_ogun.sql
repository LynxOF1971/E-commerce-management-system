CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`data` text NOT NULL,
	`creator` text NOT NULL,
	`created` text NOT NULL,
	`voided` integer DEFAULT 0 NOT NULL,
	`import_key` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expenses_import_key_unique` ON `expenses` (`import_key`);--> statement-breakpoint
CREATE TABLE `salaries` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`data` text NOT NULL,
	`creator` text NOT NULL,
	`created` text NOT NULL,
	`voided` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `users` ADD `roles` text;