CREATE TABLE IF NOT EXISTS `acquisition_learning_candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`candidateKey` varchar(180) NOT NULL,
	`version` int NOT NULL,
	`state` enum('CANDIDATE','APPROVED','REJECTED') NOT NULL DEFAULT 'CANDIDATE',
	`proposal` text NOT NULL,
	`evidence` text NOT NULL,
	`sampleSize` int NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`decidedBy` int,
	`decidedAt` timestamp,
	CONSTRAINT `acquisition_learning_candidates_id` PRIMARY KEY(`id`),
	CONSTRAINT `acquisition_learning_candidates_user_key_version_unique` UNIQUE(`userId`,`candidateKey`,`version`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `smirk_outcome_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`leadId` int NOT NULL,
	`workspaceId` int NOT NULL,
	`externalProspectId` varchar(160) NOT NULL,
	`externalEventId` varchar(160) NOT NULL,
	`outreachApprovalId` varchar(64) NOT NULL,
	`channel` enum('email','call') NOT NULL,
	`outcome` enum('delivered','bounced','replied','qualified','demo_booked','converted','not_interested','dnc','call_connected','voicemail','no_answer','failed') NOT NULL,
	`evidenceHash` varchar(64) NOT NULL,
	`outreachPayloadHash` varchar(64) NOT NULL,
	`eventPayloadHash` varchar(64) NOT NULL,
	`notes` text,
	`occurredAt` timestamp NOT NULL,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `smirk_outcome_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `smirk_outcome_events_externalEventId_unique` UNIQUE(`externalEventId`)
);
--> statement-breakpoint
SET @smirk_add_column_sql = IF(
	EXISTS(
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = DATABASE()
			AND table_name = 'leads'
			AND column_name = 'smirkHandoffAt'
	),
	'SELECT 1',
	'ALTER TABLE `leads` ADD COLUMN `smirkHandoffAt` timestamp'
);--> statement-breakpoint
PREPARE smirk_add_column_stmt FROM @smirk_add_column_sql;--> statement-breakpoint
EXECUTE smirk_add_column_stmt;--> statement-breakpoint
DEALLOCATE PREPARE smirk_add_column_stmt;--> statement-breakpoint
SET @smirk_add_column_sql = IF(
	EXISTS(
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = DATABASE()
			AND table_name = 'leads'
			AND column_name = 'smirkCallOutcome'
	),
	'SELECT 1',
	'ALTER TABLE `leads` ADD COLUMN `smirkCallOutcome` varchar(64)'
);--> statement-breakpoint
PREPARE smirk_add_column_stmt FROM @smirk_add_column_sql;--> statement-breakpoint
EXECUTE smirk_add_column_stmt;--> statement-breakpoint
DEALLOCATE PREPARE smirk_add_column_stmt;--> statement-breakpoint
SET @smirk_add_column_sql = IF(
	EXISTS(
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = DATABASE()
			AND table_name = 'leads'
			AND column_name = 'smirkCallSummary'
	),
	'SELECT 1',
	'ALTER TABLE `leads` ADD COLUMN `smirkCallSummary` text'
);--> statement-breakpoint
PREPARE smirk_add_column_stmt FROM @smirk_add_column_sql;--> statement-breakpoint
EXECUTE smirk_add_column_stmt;--> statement-breakpoint
DEALLOCATE PREPARE smirk_add_column_stmt;--> statement-breakpoint
SET @smirk_add_column_sql = IF(
	EXISTS(
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = DATABASE()
			AND table_name = 'leads'
			AND column_name = 'smirkWorkspaceId'
	),
	'SELECT 1',
	'ALTER TABLE `leads` ADD COLUMN `smirkWorkspaceId` varchar(128)'
);--> statement-breakpoint
PREPARE smirk_add_column_stmt FROM @smirk_add_column_sql;--> statement-breakpoint
EXECUTE smirk_add_column_stmt;--> statement-breakpoint
DEALLOCATE PREPARE smirk_add_column_stmt;
