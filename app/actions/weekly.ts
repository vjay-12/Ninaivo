"use server";

import { db } from "@/db";
import { weeklyTasks, weeklyLogs } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getTodayDateString, getWeekdayFromDate, getWeekDays } from "@/lib/date";
import { isUserAuthenticated } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface WeeklyDayData {
  date: string;
  dayShort: string;
  dayNum: number;
  weekday: number;
  isToday: boolean;
  hasTasks: boolean;
}

export async function getWeeklyViewData(selectedDateStr?: string) {
  const today = getTodayDateString();
  const selectedDate = selectedDateStr || today;
  const weekDays = getWeekDays(selectedDate);

  // Fetch all active weekly tasks
  const tasks = await db
    .select()
    .from(weeklyTasks)
    .where(eq(weeklyTasks.active, true))
    .orderBy(asc(weeklyTasks.id));

  // Determine which days in the week have tasks
  const weekDaysWithTasks: WeeklyDayData[] = weekDays.map((d) => ({
    ...d,
    hasTasks: tasks.some((t) => t.weekdays.includes(d.weekday)),
  }));

  // Selected date weekday
  const selWeekday = getWeekdayFromDate(selectedDate);
  const tasksForSelectedDay = tasks.filter((t) => t.weekdays.includes(selWeekday));

  // Fetch logs for the selected date
  const logs = await db
    .select()
    .from(weeklyLogs)
    .where(eq(weeklyLogs.logDate, selectedDate));

  const logMap = new Map(logs.map((l) => [l.taskId, l.done]));

  const taskItems = tasksForSelectedDay.map((t) => ({
    ...t,
    done: logMap.get(t.id) === true,
  }));

  // Also fetch all weekly tasks for management list
  const allWeeklyTasks = await db
    .select()
    .from(weeklyTasks)
    .orderBy(asc(weeklyTasks.id));

  return {
    selectedDate,
    today,
    weekDays: weekDaysWithTasks,
    tasksForSelectedDay: taskItems,
    allWeeklyTasks,
  };
}

export async function toggleWeeklyTaskForDate(taskId: number, dateStr: string) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  const existing = await db
    .select()
    .from(weeklyLogs)
    .where(and(eq(weeklyLogs.taskId, taskId), eq(weeklyLogs.logDate, dateStr)))
    .limit(1);

  if (existing.length > 0) {
    const nextDone = !existing[0].done;
    await db
      .update(weeklyLogs)
      .set({ done: nextDone })
      .where(eq(weeklyLogs.id, existing[0].id));
  } else {
    await db.insert(weeklyLogs).values({
      taskId,
      logDate: dateStr,
      done: true,
    });
  }

  revalidatePath("/weekly");
  revalidatePath("/today");
  return { success: true };
}

export async function createWeeklyTask(data: {
  name: string;
  weekdays: number[];
  reminderTime?: string | null;
}) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  await db.insert(weeklyTasks).values({
    name: data.name.trim(),
    weekdays: data.weekdays,
    reminderTime: data.reminderTime || null,
    active: true,
  });

  revalidatePath("/weekly");
  revalidatePath("/today");
  return { success: true };
}

export async function updateWeeklyTask(
  id: number,
  data: {
    name?: string;
    weekdays?: number[];
    reminderTime?: string | null;
    active?: boolean;
  }
) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  await db
    .update(weeklyTasks)
    .set({
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.weekdays !== undefined && { weekdays: data.weekdays }),
      ...(data.reminderTime !== undefined && { reminderTime: data.reminderTime || null }),
      ...(data.active !== undefined && { active: data.active }),
    })
    .where(eq(weeklyTasks.id, id));

  revalidatePath("/weekly");
  revalidatePath("/today");
  return { success: true };
}

export async function deleteWeeklyTask(id: number) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  await db.delete(weeklyTasks).where(eq(weeklyTasks.id, id));

  revalidatePath("/weekly");
  revalidatePath("/today");
  return { success: true };
}

