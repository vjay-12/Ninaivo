import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  // In development, warn if missing
  console.warn("DATABASE_URL is not set");
}

const sql = neon(process.env.DATABASE_URL || "");
export const db = drizzle(sql, { schema });

