ALTER TABLE `leads` ADD `prestigeScore` int;--> statement-breakpoint
ALTER TABLE `leads` ADD `hasAssets` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `hasOutreach` boolean DEFAULT false NOT NULL;