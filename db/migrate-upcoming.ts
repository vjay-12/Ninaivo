import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log("Running migration for Upcoming tab...");

  // 1. Create upcoming_items table
  await sql`
    CREATE TABLE IF NOT EXISTS upcoming_items (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'todo' CHECK (type IN ('work', 'meeting', 'reminder', 'todo')),
      due_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ,
      has_time BOOLEAN NOT NULL DEFAULT true,
      repeat TEXT CHECK (repeat IN ('daily', 'weekly', 'monthly')),
      notes TEXT,
      done_at TIMESTAMPTZ,
      snoozed_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  console.log("Created table upcoming_items (if not exists)");

  // 2. Create upcoming_completions table
  await sql`
    CREATE TABLE IF NOT EXISTS upcoming_completions (
      id SERIAL PRIMARY KEY,
      item_id INT NOT NULL REFERENCES upcoming_items(id) ON DELETE CASCADE,
      occurrence_date DATE NOT NULL,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (item_id, occurrence_date)
    );
  `;
  console.log("Created table upcoming_completions (if not exists)");

  // 3. Create indexes
  await sql`CREATE INDEX IF NOT EXISTS upcoming_items_due_at_idx ON upcoming_items (due_at);`;
  await sql`CREATE INDEX IF NOT EXISTS upcoming_items_done_at_idx ON upcoming_items (done_at);`;
  await sql`CREATE INDEX IF NOT EXISTS upcoming_completions_item_date_idx ON upcoming_completions (item_id, occurrence_date);`;

  // 4. Migrate existing future_reminders into upcoming_items
  const existingReminders = await sql`
    SELECT * FROM future_reminders
    WHERE id NOT IN (
      SELECT id FROM upcoming_items
    )
  `.catch(() => []);

  console.log(`Found ${existingReminders.length} future_reminders to migrate.`);
  for (const r of existingReminders) {
    await sql`
      INSERT INTO upcoming_items (id, title, type, due_at, has_time, notes, done_at, created_at)
      VALUES (${r.id}, ${r.title}, 'reminder', ${r.due_at}, true, ${r.notes}, ${r.done_at}, ${r.created_at})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  // Update sequence for upcoming_items
  await sql`
    SELECT setval(pg_get_serial_sequence('upcoming_items', 'id'), COALESCE(MAX(id), 1)) FROM upcoming_items;
  `.catch(() => {});

  // 5. Migrate existing weekly_tasks into upcoming_items
  const existingWeeklyTasks = await sql`SELECT * FROM weekly_tasks`.catch(() => []);
  console.log(`Found ${existingWeeklyTasks.length} weekly_tasks to migrate.`);

  // Function to find next occurrence of a weekday (0=Sun..6=Sat) in Asia/Kolkata
  for (const wt of existingWeeklyTasks) {
    const weekdays: number[] = wt.weekdays || [];
    for (const w of weekdays) {
      // Check if already migrated
      const titleWithDay = wt.name;
      const existing = await sql`
        SELECT id FROM upcoming_items
        WHERE title = ${titleWithDay} AND repeat = 'weekly'
        LIMIT 1
      `;

      if (existing.length === 0) {
        // Calculate next occurrence of this weekday
        const now = new Date();
        const nowKolkata = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const currentDay = nowKolkata.getDay(); // 0-6
        let diff = (w - currentDay + 7) % 7;
        // if diff is 0 and time passed or today, schedule for today or next week
        const targetDate = new Date(nowKolkata);
        targetDate.setDate(targetDate.getDate() + diff);

        let timeStr = wt.reminder_time || "09:00:00";
        const [h, m, s] = timeStr.split(":").map(Number);
        targetDate.setHours(h || 9, m || 0, s || 0, 0);

        const [inserted] = await sql`
          INSERT INTO upcoming_items (title, type, due_at, has_time, repeat, notes, created_at)
          VALUES (${wt.name}, 'todo', ${targetDate.toISOString()}, ${wt.reminder_time !== null}, 'weekly', ${'Migrated from weekly task'}, ${wt.created_at})
          RETURNING id
        `;

        // Migrate any completions from weekly_logs
        const logs = await sql`SELECT * FROM weekly_logs WHERE task_id = ${wt.id}`.catch(() => []);
        for (const l of logs) {
          if (l.done) {
            await sql`
              INSERT INTO upcoming_completions (item_id, occurrence_date)
              VALUES (${inserted.id}, ${l.log_date})
              ON CONFLICT DO NOTHING
            `;
          }
        }
      }
    }
  }

  console.log("Migration completed successfully!");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

