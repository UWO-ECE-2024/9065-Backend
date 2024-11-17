ALTER TABLE "products" DROP CONSTRAINT "products_sku_unique";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN IF EXISTS "sku";