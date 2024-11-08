import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

config({ path: ".env" });

const sql = new Pool({
  host: process.env.DATABASE_URL!,
  port: 5432,
  user: process.env.DATABASE_USER!,
  password: process.env.DATABASE_PASSWORD!,
  database: process.env.DATABASE_NAME!,
});

const db = drizzle(sql);

const main = async () => {
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });

    console.log("Migration completed");
  } catch (error) {
    console.error("Error during migration:", error);

    process.exit(1);
  }
};

main();
