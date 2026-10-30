"use server";

import { db } from "@/db";
import { items, dailyLogs, weeklyTasks, weeklyLogs, futureReminders } from "@/db/schema";
import { eq, and, asc, isNull, or, lte, sql } from "drizzle-orm";
import { getTodayDateString, getWeekdayFromDate } from "@/lib/date";
import { calculateItemStreak } from "@/lib/streaks";
import { isUserAuthenticated } from "@/lib/auth";
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
}

export async function getTodayData(targetDate?: string) {
  const dateStr = targetDate || getTodayDateString();
  const weekday = getWeekdayFromDate(dateStr);

  // 1. Fetch active items ordered by sort_order
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

  // 3. Compute item data + streaks
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

  // 4. Fetch weekly tasks applicable to today's weekday
  const allWeekly = await db
    .select()
    .from(weeklyTasks)
    .where(eq(weeklyTasks.active, true))
    .orderBy(asc(weeklyTasks.id));

  // Filter tasks that run on this weekday (0=Sun..6=Sat)
  const dueWeeklyTasks = allWeekly.filter((t) => t.weekdays.includes(weekday));

  // Fetch weekly logs for today
  const wLogs = await db
    .select()
    .from(weeklyLogs)
    .where(eq(weeklyLogs.logDate, dateStr));

  const wLogMap = new Map(wLogs.map((l) => [l.taskId, l.done]));

  const weeklyToday: TodayWeeklyTaskData[] = dueWeeklyTasks.map((t) => ({
    id: t.id,
    name: t.name,
    reminderTime: t.reminderTime,
    done: wLogMap.get(t.id) === true,
  }));

  // 5. Fetch future reminders due today or overdue (and not done, or done today)
  // End of today in user's timezone or simple ISO comparison
  const endOfToday = new Date(`${dateStr}T23:59:59.999Z`);
  const startOfToday = new Date(`${dateStr}T00:00:00.000Z`);

  const reminders = await db
    .select()
    .from(futureReminders)
    .where(
      and(
        lte(futureReminders.dueAt, endOfToday),
        or(
          isNull(futureReminders.doneAt),
          and(sql`${futureReminders.doneAt} >= ${startOfToday}`, sql`${futureReminders.doneAt} <= ${endOfToday}`)
        )
      )
    )
    .orderBy(asc(futureReminders.dueAt));

  return {
    dateStr,
    checklistItems,
    dietItems,
    weeklyToday,
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
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  const dateStr = targetDate || getTodayDateString();

  // Check if exists
  const existing = await db
    .select()
    .from(weeklyLogs)
    .where(and(eq(weeklyLogs.taskId, taskId), eq(weeklyLogs.logDate, dateStr)))
    .limit(1);

  if (existing.length > 0) {
    const newDone = !existing[0].done;
    await db
      .update(weeklyLogs)
      .set({ done: newDone })
      .where(eq(weeklyLogs.id, existing[0].id));
    revalidatePath("/today");
    revalidatePath("/weekly");
    return { success: true, done: newDone };
  } else {
    await db.insert(weeklyLogs).values({
      taskId,
      logDate: dateStr,
      done: true,
    });
    revalidatePath("/today");
    revalidatePath("/weekly");
    return { success: true, done: true };
  }
}

export async function toggleFutureDone(reminderId: number) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  const existing = await db
    .select()
    .from(futureReminders)
    .where(eq(futureReminders.id, reminderId))
    .limit(1);

  if (existing.length === 0) throw new Error("Reminder not found");

  const newDoneAt = existing[0].doneAt ? null : new Date();

  await db
    .update(futureReminders)
    .set({ doneAt: newDoneAt })
    .where(eq(futureReminders.id, reminderId));

  revalidatePath("/today");
  revalidatePath("/future");
  return { success: true, done: !!newDoneAt };
}

