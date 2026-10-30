"use server";

import { db } from "@/db";
import { items, dailyLogs, weeklyTasks, weeklyLogs, futureReminders, settings } from "@/db/schema";
import { computeReport, ReportRange } from "@/lib/report";
import { isUserAuthenticated } from "@/lib/auth";
import { asc } from "drizzle-orm";

export async function getReportData(range: ReportRange = "month") {
  return await computeReport(range);
}

export async function exportDatabaseBackup() {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  const [
    allItems,
    allDailyLogs,
    allWeeklyTasks,
    allWeeklyLogs,
    allReminders,
    allSettings,
  ] = await Promise.all([
    db.select().from(items).orderBy(asc(items.id)),
    db.select().from(dailyLogs).orderBy(asc(dailyLogs.logDate)),
    db.select().from(weeklyTasks).orderBy(asc(weeklyTasks.id)),
    db.select().from(weeklyLogs).orderBy(asc(weeklyLogs.logDate)),
    db.select().from(futureReminders).orderBy(asc(futureReminders.dueAt)),
    db.select().from(settings),
  ]);

  return {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    items: allItems,
    dailyLogs: allDailyLogs,
    weeklyTasks: allWeeklyTasks,
    weeklyLogs: allWeeklyLogs,
    futureReminders: allReminders,
    settings: allSettings,
  };
}

export async function exportDailyLogsCsv(): Promise<string> {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  const logs = await db.select().from(dailyLogs).orderBy(asc(dailyLogs.logDate));
  const allItems = await db.select().from(items);
  const itemMap = new Map(allItems.map((i) => [i.id, i.name]));

  const headers = ["log_date", "item_id", "item_name", "count", "done", "updated_at"];
  const rows = logs.map((l) => [
    l.logDate,
    l.itemId,
    `"${itemMap.get(l.itemId) || ""}"`,
    l.count,
    l.done ? "TRUE" : "FALSE",
    l.updatedAt ? new Date(l.updatedAt).toISOString() : "",
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

