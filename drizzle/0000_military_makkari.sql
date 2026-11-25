CREATE TABLE `intros` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`title` text NOT NULL,
	`sender_id` text NOT NULL,
	`sender_name` text NOT NULL,
	`sender_email` text NOT NULL,
	`recipient_id` text NOT NULL,
	`recipient_name` text NOT NULL,
	`recipient_email` text,
	`status` text NOT NULL,
	`note` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `intro_sender` ON `intros` (`sender_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `intro_recipient` ON `intros` (`recipient_id`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `intro_sender_listing` ON `intros` (`sender_id`,`listing_id`);--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`role` text NOT NULL,
	`title` text NOT NULL,
	`area` text NOT NULL,
	`destination` text NOT NULL,
	`days` text NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`note` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expires` integer NOT NULL,
	`removed_at` integer,
	`hidden_at` integer
);
--> statement-breakpoint
CREATE INDEX `listing_owner` ON `listings` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `listing_public` ON `listings` (`removed_at`,`hidden_at`,`expires`);--> statement-breakpoint
CREATE TABLE `reports` (
	`listing_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `report_reporter` ON `reports` (`reporter_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `report_once` ON `reports` (`listing_id`,`reporter_id`);