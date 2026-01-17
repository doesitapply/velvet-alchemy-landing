CREATE TABLE `audits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`summary` text,
	`prestigeScore` int,
	`visualDebtData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`websiteUrl` varchar(512) NOT NULL,
	`screenshotUrl` varchar(512),
	`screenshotKey` varchar(512),
	`status` enum('pending','audited','contacted','closed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
