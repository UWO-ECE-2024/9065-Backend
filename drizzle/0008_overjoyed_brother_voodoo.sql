CREATE TABLE IF NOT EXISTS "admins" (
	"admin_id" bigint PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"username" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true,
	"refresh_token" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
