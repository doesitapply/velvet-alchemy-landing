ALTER TABLE `leads` ADD `outreachChannel` enum('email','sms','none') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `verifiedOwnerEmail` varchar(320);