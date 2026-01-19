CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` enum('draft','pending_approval','approved','sent','failed') NOT NULL DEFAULT 'draft',
	`sentAt` timestamp,
	`openedAt` timestamp,
	`clickedAt` timestamp,
	`repliedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `outreach_drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`subject` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`recipientEmail` varchar(320) NOT NULL,
	`recipientName` varchar(255),
	`status` enum('draft','pending_approval','approved','rejected','sent') NOT NULL DEFAULT 'draft',
	`rejectionReason` text,
	`approvedBy` int,
	`approvedAt` timestamp,
	`sentAt` timestamp,
	`gmailMessageId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `outreach_drafts_id` PRIMARY KEY(`id`)
);
