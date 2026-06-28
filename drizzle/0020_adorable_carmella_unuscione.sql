ALTER TABLE `payments` ADD `paid_at` timestamp;--> statement-breakpoint
ALTER TABLE `payments` DROP COLUMN `updated_at`;--> statement-breakpoint
ALTER TABLE `payments` DROP COLUMN `completed_at`;