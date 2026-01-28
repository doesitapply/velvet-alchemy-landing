CREATE TABLE `email_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`campaignId` int,
	`draftId` int,
	`recipientEmail` varchar(320) NOT NULL,
	`recipientName` varchar(255),
	`subject` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`status` enum('pending','pending_approval','approved','sending','sent','failed','bounced') NOT NULL DEFAULT 'pending',
	`scheduledFor` timestamp,
	`sentAt` timestamp,
	`gmailMessageId` varchar(255),
	`gmailThreadId` varchar(255),
	`openedAt` timestamp,
	`clickedAt` timestamp,
	`repliedAt` timestamp,
	`replyContent` text,
	`errorMessage` text,
	`retryCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `follow_up_sequences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`initialEmailId` int,
	`sequenceType` enum('cold_outreach','demo_follow_up','proposal_follow_up','nurture') NOT NULL,
	`currentStep` int NOT NULL DEFAULT 0,
	`maxSteps` int NOT NULL DEFAULT 3,
	`status` enum('active','paused','completed','stopped') NOT NULL DEFAULT 'active',
	`stopReason` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `follow_up_sequences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `voice_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`formality` enum('casual','professional','technical','mixed') NOT NULL,
	`directness` enum('blunt','direct','diplomatic','verbose') NOT NULL,
	`enthusiasm` enum('high','moderate','low','neutral') NOT NULL,
	`avgSentenceLength` int NOT NULL,
	`avgParagraphLength` int NOT NULL,
	`usesContractions` boolean NOT NULL,
	`usesEmoji` boolean NOT NULL,
	`usesProfanity` boolean NOT NULL,
	`commonPhrases` text NOT NULL,
	`industryJargon` text NOT NULL,
	`signOffStyle` varchar(100) NOT NULL,
	`greetingStyle` varchar(100) NOT NULL,
	`usesLists` boolean NOT NULL,
	`usesBoldText` boolean NOT NULL,
	`usesQuestions` boolean NOT NULL,
	`exampleEmails` text NOT NULL,
	`calibrationCount` int NOT NULL DEFAULT 0,
	`isCalibrated` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `voice_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `voice_profiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `email_queue` ADD CONSTRAINT `email_queue_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_queue` ADD CONSTRAINT `email_queue_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_queue` ADD CONSTRAINT `email_queue_draftId_outreach_drafts_id_fk` FOREIGN KEY (`draftId`) REFERENCES `outreach_drafts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `follow_up_sequences` ADD CONSTRAINT `follow_up_sequences_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `follow_up_sequences` ADD CONSTRAINT `follow_up_sequences_initialEmailId_email_queue_id_fk` FOREIGN KEY (`initialEmailId`) REFERENCES `email_queue`(`id`) ON DELETE no action ON UPDATE no action;