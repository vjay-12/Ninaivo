import { z } from "zod";

export const BackupItemSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().min(1, "Item name cannot be empty"),
  type: z.enum(["checklist", "diet"]),
  targetCount: z.number().int().positive("Target count must be greater than 0").default(1),
  reminderTime: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
  createdAt: z.union([z.string(), z.date()]).optional(),
});

export const BackupDailyLogSchema = z.object({
  id: z.number().int().optional(),
  itemId: z.number().int(),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  count: z.number().int().min(0).default(0),
  done: z.boolean().default(false),
  updatedAt: z.union([z.string(), z.date()]).optional(),
});

export const BackupUpcomingItemSchema = z.object({
  id: z.number().int().optional(),
  title: z.string().min(1, "Upcoming item title cannot be empty"),
  type: z.enum(["work", "meeting", "reminder", "todo"]).default("todo"),
  dueAt: z
    .union([z.string(), z.date()])
    .refine((val) => !isNaN(new Date(val).getTime()), "Invalid dueAt timestamp"),
  endAt: z
    .union([z.string(), z.date()])
    .nullable()
    .optional()
    .refine((val) => !val || !isNaN(new Date(val).getTime()), "Invalid endAt timestamp"),
  hasTime: z.boolean().default(true),
  repeat: z.enum(["daily", "weekly", "monthly"]).nullable().optional(),
  notes: z.string().nullable().optional(),
  doneAt: z
    .union([z.string(), z.date()])
    .nullable()
    .optional()
    .refine((val) => !val || !isNaN(new Date(val).getTime()), "Invalid doneAt timestamp"),
  snoozedUntil: z
    .union([z.string(), z.date()])
    .nullable()
    .optional()
    .refine((val) => !val || !isNaN(new Date(val).getTime()), "Invalid snoozedUntil timestamp"),
  createdAt: z.union([z.string(), z.date()]).optional(),
});

export const BackupUpcomingCompletionSchema = z.object({
  id: z.number().int().optional(),
  itemId: z.number().int(),
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid occurrence date format (YYYY-MM-DD)"),
  completedAt: z
    .union([z.string(), z.date()])
    .refine((val) => !isNaN(new Date(val).getTime()), "Invalid completedAt timestamp"),
});

export const BackupSettingsSchema = z.record(z.string(), z.any());

export const BackupPayloadSchema = z.object({
  app: z.literal("ninaivo", {
    message: "Invalid backup file: app identifier must be 'ninaivo'",
  }),
  version: z.number().int().max(1, {
    message: "This backup was created by a newer version of Ninaivo. Please update the app to import it.",
  }),
  exportedAt: z.string().refine((val) => !isNaN(new Date(val).getTime()), "Invalid exportedAt date format"),
  timezone: z.string().default("Asia/Kolkata"),
  counts: z
    .object({
      items: z.number().int().nonnegative().optional(),
      dailyLogs: z.number().int().nonnegative().optional(),
      upcoming: z.number().int().nonnegative().optional(),
      completions: z.number().int().nonnegative().optional(),
      settings: z.number().int().nonnegative().optional(),
    })
    .optional(),
  data: z.object({
    items: z.array(BackupItemSchema).default([]),
    dailyLogs: z.array(BackupDailyLogSchema).default([]),
    upcoming: z.array(BackupUpcomingItemSchema).default([]),
    completions: z.array(BackupUpcomingCompletionSchema).default([]),
    settings: BackupSettingsSchema.default({}),
  }),
});

export type BackupPayload = z.infer<typeof BackupPayloadSchema>;
export type BackupItem = z.infer<typeof BackupItemSchema>;
export type BackupDailyLog = z.infer<typeof BackupDailyLogSchema>;
export type BackupUpcomingItem = z.infer<typeof BackupUpcomingItemSchema>;
export type BackupUpcomingCompletion = z.infer<typeof BackupUpcomingCompletionSchema>;

