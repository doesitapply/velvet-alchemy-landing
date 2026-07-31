CREATE TABLE `acquisition_learning_policy_releases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`releaseId` varchar(64) NOT NULL,
	`action` enum('APPLY','DEACTIVATE') NOT NULL,
	`activeCandidateId` int,
	`previousCandidateId` int,
	`candidateKey` varchar(180),
	`candidateVersion` int,
	`proposalHash` varchar(64),
	`evidenceHash` varchar(64),
	`requestHash` varchar(64) NOT NULL,
	`receiptHash` varchar(64) NOT NULL,
	`reason` text NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `acquisition_learning_policy_releases_id` PRIMARY KEY(`id`),
	CONSTRAINT `acquisition_learning_policy_releases_release_id_unique` UNIQUE(`releaseId`)
);
--> statement-breakpoint
CREATE INDEX `acquisition_learning_policy_releases_user_id_idx` ON `acquisition_learning_policy_releases` (`userId`,`id`);