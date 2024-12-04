ALTER TABLE "order_items" ADD COLUMN "status" varchar(50) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();