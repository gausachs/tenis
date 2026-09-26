CREATE TABLE `members` (
	`room_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`last_seen` integer NOT NULL,
	PRIMARY KEY(`room_id`, `token_hash`),
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `members_presence` ON `members` (`room_id`,`last_seen`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`mode` text DEFAULT 'shared' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
