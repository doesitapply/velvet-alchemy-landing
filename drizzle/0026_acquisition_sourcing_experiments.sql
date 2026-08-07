CREATE TABLE `acquisition_sourcing_experiment_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`experimentRowId` int NOT NULL,
	`userId` int NOT NULL,
	`actorId` int NOT NULL,
	`action` varchar(80) NOT NULL,
	`fromState` varchar(32),
	`toState` varchar(32) NOT NULL,
	`payloadHash` varchar(64) NOT NULL,
	`details` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `acquisition_sourcing_experiment_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `acquisition_sourcing_experiments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`experimentId` varchar(64) NOT NULL,
	`workspaceId` int NOT NULL,
	`state` enum('PREPARED','ACTIVE','CLOSED','CANCELLED') NOT NULL DEFAULT 'PREPARED',
	`definition` mediumtext NOT NULL,
	`definitionHash` varchar(64) NOT NULL,
	`resultPayload` mediumtext,
	`resultPayloadHash` varchar(64),
	`preparedBy` int NOT NULL,
	`activatedBy` int,
	`activatedAt` timestamp,
	`closedBy` int,
	`closedAt` timestamp,
	`cancelledBy` int,
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `acquisition_sourcing_experiments_id` PRIMARY KEY(`id`),
	CONSTRAINT `acquisition_sourcing_experiments_experiment_id_unique` UNIQUE(`experimentId`)
);
--> statement-breakpoint
ALTER TABLE `smirk_discovery_requests` ADD `acquisitionSourcingExperimentId` int;--> statement-breakpoint
ALTER TABLE `smirk_discovery_requests` ADD `acquisitionSourcingSlotOrdinal` int;--> statement-breakpoint
ALTER TABLE `smirk_discovery_requests` ADD `acquisitionSourcingArm` enum('control','challenger');--> statement-breakpoint
ALTER TABLE `smirk_discovery_requests` ADD `acquisitionSourcingAssignmentPayload` text;--> statement-breakpoint
ALTER TABLE `smirk_discovery_requests` ADD `acquisitionSourcingAssignmentHash` varchar(64);--> statement-breakpoint
ALTER TABLE `smirk_discovery_requests` ADD CONSTRAINT `smirk_discovery_requests_experiment_slot_unique` UNIQUE(`acquisitionSourcingExperimentId`,`acquisitionSourcingSlotOrdinal`);--> statement-breakpoint
CREATE INDEX `acquisition_sourcing_experiment_events_experiment_created_idx` ON `acquisition_sourcing_experiment_events` (`experimentRowId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `acquisition_sourcing_experiments_owner_workspace_state_idx` ON `acquisition_sourcing_experiments` (`userId`,`workspaceId`,`state`);