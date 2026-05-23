ALTER TABLE `leads` ADD `phone` varchar(32);--> statement-breakpoint
ALTER TABLE `leads` ADD `address` varchar(512);--> statement-breakpoint
ALTER TABLE `leads` ADD `city` varchar(128);--> statement-breakpoint
ALTER TABLE `leads` ADD `state` varchar(64);--> statement-breakpoint
ALTER TABLE `leads` ADD `googleRating` decimal(3,1);--> statement-breakpoint
ALTER TABLE `leads` ADD `reviewCount` int;--> statement-breakpoint
ALTER TABLE `leads` ADD `reviewSnippets` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `googlePlaceId` varchar(255);--> statement-breakpoint
ALTER TABLE `leads` ADD `businessStatus` varchar(64);--> statement-breakpoint
ALTER TABLE `leads` ADD `category` varchar(128);