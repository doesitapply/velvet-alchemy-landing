CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lead_id` int NOT NULL,
	`stripe_checkout_session_id` varchar(255) NOT NULL,
	`stripe_payment_intent_id` varchar(255),
	`amount` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'usd',
	`status` enum('pending','completed','failed','expired') NOT NULL DEFAULT 'pending',
	`package_type` enum('basic','standard','premium') NOT NULL,
	`payment_link` varchar(512),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completed_at` timestamp,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_stripe_checkout_session_id_unique` UNIQUE(`stripe_checkout_session_id`)
);
--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_lead_id_leads_id_fk` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;