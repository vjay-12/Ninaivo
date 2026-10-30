"use server";

import { db } from "@/db";
import { futureReminders, FutureReminder } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { getTodayDateString } from "@/lib/date";
import { isUserAuthenticated } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface FutureGroupsData {
  overdue: FutureReminder[];
  today: FutureReminder[];
  upcoming: FutureReminder[];
  done: FutureReminder[];
}

export async function getFutureRemindersGrouped(): Promise<FutureGroupsData> {
  const all = await db
    .select()
    .from(futureReminders)
    .orderBy(asc(futureReminders.dueAt));

  const todayStr = getTodayDateString();
  const startOfToday = new Date(`${todayStr}T00:00:00.000Z`).getTime();
  const endOfToday = new Date(`${todayStr}T23:59:59.999Z`).getTime();

  const overdue: FutureReminder[] = [];
  const today: FutureReminder[] = [];
  const upcoming: FutureReminder[] = [];
  const done: FutureReminder[] = [];

  for (const item of all) {
    if (item.doneAt) {
      done.push(item);
    } else {
      const dueTime = new Date(item.dueAt).getTime();
      if (dueTime < startOfToday) {
        overdue.push(item);
      } else if (dueTime <= endOfToday) {
        today.push(item);
      } else {
        upcoming.push(item);
      }
    }
  }

  // Done sorted recent first
  done.sort((a, b) => new Date(b.doneAt!).getTime() - new Date(a.doneAt!).getTime());

  return { overdue, today, upcoming, done };
}

export async function createFutureReminder(data: {
  title: string;
  notes?: string;
  dueAt: string; // ISO string
}) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  await db.insert(futureReminders).values({
    title: data.title.trim(),
    notes: data.notes?.trim() || null,
    dueAt: new Date(data.dueAt),
  });

  revalidatePath("/future");
  revalidatePath("/today");
  return { success: true };
}

export async function updateFutureReminder(
  id: number,
  data: {
    title?: string;
    notes?: string;
    dueAt?: string;
    doneAt?: string | null;
  }
) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  await db
    .update(futureReminders)
    .set({
      ...(data.title !== undefined && { title: data.title.trim() }),
      ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
      ...(data.dueAt !== undefined && { dueAt: new Date(data.dueAt) }),
      ...(data.doneAt !== undefined && { doneAt: data.doneAt ? new Date(data.doneAt) : null }),
    })
    .where(eq(futureReminders.id, id));

  revalidatePath("/future");
  revalidatePath("/today");
  return { success: true };
}

export async function toggleFutureDoneAction(id: number) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  const [existing] = await db
    .select()
    .from(futureReminders)
    .where(eq(futureReminders.id, id))
    .limit(1);

  if (!existing) throw new Error("Not found");

  const newDoneAt = existing.doneAt ? null : new Date();

  await db
    .update(futureReminders)
    .set({ doneAt: newDoneAt })
    .where(eq(futureReminders.id, id));

  revalidatePath("/future");
  revalidatePath("/today");
  return { success: true, done: !!newDoneAt };
}

export async function deleteFutureReminder(id: number) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  await db.delete(futureReminders).where(eq(futureReminders.id, id));

  revalidatePath("/future");
  revalidatePath("/today");
  return { success: true };
}

