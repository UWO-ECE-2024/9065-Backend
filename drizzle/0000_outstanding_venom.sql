CREATE TABLE IF NOT EXISTS "products" (
	"id" bigint PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"create_at" timestamp DEFAULT now() NOT NULL,
	"modified_at" timestamp DEFAULT now() NOT NULL
);
