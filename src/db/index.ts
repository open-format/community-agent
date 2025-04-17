import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema"; // Import your schema

import { config } from "dotenv";
config(); // Load environment variables

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 50,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  maxUses: 7500,
  statement_timeout: 25000,
  query_timeout: 20000,
});
// Add error monitoring
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

export const db = drizzle(pool, { schema });
