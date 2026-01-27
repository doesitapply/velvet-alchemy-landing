CREATE TABLE `api_calls` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`leadId` int,
	`service` varchar(64) NOT NULL,
	`operation` varchar(128) NOT NULL,
	`tokensUsed` int,
	`estimatedCost` int NOT NULL,
	`requestData` text,
	`responseStatus` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_calls_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_onboarding` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`hasCompletedScraper` boolean NOT NULL DEFAULT false,
	`hasReviewedAudit` boolean NOT NULL DEFAULT false,
	`hasSentInvoice` boolean NOT NULL DEFAULT false,
	`hasReceivedPayment` boolean NOT NULL DEFAULT false,
	`onboardingCompletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_onboarding_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_onboarding_userId_unique` UNIQUE(`userId`)
);
