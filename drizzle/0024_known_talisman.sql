CREATE TABLE `smirk_discovery_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`discoveryId` int NOT NULL,
	`userId` int NOT NULL,
	`actorType` enum('smirk_api','velvet_user','worker','system') NOT NULL,
	`actorId` varchar(160) NOT NULL,
	`action` varchar(80) NOT NULL,
	`fromState` varchar(32),
	`toState` varchar(32) NOT NULL,
	`payloadHash` varchar(64) NOT NULL,
	`details` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `smirk_discovery_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `smirk_discovery_lead_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`discoveryId` int NOT NULL,
	`userId` int NOT NULL,
	`sourcePlaceId` varchar(255) NOT NULL,
	`leadId` int,
	`state` enum('CREATED','READY','SKIPPED','FAILED') NOT NULL,
	`sourcePayloadHash` varchar(64) NOT NULL,
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `smirk_discovery_lead_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `smirk_discovery_lead_items_discovery_place_unique` UNIQUE(`discoveryId`,`sourcePlaceId`)
);
--> statement-breakpoint
CREATE TABLE `smirk_discovery_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`requestId` varchar(160) NOT NULL,
	`workspaceId` int NOT NULL,
	`requestedByApiKeyId` int NOT NULL,
	`requestedByApiKeyName` varchar(100) NOT NULL,
	`requestPayload` mediumtext NOT NULL,
	`requestPayloadHash` varchar(64) NOT NULL,
	`effectiveCriteria` text NOT NULL,
	`effectiveCriteriaHash` varchar(64) NOT NULL,
	`appliedLearningCandidateId` int,
	`appliedLearningCandidatePayload` text,
	`quotePayload` text NOT NULL,
	`quotePayloadHash` varchar(64) NOT NULL,
	`state` enum('PREPARED','APPROVED','QUEUED','RUNNING','COMPLETED','EMPTY','PARTIAL','FAILED','REJECTED','CANCELLED','EXPIRED') NOT NULL DEFAULT 'PREPARED',
	`approvalPayloadHash` varchar(64),
	`approvedMaxSpendCents` int,
	`approvedBy` int,
	`approvedAt` timestamp,
	`expiresAt` timestamp NOT NULL,
	`queuedBy` int,
	`queuedAt` timestamp,
	`executionToken` varchar(64),
	`leaseExpiresAt` timestamp,
	`providerRequests` int NOT NULL DEFAULT 0,
	`createdLeadCount` int NOT NULL DEFAULT 0,
	`readyLeadCount` int NOT NULL DEFAULT 0,
	`skippedLeadCount` int NOT NULL DEFAULT 0,
	`failedLeadCount` int NOT NULL DEFAULT 0,
	`resultPayload` mediumtext,
	`resultPayloadHash` varchar(64),
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `smirk_discovery_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `smirk_discovery_requests_request_unique` UNIQUE(`requestId`)
);
--> statement-breakpoint
CREATE INDEX `smirk_discovery_events_discovery_created_idx` ON `smirk_discovery_events` (`discoveryId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `smirk_discovery_lead_items_discovery_state_idx` ON `smirk_discovery_lead_items` (`discoveryId`,`state`);--> statement-breakpoint
CREATE INDEX `smirk_discovery_requests_state_created_idx` ON `smirk_discovery_requests` (`state`,`createdAt`);