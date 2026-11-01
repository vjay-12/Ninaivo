import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  // In development, warn if missing
  console.warn("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL || "" });
export const db = drizzle(pool, { schema });

