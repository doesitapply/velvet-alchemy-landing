CREATE TABLE `assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`type` enum('hero_header','social_post','web_banner') NOT NULL,
	`url` varchar(512) NOT NULL,
	`s3Key` varchar(512) NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assets_id` PRIMARY KEY(`id`)
);
