CREATE TABLE `pipeline_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`currentStage` varchar(50),
	`stagesCompleted` text,
	`errorMessage` text,
	`retryCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `pipeline_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `pipeline_jobs` ADD CONSTRAINT `pipeline_jobs_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;