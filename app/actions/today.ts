"use server";

import { db } from "@/db";
import { items, dailyLogs, upcomingItems, upcomingCompletions } from "@/db/schema";
import { eq, and, asc, isNull, or, lte, sql } from "drizzle-orm";
import { getTodayDateString, getDateStringInTz } from "@/lib/date";
import { calculateItemStreak } from "@/lib/streaks";
import { isUserAuthenticated } from "@/lib/auth";
import { toggleUpcomingDone } from "@/app/actions/upcoming";
import { revalidatePath } from "next/cache";

export interface TodayItemData {
  id: number;
  name: string;
  type: "checklist" | "diet";
  targetCount: number;
  reminderTime: string | null;
  sortOrder: number;
  active: boolean;
  count: number;
  done: boolean;
  streak: number;
}

export interface TodayWeeklyTaskData {
  id: number;
  name: string;
  reminderTime: string | null;
  done: boolean;
}

export interface TodayFutureReminderData {
  id: number;
  title: string;
  notes: string | null;
  dueAt: Date;
  doneAt: Date | null;
  type?: string;
}

export async function getTodayData(targetDate?: string) {
  const dateStr = targetDate || getTodayDateString();

  // 1. Fetch active habit items ordered by sort_order
  const allItems = await db
    .select()
    .from(items)
    .where(eq(items.active, true))
    .orderBy(asc(items.sortOrder), asc(items.id));

  // 2. Fetch logs for this date
  const logsForDate = await db
    .select()
    .from(dailyLogs)
    .where(eq(dailyLogs.logDate, dateStr));

  const logMap = new Map(logsForDate.map((l) => [l.itemId, l]));

  // 3. Compute habit item data + streaks
  const checklistItems: TodayItemData[] = [];
  const dietItems: TodayItemData[] = [];

  for (const item of allItems) {
    const log = logMap.get(item.id);
    const count = log ? log.count : 0;
    const done = log ? log.done : false;
    const streak = await calculateItemStreak(item.id, dateStr);

    const formattedItem: TodayItemData = {
      ...item,
      count,
      done,
      streak,
    };

    if (item.type === "checklist") {
      checklistItems.push(formattedItem);
    } else {
      dietItems.push(formattedItem);
    }
  }

  // 4. Fetch upcoming items due today or overdue
  const allUpcoming = await db
    .select()
    .from(upcomingItems)
    .orderBy(asc(upcomingItems.dueAt));

  const reminders: TodayFutureReminderData[] = [];
  const now = new Date();

  // Check repeating completions for today
  const todayCompletions = await db
    .select()
    .from(upcomingCompletions)
    .where(eq(upcomingCompletions.occurrenceDate, dateStr));
  const completionSet = new Set(todayCompletions.map((c) => c.itemId));

  for (const item of allUpcoming) {
    // If snoozed past now, ignore
    if (item.snoozedUntil && new Date(item.snoozedUntil).getTime() > now.getTime()) {
      continue;
    }

    const itemDateStr = getDateStringInTz(item.dueAt);
    const isDueOrPast = itemDateStr <= dateStr;

    if (item.repeat) {
      const isDoneToday = completionSet.has(item.id);
      if (itemDateStr === dateStr || isDoneToday || itemDateStr < dateStr) {
        reminders.push({
          id: item.id,
          title: item.title,
          notes: item.notes,
          dueAt: new Date(item.dueAt),
          doneAt: isDoneToday ? new Date() : null,
          type: item.type,
        });
      }
    } else {
      // Non-repeating
      if (isDueOrPast) {
        const isDoneToday = item.doneAt && getDateStringInTz(item.doneAt) === dateStr;
        if (!item.doneAt || isDoneToday) {
          reminders.push({
            id: item.id,
            title: item.title,
            notes: item.notes,
            dueAt: new Date(item.dueAt),
            doneAt: item.doneAt ? new Date(item.doneAt) : null,
            type: item.type,
          });
        }
      }
    }
  }

  return {
    dateStr,
    checklistItems,
    dietItems,
    weeklyToday: [], // Weekly merged into Upcoming
    reminders,
  };
}

export async function setItemCount(itemId: number, count: number, targetCount: number, targetDate?: string) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  const dateStr = targetDate || getTodayDateString();
  const safeCount = Math.max(0, count);
  const done = safeCount >= targetCount;

  await db
    .insert(dailyLogs)
    .values({
      itemId,
      logDate: dateStr,
      count: safeCount,
      done,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [dailyLogs.itemId, dailyLogs.logDate],
      set: {
        count: safeCount,
        done,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/today");
  revalidatePath("/report");
  return { success: true, count: safeCount, done };
}

export async function toggleWeeklyLog(taskId: number, targetDate?: string) {
  return toggleUpcomingDone(taskId);
}

export async function toggleFutureDone(reminderId: number) {
  return toggleUpcomingDone(reminderId);
}
