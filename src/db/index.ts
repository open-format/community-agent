import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema"; // Import your schema

import { config } from "dotenv";
config(); // Load environment variables

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 50, // Increased from 20 to handle more concurrent connections
  min: 5, // Add minimum pool size to keep connections ready
  idleTimeoutMillis: 10000, // Reduced from 30000 to free up connections faster
  connectionTimeoutMillis: 5000, // Increased from 2000 to allow for slower network conditions
  maxUses: 7500, // Add maximum uses per connection before being replaced
  statement_timeout: 10000, // Add statement timeout to prevent long-running queries
  query_timeout: 5000, // Add query timeout
});

// Add error monitoring
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

export const db = drizzle(pool, { schema });
