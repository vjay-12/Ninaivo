import {
  pgTable,
  serial,
  text,
  integer,
  time,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";

// Daily checklist + diet items
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  uuid: text("uuid").notNull().unique(),
  name: text("name").notNull(),
  type: text("type", { enum: ["checklist", "diet"] }).notNull(),
  targetCount: integer("target_count").notNull().default(1),
  reminderTime: time("reminder_time"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// One row per item per day (upsert on tick)
export const dailyLogs = pgTable(
  "daily_logs",
  {
    id: serial("id").primaryKey(),
    uuid: text("uuid").notNull().unique(),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    itemUuid: text("item_uuid"),
    logDate: date("log_date").notNull(),
    count: integer("count").notNull().default(0),
    done: boolean("done").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    itemDateUnique: unique().on(table.itemId, table.logDate),
    logDateIdx: index("daily_logs_log_date_idx").on(table.logDate),
  })
);

// Unified Upcoming Items (Meetings, Reminders, Todos)
export const upcomingItems = pgTable(
  "upcoming_items",
  {
    id: serial("id").primaryKey(),
    uuid: text("uuid").notNull().unique(),
    title: text("title").notNull(),
    type: text("type", { enum: ["meeting", "reminder", "todo"] })
      .notNull()
      .default("todo"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    hasTime: boolean("has_time").notNull().default(true),
    repeat: text("repeat", { enum: ["daily", "weekly", "monthly"] }),
    notes: text("notes"),
    doneAt: timestamp("done_at", { withTimezone: true }),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    dueAtIdx: index("upcoming_items_due_at_idx").on(table.dueAt),
    doneAtIdx: index("upcoming_items_done_at_idx").on(table.doneAt),
  })
);

// Repeating Item Completions (to keep history of each completed occurrence)
export const upcomingCompletions = pgTable(
  "upcoming_completions",
  {
    id: serial("id").primaryKey(),
    uuid: text("uuid").notNull().unique(),
    itemId: integer("item_id")
      .notNull()
      .references(() => upcomingItems.id, { onDelete: "cascade" }),
    itemUuid: text("item_uuid"),
    occurrenceDate: date("occurrence_date").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    itemOccurrenceUnique: unique().on(table.itemId, table.occurrenceDate),
    itemDateIdx: index("upcoming_completions_item_date_idx").on(
      table.itemId,
      table.occurrenceDate
    ),
  })
);

// Legacy Weekly recurring tasks (retained until verified)
export const weeklyTasks = pgTable("weekly_tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  weekdays: integer("weekdays").array().notNull(), // 0=Sun ... 6=Sat
  reminderTime: time("reminder_time"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Legacy Weekly logs (retained until verified)
export const weeklyLogs = pgTable(
  "weekly_logs",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => weeklyTasks.id, { onDelete: "cascade" }),
    logDate: date("log_date").notNull(),
    done: boolean("done").notNull().default(true),
  },
  (table) => ({
    taskDateUnique: unique().on(table.taskId, table.logDate),
    weeklyLogDateIdx: index("weekly_logs_log_date_idx").on(table.logDate),
  })
);

// Legacy Future reminders (retained until verified)
export const futureReminders = pgTable(
  "future_reminders",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    notes: text("notes"),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    dueAtIdx: index("future_reminders_due_at_idx").on(table.dueAt),
  })
);

// Key-value settings table
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  uuid: text("uuid").notNull().unique(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type DailyLog = typeof dailyLogs.$inferSelect;
export type UpcomingItem = typeof upcomingItems.$inferSelect;
export type NewUpcomingItem = typeof upcomingItems.$inferInsert;
export type UpcomingCompletion = typeof upcomingCompletions.$inferSelect;
export type WeeklyTask = typeof weeklyTasks.$inferSelect;
export type WeeklyLog = typeof weeklyLogs.$inferSelect;
export type FutureReminder = typeof futureReminders.$inferSelect;
