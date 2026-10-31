"use server";

import { db } from "@/db";
import { upcomingItems, upcomingCompletions, UpcomingItem, UpcomingCompletion } from "@/db/schema";
import { eq, and, desc, asc, lte, gte, isNull, or, sql } from "drizzle-orm";
import {
  getTodayDateString,
  getDateStringInTz,
  addDaysToDate,
  computeNextRecurrence,
  getRelativeDateLabel,
  formatDateTimeInTz,
  formatMeetingTimeRange,
} from "@/lib/date";
import { isUserAuthenticated } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type UpcomingType = "work" | "meeting" | "reminder" | "todo";
export type UpcomingRepeat = "daily" | "weekly" | "monthly" | null;
export type TimeFilter = "all" | "today" | "this_week" | "later" | "done";

export interface FormattedUpcomingItem {
  id: number;
  title: string;
  type: UpcomingType;
  dueAt: string; // ISO
  endAt?: string | null;
  hasTime: boolean;
  repeat?: UpcomingRepeat;
  notes?: string | null;
  doneAt?: string | null;
  snoozedUntil?: string | null;
  createdAt: string;

  // Computed display helpers
  dateStr: string; // YYYY-MM-DD
  relativeLabel: string;
  timeDisplay: string;
  isOverdue: boolean;
  isToday: boolean;
  isDone: boolean;
  nearestMeetingLabel?: string | null; // e.g. "Next, in 45 min"

  // For repeating completions
  completionId?: number;
}

export interface UpcomingGroupedData {
  overdue: FormattedUpcomingItem[];
  today: FormattedUpcomingItem[];
  tomorrow: FormattedUpcomingItem[];
  thisWeek: FormattedUpcomingItem[];
  later: FormattedUpcomingItem[];
  done: FormattedUpcomingItem[];
  totalOverdueCount: number;
}

export async function getUpcomingItems(
  timeFilter: TimeFilter = "all",
  typeFilters: UpcomingType[] = []
): Promise<UpcomingGroupedData> {
  const todayStr = getTodayDateString();
  const now = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // 1. Fetch active items (not done, or repeating items)
  const allUpcoming = await db
    .select()
    .from(upcomingItems)
    .orderBy(asc(upcomingItems.dueAt));

  // 2. Fetch completions from last 30 days for repeating items
  const recentCompletions = await db
    .select({
      id: upcomingCompletions.id,
      itemId: upcomingCompletions.itemId,
      occurrenceDate: upcomingCompletions.occurrenceDate,
      completedAt: upcomingCompletions.completedAt,
    })
    .from(upcomingCompletions)
    .where(gte(upcomingCompletions.completedAt, thirtyDaysAgo))
    .orderBy(desc(upcomingCompletions.completedAt));

  const itemsMap = new Map<number, UpcomingItem>();
  for (const item of allUpcoming) {
    itemsMap.set(item.id, item);
  }

  // Calculate Overdue threshold: items due before start of today in Asia/Kolkata
  const tomorrowStr = addDaysToDate(todayStr, 1);
  const endOfWeekStr = addDaysToDate(todayStr, 7);

  const overdueList: FormattedUpcomingItem[] = [];
  const todayList: FormattedUpcomingItem[] = [];
  const tomorrowList: FormattedUpcomingItem[] = [];
  const thisWeekList: FormattedUpcomingItem[] = [];
  const laterList: FormattedUpcomingItem[] = [];
  const doneList: FormattedUpcomingItem[] = [];

  // Find nearest upcoming meeting today
  let nearestMeeting: { item: UpcomingItem; diffMin: number } | null = null;
  const nowTime = now.getTime();

  for (const item of allUpcoming) {
    if (item.doneAt) continue;
    if (item.snoozedUntil && new Date(item.snoozedUntil).getTime() > nowTime) continue;

    const itemDateStr = getDateStringInTz(item.dueAt);
    if (itemDateStr === todayStr && item.type === "meeting" && item.hasTime) {
      const dueTime = new Date(item.dueAt).getTime();
      const endTime = item.endAt ? new Date(item.endAt).getTime() : dueTime + 30 * 60000;

      if (nowTime >= dueTime && nowTime <= endTime) {
        nearestMeeting = { item, diffMin: 0 }; // happening now
      } else if (dueTime > nowTime) {
        const diffMin = Math.round((dueTime - nowTime) / 60000);
        if (!nearestMeeting || (nearestMeeting.diffMin > 0 && diffMin < nearestMeeting.diffMin)) {
          nearestMeeting = { item, diffMin };
        }
      }
    }
  }

  // Count total overdue
  let totalOverdue = 0;

  for (const item of allUpcoming) {
    // If completed non-repeating item
    if (item.doneAt) {
      if (new Date(item.doneAt).getTime() >= thirtyDaysAgo.getTime()) {
        const dateStr = getDateStringInTz(item.dueAt);
        doneList.push(formatItem(item, dateStr, todayStr, true));
      }
      continue;
    }

    // If snoozed into the future, hide from active lists
    if (item.snoozedUntil && new Date(item.snoozedUntil).getTime() > nowTime) {
      continue;
    }

    const itemDateStr = getDateStringInTz(item.dueAt);
    const isPast = itemDateStr < todayStr;

    if (isPast) {
      totalOverdue++;
    }

    // Apply type filter if user selected any types
    if (typeFilters.length > 0 && !typeFilters.includes(item.type as UpcomingType)) {
      continue;
    }

    // Meeting label helper
    let meetingLabel: string | null = null;
    if (nearestMeeting && nearestMeeting.item.id === item.id) {
      if (nearestMeeting.diffMin === 0) {
        meetingLabel = "Happening now";
      } else if (nearestMeeting.diffMin < 60) {
        meetingLabel = `Next, in ${nearestMeeting.diffMin} min`;
      } else {
        const hours = Math.round(nearestMeeting.diffMin / 60);
        meetingLabel = `Next, in ~${hours}h`;
      }
    }

    const formatted = formatItem(item, itemDateStr, todayStr, false, meetingLabel);

    if (isPast) {
      overdueList.push(formatted);
    } else if (itemDateStr === todayStr) {
      todayList.push(formatted);
    } else if (itemDateStr === tomorrowStr) {
      tomorrowList.push(formatted);
    } else if (itemDateStr <= endOfWeekStr) {
      thisWeekList.push(formatted);
    } else {
      laterList.push(formatted);
    }
  }

  // Also add repeating completions into doneList
  for (const comp of recentCompletions) {
    const parent = itemsMap.get(comp.itemId);
    if (!parent) continue;

    if (typeFilters.length > 0 && !typeFilters.includes(parent.type as UpcomingType)) {
      continue;
    }

    doneList.push({
      ...formatItem(parent, comp.occurrenceDate, todayStr, true),
      completionId: comp.id,
      dateStr: comp.occurrenceDate,
      dueAt: new Date(comp.completedAt).toISOString(),
      doneAt: new Date(comp.completedAt).toISOString(),
    });
  }

  return {
    overdue: overdueList,
    today: todayList,
    tomorrow: tomorrowList,
    thisWeek: thisWeekList,
    later: laterList,
    done: doneList,
    totalOverdueCount: totalOverdue,
  };
}

