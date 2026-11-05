import Dexie, { type Table } from "dexie";

export interface LocalItem {
  id?: number;
  uuid: string;
  name: string;
  type: "checklist" | "diet";
  targetCount: number;
  reminderTime?: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface LocalDailyLog {
  id?: number;
  uuid: string;
  itemId?: number;
  itemUuid: string;
  logDate: string; // YYYY-MM-DD
  count: number;
  done: boolean;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface LocalUpcomingItem {
  id?: number;
  uuid: string;
  title: string;
  type: "meeting" | "reminder" | "todo";
  dueAt?: string | null;
  endAt?: string | null;
  hasTime: boolean;
  repeat?: "daily" | "weekly" | "monthly" | null;
  notes?: string | null;
  doneAt?: string | null;
  snoozedUntil?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface LocalUpcomingCompletion {
  id?: number;
  uuid: string;
  itemId?: number;
  itemUuid: string;
  occurrenceDate: string; // YYYY-MM-DD
  completedAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface LocalSetting {
  key: string;
  uuid: string;
  value: any;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface LocalFoodItem {
  id?: number;
  uuid: string;
  name: string;
  category: "fruit" | "protein" | "grain" | "snack" | "drink" | "other";
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface LocalFoodLog {
  id?: number;
  uuid: string;
  foodId?: number;
  foodUuid: string;
  logDate: string; // YYYY-MM-DD
  count: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface OutboxEntry {
  id?: number;
  uuid: string;
  table: "items" | "daily_logs" | "upcoming_items" | "upcoming_completions" | "food_items" | "food_logs" | "settings";
  action: "insert" | "update" | "delete";
  record: any;
  timestamp: number;
}

export interface SyncMeta {
  key: string;
  value: any;
}

export interface LocalSnapshot {
  id?: number;
  createdAt: string;
  reason: string;
  data: any;
}

export class NinaivoLocalDb extends Dexie {
  items!: Table<LocalItem, string>;
  dailyLogs!: Table<LocalDailyLog, string>;
  upcomingItems!: Table<LocalUpcomingItem, string>;
  upcomingCompletions!: Table<LocalUpcomingCompletion, string>;
  foodItems!: Table<LocalFoodItem, string>;
  foodLogs!: Table<LocalFoodLog, string>;
  settings!: Table<LocalSetting, string>;
  syncOutbox!: Table<OutboxEntry, number>;
  syncMeta!: Table<SyncMeta, string>;
  snapshots!: Table<LocalSnapshot, number>;

  constructor() {
    super("NinaivoLocalDB");
    this.version(1).stores({
      items: "uuid, id, type, sortOrder, active, updatedAt, deletedAt",
      dailyLogs: "uuid, id, itemId, itemUuid, logDate, [itemUuid+logDate], updatedAt, deletedAt",
      upcomingItems: "uuid, id, type, dueAt, doneAt, updatedAt, deletedAt",
      upcomingCompletions: "uuid, id, itemId, itemUuid, occurrenceDate, [itemUuid+occurrenceDate], updatedAt, deletedAt",
      settings: "key, uuid, updatedAt, deletedAt",
      syncOutbox: "++id, uuid, table, action, timestamp",
      syncMeta: "key",
    });

    this.version(2).stores({
      items: "uuid, id, type, sortOrder, active, updatedAt, deletedAt",
      dailyLogs: "uuid, id, itemId, itemUuid, logDate, [itemUuid+logDate], updatedAt, deletedAt",
      upcomingItems: "uuid, id, type, dueAt, doneAt, updatedAt, deletedAt",
      upcomingCompletions: "uuid, id, itemId, itemUuid, occurrenceDate, [itemUuid+occurrenceDate], updatedAt, deletedAt",
      foodItems: "uuid, id, category, updatedAt, deletedAt",
      foodLogs: "uuid, id, foodId, foodUuid, logDate, [foodUuid+logDate], updatedAt, deletedAt",
      settings: "key, uuid, updatedAt, deletedAt",
      syncOutbox: "++id, uuid, table, action, timestamp",
      syncMeta: "key",
      snapshots: "++id, createdAt",
    });
  }
}

export const localDb = typeof window !== "undefined" ? new NinaivoLocalDb() : (null as any);
