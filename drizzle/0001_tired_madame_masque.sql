CREATE TABLE `terms_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`target_id` text NOT NULL,
	`action` text NOT NULL,
	`version` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `terms_user` ON `terms_receipts` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `listings` ADD `date` text DEFAULT '' NOT NULL;