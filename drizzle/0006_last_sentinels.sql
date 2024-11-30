ALTER TABLE "orders" DROP CONSTRAINT "orders_user_id_users_user_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_shipping_address_id_user_addresses_address_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_billing_address_id_user_addresses_address_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_payment_method_id_payment_methods_payment_id_fk";
