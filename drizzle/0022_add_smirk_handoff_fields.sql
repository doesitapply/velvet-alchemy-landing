ALTER TABLE `leads` MODIFY COLUMN `status` enum('pending','audited','contacted','closed','paid','smirk_queued','smirk_contacted') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `leads` ADD `smirkHandoffAt` timestamp;--> statement-breakpoint
ALTER TABLE `leads` ADD `smirkCallOutcome` varchar(64);--> statement-breakpoint
ALTER TABLE `leads` ADD `smirkCallSummary` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `smirkWorkspaceId` varchar(128);