function formatItem(
  item: UpcomingItem,
  dateStr: string,
  todayStr: string,
  isDone: boolean,
  nearestMeetingLabel?: string | null
): FormattedUpcomingItem {
  let timeDisplay = "";
  if (item.hasTime) {
    if (item.type === "meeting") {
      timeDisplay = formatMeetingTimeRange(item.dueAt, item.endAt);
    } else {
      timeDisplay = formatDateTimeInTz(item.dueAt);
    }
  } else {
    timeDisplay = "All day";
  }

  const relativeLabel = isDone ? "Completed" : getRelativeDateLabel(dateStr, todayStr);
  const isOverdue = !isDone && dateStr < todayStr;
  const isToday = dateStr === todayStr;

  return {
    id: item.id,
    title: item.title,
    type: item.type as UpcomingType,
    dueAt: new Date(item.dueAt).toISOString(),
    endAt: item.endAt ? new Date(item.endAt).toISOString() : null,
    hasTime: item.hasTime,
    repeat: (item.repeat as UpcomingRepeat) || null,
    notes: item.notes,
    doneAt: item.doneAt ? new Date(item.doneAt).toISOString() : null,
    snoozedUntil: item.snoozedUntil ? new Date(item.snoozedUntil).toISOString() : null,
    createdAt: new Date(item.createdAt).toISOString(),
    dateStr,
    relativeLabel,
    timeDisplay,
    isOverdue,
    isToday,
    isDone,
    nearestMeetingLabel,
  };
}

export async function createUpcomingItem(data: {
  title: string;
  type: UpcomingType;
  dueAt: string; // ISO string
  endAt?: string | null;
  hasTime: boolean;
  repeat?: UpcomingRepeat;
  notes?: string | null;
}) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  const [inserted] = await db
    .insert(upcomingItems)
    .values({
      title: data.title.trim(),
      type: data.type,
      dueAt: new Date(data.dueAt),
      endAt: data.endAt ? new Date(data.endAt) : null,
      hasTime: data.hasTime,
      repeat: data.repeat || null,
      notes: data.notes?.trim() || null,
    })
    .returning();

  revalidatePath("/upcoming");
  revalidatePath("/today");
  return { success: true, item: inserted };
}

