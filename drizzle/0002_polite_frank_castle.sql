CREATE TABLE `change_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`requester_id` text NOT NULL,
	`status` text NOT NULL,
	`data` text NOT NULL,
	`pending_key` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `change_requests_pending_key_unique` ON `change_requests` (`pending_key`);--> statement-breakpoint
ALTER TABLE `orders` ADD `version` integer DEFAULT 0 NOT NULL;