CREATE TABLE `technographic_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`url` varchar(512) NOT NULL,
	`detected_cms` varchar(100),
	`has_pixel` boolean DEFAULT false,
	`has_ga4` boolean DEFAULT false,
	`ssl_error` boolean DEFAULT false,
	`neglected` boolean DEFAULT false,
	`last_scanned_at` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `technographic_leads_id` PRIMARY KEY(`id`),
	CONSTRAINT `technographic_leads_url_unique` UNIQUE(`url`)
);