export async function updateUpcomingItem(
  id: number,
  data: {
    title?: string;
    type?: UpcomingType;
    dueAt?: string;
    endAt?: string | null;
    hasTime?: boolean;
    repeat?: UpcomingRepeat;
    notes?: string | null;
  }
) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  await db
    .update(upcomingItems)
    .set({
      ...(data.title !== undefined && { title: data.title.trim() }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.dueAt !== undefined && { dueAt: new Date(data.dueAt) }),
      ...(data.endAt !== undefined && { endAt: data.endAt ? new Date(data.endAt) : null }),
      ...(data.hasTime !== undefined && { hasTime: data.hasTime }),
      ...(data.repeat !== undefined && { repeat: data.repeat || null }),
      ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
    })
    .where(eq(upcomingItems.id, id));

  revalidatePath("/upcoming");
  revalidatePath("/today");
  return { success: true };
}

export async function toggleUpcomingDone(id: number) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  const [item] = await db
    .select()
    .from(upcomingItems)
    .where(eq(upcomingItems.id, id))
    .limit(1);

  if (!item) throw new Error("Item not found");

  const todayStr = getTodayDateString();

  // 1. Repeating Item
  if (item.repeat) {
    const currentOccurrenceDate = getDateStringInTz(item.dueAt);

    // Record completion in upcoming_completions
    await db
      .insert(upcomingCompletions)
      .values({
        itemId: item.id,
        occurrenceDate: currentOccurrenceDate,
        completedAt: new Date(),
      })
      .onConflictDoNothing();

    // Advance due_at to next occurrence
    const nextDue = computeNextRecurrence(item.dueAt, item.repeat);
    let nextEnd: Date | null = null;
    if (item.endAt) {
      const diff = new Date(item.endAt).getTime() - new Date(item.dueAt).getTime();
      nextEnd = new Date(nextDue.getTime() + diff);
    }

    await db
      .update(upcomingItems)
      .set({
        dueAt: nextDue,
        endAt: nextEnd,
        snoozedUntil: null,
      })
      .where(eq(upcomingItems.id, item.id));

    revalidatePath("/upcoming");
    revalidatePath("/today");
    return { success: true, repeating: true, nextDue: nextDue.toISOString() };
  }

  // 2. Non-repeating Item
  const newDoneAt = item.doneAt ? null : new Date();

  await db
    .update(upcomingItems)
    .set({
      doneAt: newDoneAt,
      snoozedUntil: null,
    })
    .where(eq(upcomingItems.id, id));

  revalidatePath("/upcoming");
  revalidatePath("/today");
  return { success: true, repeating: false, done: !!newDoneAt };
}

export async function undoUpcomingCompletion(itemId: number, completionId?: number) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  if (completionId) {
    // Delete occurrence from completions
    const [comp] = await db
      .select()
      .from(upcomingCompletions)
      .where(eq(upcomingCompletions.id, completionId))
      .limit(1);

    if (comp) {
      await db.delete(upcomingCompletions).where(eq(upcomingCompletions.id, completionId));
      // Optionally move item's due_at back to that occurrence date
      const [item] = await db.select().from(upcomingItems).where(eq(upcomingItems.id, comp.itemId)).limit(1);
      if (item && item.repeat) {
        const timePart = formatDateTimeInTz(item.dueAt);
        const [y, m, d] = comp.occurrenceDate.split("-").map(Number);
        const rolledBackDate = new Date(item.dueAt);
        rolledBackDate.setFullYear(y, m - 1, d);
        await db.update(upcomingItems).set({ dueAt: rolledBackDate }).where(eq(upcomingItems.id, item.id));
      }
    }
  } else {
    // Unmark doneAt on non-repeating item
    await db.update(upcomingItems).set({ doneAt: null }).where(eq(upcomingItems.id, itemId));
  }

  revalidatePath("/upcoming");
  revalidatePath("/today");
  return { success: true };
}

export async function snoozeUpcomingItem(id: number, option: "1hour" | "tomorrow" | "next_week") {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  const now = new Date();
  let snoozeUntil = new Date();

  if (option === "1hour") {
    snoozeUntil.setHours(snoozeUntil.getHours() + 1);
  } else if (option === "tomorrow") {
    snoozeUntil.setDate(snoozeUntil.getDate() + 1);
    snoozeUntil.setHours(9, 0, 0, 0); // 9:00 AM tomorrow
  } else if (option === "next_week") {
    snoozeUntil.setDate(snoozeUntil.getDate() + 7);
    snoozeUntil.setHours(9, 0, 0, 0); // 9:00 AM next week
  }

  await db
    .update(upcomingItems)
    .set({ snoozedUntil: snoozeUntil })
    .where(eq(upcomingItems.id, id));

  revalidatePath("/upcoming");
  revalidatePath("/today");
  return { success: true, snoozedUntil: snoozeUntil.toISOString() };
}

export async function deleteUpcomingItem(id: number) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  await db.delete(upcomingItems).where(eq(upcomingItems.id, id));

  revalidatePath("/upcoming");
  revalidatePath("/today");
  return { success: true };
}

