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
  name: text("name").notNull(),
  type: text("type", { enum: ["checklist", "diet"] }).notNull(),
  targetCount: integer("target_count").notNull().default(1),
  reminderTime: time("reminder_time"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per item per day (upsert on tick)
export const dailyLogs = pgTable(
  "daily_logs",
  {
    id: serial("id").primaryKey(),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    logDate: date("log_date").notNull(),
    count: integer("count").notNull().default(0),
    done: boolean("done").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    itemDateUnique: unique().on(table.itemId, table.logDate),
    logDateIdx: index("daily_logs_log_date_idx").on(table.logDate),
  })
);

// Weekly recurring tasks
export const weeklyTasks = pgTable("weekly_tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  weekdays: integer("weekdays").array().notNull(), // 0=Sun ... 6=Sat
  reminderTime: time("reminder_time"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Weekly logs: per occurrence per date
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

// One-off future reminders
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
  value: jsonb("value").notNull(),
});

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type DailyLog = typeof dailyLogs.$inferSelect;
export type WeeklyTask = typeof weeklyTasks.$inferSelect;
export type WeeklyLog = typeof weeklyLogs.$inferSelect;
export type FutureReminder = typeof futureReminders.$inferSelect;

