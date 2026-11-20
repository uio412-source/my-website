CREATE TABLE `community_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`topic` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_community_topic_created` ON `community_posts` (`topic`,`created_at`);--> statement-breakpoint
CREATE TABLE `discussion_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`body` text NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_comments_target_created` ON `discussion_comments` (`target_kind`,`target_id`,`created_at`);