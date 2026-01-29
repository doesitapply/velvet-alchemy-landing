CREATE TABLE `ai_providers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`displayName` varchar(100) NOT NULL,
	`apiKey` text,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`priority` int NOT NULL DEFAULT 0,
	`maxRequestsPerMinute` int,
	`maxTokensPerDay` int,
	`costPer1kTokens` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_providers_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_providers_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `api_usage_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`providerId` int NOT NULL,
	`userId` int,
	`leadId` int,
	`operation` varchar(100) NOT NULL,
	`model` varchar(100),
	`promptTokens` int NOT NULL,
	`completionTokens` int NOT NULL,
	`totalTokens` int NOT NULL,
	`cost` int,
	`latencyMs` int,
	`success` boolean NOT NULL,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_usage_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `provider_health` (
	`id` int AUTO_INCREMENT NOT NULL,
	`providerId` int NOT NULL,
	`status` enum('healthy','degraded','down') NOT NULL DEFAULT 'healthy',
	`lastSuccessAt` timestamp,
	`lastFailureAt` timestamp,
	`consecutiveFailures` int NOT NULL DEFAULT 0,
	`avgLatencyMs` int,
	`successRate` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_health_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_health_providerId_unique` UNIQUE(`providerId`)
);
