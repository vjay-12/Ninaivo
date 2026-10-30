import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function seed() {
  console.log("Seeding starter items...");

  const existing = await db.select().from(schema.items);
  if (existing.length === 0) {
    await db.insert(schema.items).values([
      {
        name: "Brush at night",
        type: "checklist",
        targetCount: 1,
        reminderTime: "22:00:00",
        sortOrder: 0,
        active: true,
      },
      {
        name: "Eggs",
        type: "diet",
        targetCount: 1,
        reminderTime: "09:00:00",
        sortOrder: 1,
        active: true,
      },
      {
        name: "Fruits",
        type: "diet",
        targetCount: 3,
        reminderTime: "16:00:00",
        sortOrder: 2,
        active: true,
      },
    ]);
    console.log("Starter items seeded: Brush at night, Eggs, Fruits (3)");
  } else {
    console.log(`Database already has ${existing.length} items. Skipping seed.`);
  }

  // Also check if settings has timezone
  await db
    .insert(schema.settings)
    .values({
      key: "timezone",
      value: { tz: process.env.TZ_DEFAULT || "Asia/Kolkata" },
    })
    .onConflictDoNothing();

  console.log("Seed complete.");
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});

