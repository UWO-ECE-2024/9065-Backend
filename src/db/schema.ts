import { pgTable, bigint, text, timestamp } from "drizzle-orm/pg-core";

// define the schema
export const products = pgTable("products", {
  id: bigint("id", { mode: "number" }).primaryKey().notNull(),
  name: text("name").notNull(),
  create_at: timestamp("create_at").notNull().defaultNow(),
  modified_at: timestamp("modified_at").notNull().defaultNow(),
});
