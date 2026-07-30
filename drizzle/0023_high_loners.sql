CREATE TABLE `smirk_lead_batch_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` int NOT NULL,
	`userId` int NOT NULL,
	`leadId` int NOT NULL,
	`ordinal` int NOT NULL,
	`prospectPayloadHash` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `smirk_lead_batch_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `smirk_lead_batch_items_owner_lead_unique` UNIQUE(`userId`,`leadId`),
	CONSTRAINT `smirk_lead_batch_items_batch_ordinal_unique` UNIQUE(`batchId`,`ordinal`)
);
--> statement-breakpoint
CREATE TABLE `smirk_lead_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`requestId` varchar(160) NOT NULL,
	`workspaceId` int NOT NULL,
	`requestedByApiKeyId` int NOT NULL,
	`requestedByApiKeyName` varchar(100) NOT NULL,
	`requestPayload` text NOT NULL,
	`requestPayloadHash` varchar(64) NOT NULL,
	`state` enum('PROCESSING','EXPORTED','EMPTY') NOT NULL DEFAULT 'PROCESSING',
	`responsePayload` mediumtext,
	`responsePayloadHash` varchar(64),
	`appliedLearningCandidateId` int,
	`leadCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `smirk_lead_batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `smirk_lead_batches_request_unique` UNIQUE(`requestId`)
);
