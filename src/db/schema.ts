import { sql } from "drizzle-orm";
import {
  pgTable,
  bigint,
  text,
  timestamp,
  varchar,
  boolean,
  date,
  unique,
  decimal,
  integer,
  uuid,
} from "drizzle-orm/pg-core";

// Helper for timestamps
const createTimestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
};

// Users table
export const users = pgTable("users", {
  userId: bigint("user_id", { mode: "number" }).primaryKey().notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  isActive: boolean("is_active").default(true),
  isVerified: boolean("is_verified").default(false),
  refreshToken: text("refresh_token"),
  ...createTimestamps,
});

// Admin users table
export const admins = pgTable("admins", {
  adminId: bigint("admin_id", { mode: "number" }).primaryKey().notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  username: varchar("username", { length: 100 }).notNull(),
  isActive: boolean("is_active").default(true),
  refreshToken: text("refresh_token"),
  ...createTimestamps,
});

// User addresses table
export const userAddresses = pgTable("user_addresses", {
  addressId: bigint("address_id", { mode: "number" }).primaryKey().notNull(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  streetAddress: varchar("street_address", { length: 255 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 100 }).notNull(),
  postalCode: varchar("postal_code", { length: 20 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Payment methods table
export const paymentMethods = pgTable("payment_methods", {
  paymentId: bigint("payment_id", { mode: "number" }).primaryKey().notNull(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  cardType: varchar("card_type", { length: 50 }).notNull(),
  lastFour: varchar("last_four").notNull(),
  holderName: varchar("holder_name", { length: 255 }).notNull(),
  expiryDate: varchar("expiry_date", { length: 10 }).notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Categories table
export const categories: ReturnType<typeof pgTable> = pgTable(
  "categories",
  {
    categoryId: bigint("category_id", { mode: "number" })
      .primaryKey()
      .notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    parentCategoryId: bigint("parent_category_id", {
      mode: "number",
    }).references(() => categories.categoryId),
    isActive: boolean("is_active").default(true),
  },
  (table) => ({
    uniqueName: unique("unique_category_name").on(table.name),
  })
);

// Products table
export const products = pgTable("products", {
  productId: bigint("product_id", { mode: "number" }).primaryKey().notNull(),
  categoryId: bigint("category_id", { mode: "number" })
    .notNull()
    .references(() => categories.categoryId),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  // sku: varchar("sku", { length: 50 }).notNull().unique(),
  isActive: boolean("is_active").default(true),
  ...createTimestamps,
});

// Product attributes table
export const productAttributes = pgTable(
  "product_attributes",
  {
    attributeId: bigint("attribute_id", { mode: "number" })
      .primaryKey()
      .notNull(),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => products.productId, { onDelete: "cascade" }),
    key: varchar("key", { length: 50 }).notNull(),
    value: text("value").notNull(),
  },
  (table) => ({
    uniqueAttribute: unique("unique_product_attribute").on(
      table.productId,
      table.key
    ),
  })
);

// Product images table
export const productImages = pgTable("product_images", {
  imageId: bigint("image_id", { mode: "number" }).primaryKey().notNull(),
  productId: bigint("product_id", { mode: "number" })
    .notNull()
    .references(() => products.productId, { onDelete: "cascade" }),
  url: varchar("url", { length: 512 }).notNull(),
  altText: varchar("alt_text", { length: 255 }),
  displayOrder: integer("display_order").notNull().default(0),
  isPrimary: boolean("is_primary").default(false),
});

// Product reviews table
export const productReviews = pgTable("product_reviews", {
  reviewId: bigint("review_id", { mode: "number" }).primaryKey().notNull(),
  productId: bigint("product_id", { mode: "number" })
    .notNull()
    .references(() => products.productId, { onDelete: "cascade" }),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  isVerified: boolean("is_verified").default(false),
});

// Carts table
export const carts = pgTable("carts", {
  cartId: bigint("cart_id", { mode: "number" }).primaryKey().notNull(),
  userId: bigint("user_id", { mode: "number" }).references(() => users.userId),
  sessionId: uuid("session_id").defaultRandom(),
  isActive: boolean("is_active").default(true),
  lastActivity: timestamp("last_activity", { withTimezone: true }).defaultNow(),
  ...createTimestamps,
});

// Cart items table
export const cartItems = pgTable("cart_items", {
  cartItemId: bigint("cart_item_id", { mode: "number" }).primaryKey().notNull(),
  cartId: bigint("cart_id", { mode: "number" })
    .notNull()
    .references(() => carts.cartId, { onDelete: "cascade" }),
  productId: bigint("product_id", { mode: "number" })
    .notNull()
    .references(() => products.productId),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  addedAt: timestamp("added_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Orders table
export const orders = pgTable("orders", {
  orderId: bigint("order_id", { mode: "number" }).primaryKey().notNull(),
  userId: bigint("user_id", { mode: "number" }).notNull(),
  // .references(() => users.userId),
  shippingAddressId: bigint("shipping_address_id", {
    mode: "number",
  }).notNull(),
  // .references(() => userAddresses.addressId),
  billingAddressId: bigint("billing_address_id", { mode: "number" }).notNull(),
  // .references(() => userAddresses.addressId),
  paymentMethodId: bigint("payment_method_id", { mode: "number" }).notNull(),
  // .references(() => paymentMethods.paymentId),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  ...createTimestamps,
});

// Order items table
export const orderItems = pgTable("order_items", {
  orderItemId: bigint("order_item_id", { mode: "number" })
    .primaryKey()
    .notNull(),
  orderId: bigint("order_id", { mode: "number" })
    .notNull()
    .references(() => orders.orderId, { onDelete: "cascade" }),
  productId: bigint("product_id", { mode: "number" })
    .notNull()
    .references(() => products.productId),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
});

// Order status history table
export const orderStatusHistory = pgTable("order_status_history", {
  historyId: bigint("history_id", { mode: "number" }).primaryKey().notNull(),
  orderId: bigint("order_id", { mode: "number" })
    .notNull()
    .references(() => orders.orderId, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Indexes
export const indexes = sql`
  CREATE INDEX idx_user_email ON users(email);
  CREATE INDEX idx_product_category ON products(category_id);
  CREATE INDEX idx_cart_user ON carts(user_id);
  CREATE INDEX idx_cart_session ON carts(session_id);
  CREATE INDEX idx_order_user ON orders(user_id);
  CREATE INDEX idx_order_status ON orders(status);
  CREATE INDEX idx_product_active ON products(is_active);
  CREATE INDEX idx_cart_active ON carts(is_active);
`;

// "remove" CREATE INDEX idx_product_sku ON products(sku);
