CREATE TABLE `catalog_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`issuer` text NOT NULL,
	`type` text NOT NULL,
	`annual_fee_min` integer,
	`minimum_spend` integer,
	`issuance_status` text NOT NULL,
	`payload` text NOT NULL,
	`verified_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_catalog_cards_issuer_type` ON `catalog_cards` (`issuer`,`type`);--> statement-breakpoint
CREATE TABLE `catalog_events` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`issuer` text NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL,
	`verified_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_catalog_events_kind_status` ON `catalog_events` (`kind`,`status`);--> statement-breakpoint
CREATE TABLE `catalog_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `catalog_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`kind` text NOT NULL,
	`tag` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_catalog_tags_tag_kind` ON `catalog_tags` (`tag`,`kind`);