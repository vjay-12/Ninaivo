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

export type UpcomingType = "meeting" | "reminder" | "todo";
export type UpcomingRepeat = "daily" | "weekly" | "monthly" | null;
export type TimeFilter = "all" | "today" | "this_week" | "later" | "done";

export interface FormattedUpcomingItem {
  id: number;
  uuid?: string;
  title: string;
  type: UpcomingType;
  dueAt: string | null; // ISO or null
  endAt?: string | null;
  hasTime: boolean;
  repeat?: UpcomingRepeat;
  notes?: string | null;
  doneAt?: string | null;
  snoozedUntil?: string | null;
  createdAt: string;

  // Computed display helpers
  dateStr: string | null; // YYYY-MM-DD or null
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
  noDate: FormattedUpcomingItem[];
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

  // 1. Fetch active items
  const allUpcoming = await db
    .select()
    .from(upcomingItems)
    .where(isNull(upcomingItems.deletedAt))
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
    .where(and(gte(upcomingCompletions.completedAt, thirtyDaysAgo), isNull(upcomingCompletions.deletedAt)))
    .orderBy(desc(upcomingCompletions.completedAt));

  const itemsMap = new Map<number, UpcomingItem>();
  for (const item of allUpcoming) {
    itemsMap.set(item.id, item);
  }

  // Calculate Overdue threshold
  const tomorrowStr = addDaysToDate(todayStr, 1);
  const endOfWeekStr = addDaysToDate(todayStr, 7);

  const overdueList: FormattedUpcomingItem[] = [];
  const todayList: FormattedUpcomingItem[] = [];
  const tomorrowList: FormattedUpcomingItem[] = [];
  const thisWeekList: FormattedUpcomingItem[] = [];
  const laterList: FormattedUpcomingItem[] = [];
  const noDateList: FormattedUpcomingItem[] = [];
  const doneList: FormattedUpcomingItem[] = [];

  // Find nearest upcoming meeting today
  let nearestMeeting: { item: UpcomingItem; diffMin: number } | null = null;
  const nowTime = now.getTime();

  for (const item of allUpcoming) {
    if (item.doneAt) continue;
    if (item.snoozedUntil && new Date(item.snoozedUntil).getTime() > nowTime) continue;
    if (!item.dueAt) continue;

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
    const normType = (item.type as string) === "work" ? "todo" : (item.type as UpcomingType);

    // Apply type filter if user selected any types
    if (typeFilters.length > 0 && !typeFilters.includes(normType)) {
      continue;
    }

    // If completed non-repeating item
    if (item.doneAt) {
      if (new Date(item.doneAt).getTime() >= thirtyDaysAgo.getTime()) {
        const dateStr = item.dueAt ? getDateStringInTz(item.dueAt) : null;
        doneList.push(formatItem(item, dateStr, todayStr, true));
      }
      continue;
    }

    // If snoozed into the future, hide from active lists
    if (item.snoozedUntil && new Date(item.snoozedUntil).getTime() > nowTime) {
      continue;
    }

    // Items with NO DATE
    if (!item.dueAt) {
      const formatted = formatItem(item, null, todayStr, false);
      noDateList.push(formatted);
      continue;
    }

    const itemDateStr = getDateStringInTz(item.dueAt);
    const isPast = itemDateStr < todayStr;

    if (isPast) {
      totalOverdue++;
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

    const normParentType = (parent.type as string) === "work" ? "todo" : (parent.type as UpcomingType);
    if (typeFilters.length > 0 && !typeFilters.includes(normParentType)) {
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

  // Sort noDateList newest first
  noDateList.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return {
    overdue: overdueList,
    today: todayList,
    tomorrow: tomorrowList,
    thisWeek: thisWeekList,
    later: laterList,
    noDate: noDateList,
    done: doneList,
    totalOverdueCount: totalOverdue,
  };
}

function formatItem(
  item: UpcomingItem,
  dateStr: string | null,
  todayStr: string,
  isDone: boolean,
  nearestMeetingLabel?: string | null
): FormattedUpcomingItem {
  let timeDisplay = "";
  if (item.dueAt && item.hasTime) {
    if (item.type === "meeting") {
      timeDisplay = formatMeetingTimeRange(item.dueAt, item.endAt);
    } else {
      timeDisplay = formatDateTimeInTz(item.dueAt);
    }
  } else if (item.dueAt) {
    timeDisplay = "All day";
  } else {
    timeDisplay = "";
  }

  const isOverdue = !isDone && dateStr !== null && dateStr < todayStr;
  const isToday = dateStr === todayStr;

  let relativeLabel = "No date";
  if (isDone) {
    relativeLabel = "Completed";
  } else if (dateStr) {
    relativeLabel = getRelativeDateLabel(dateStr, todayStr);
  }

  const normType = (item.type as string) === "work" ? "todo" : (item.type as UpcomingType);

  return {
    id: item.id,
    uuid: item.uuid,
    title: item.title,
    type: normType,
    dueAt: item.dueAt ? new Date(item.dueAt).toISOString() : null,
    endAt: item.endAt ? new Date(item.endAt).toISOString() : null,
    hasTime: item.dueAt ? item.hasTime : false,
    repeat: item.dueAt ? (item.repeat as UpcomingRepeat) || null : null,
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
  dueAt: string | null; // ISO string or null
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
      uuid: crypto.randomUUID(),
      title: data.title.trim(),
      type: data.type,
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      endAt: data.dueAt && data.endAt ? new Date(data.endAt) : null,
      hasTime: data.dueAt ? data.hasTime : false,
      repeat: data.dueAt ? data.repeat || null : null,
      notes: data.notes?.trim() || null,
      updatedAt: new Date(),
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
    dueAt?: string | null;
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
      ...(data.dueAt !== undefined && {
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        endAt: data.dueAt && data.endAt ? new Date(data.endAt) : null,
        hasTime: data.dueAt ? data.hasTime ?? false : false,
        repeat: data.dueAt ? data.repeat ?? null : null,
      }),
      ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
      updatedAt: new Date(),
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

  // 1. Repeating Item (only if dueAt exists)
  if (item.repeat && item.dueAt) {
    const currentOccurrenceDate = getDateStringInTz(item.dueAt);

    // Record completion in upcoming_completions
    await db
      .insert(upcomingCompletions)
      .values({
        uuid: crypto.randomUUID(),
        itemId: item.id,
        occurrenceDate: currentOccurrenceDate,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    // Advance to next occurrence
    const nextDue = computeNextRecurrence(item.dueAt, item.repeat as any);

    let nextEnd: Date | null = null;
    if (item.endAt) {
      const durationMs = new Date(item.endAt).getTime() - new Date(item.dueAt).getTime();
      nextEnd = new Date(nextDue.getTime() + durationMs);
    }

    await db
      .update(upcomingItems)
      .set({
        dueAt: nextDue,
        endAt: nextEnd,
        snoozedUntil: null,
      })
      .where(eq(upcomingItems.id, id));

    revalidatePath("/upcoming");
    revalidatePath("/today");
    revalidatePath("/report");
    return { success: true, repeating: true, nextDate: nextDue.toISOString() };
  }

  // 2. Non-repeating Item (toggle doneAt)
  const isDone = !!item.doneAt;
  await db
    .update(upcomingItems)
    .set({
      doneAt: isDone ? null : new Date(),
      snoozedUntil: null,
    })
    .where(eq(upcomingItems.id, id));

  revalidatePath("/upcoming");
  revalidatePath("/today");
  revalidatePath("/report");
  return { success: true, repeating: false, done: !isDone };
}

export async function undoUpcomingCompletion(itemId: number, completionId?: number) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  if (completionId) {
    await db.delete(upcomingCompletions).where(eq(upcomingCompletions.id, completionId));
  } else {
    await db
      .update(upcomingItems)
      .set({ doneAt: null })
      .where(eq(upcomingItems.id, itemId));
  }

  revalidatePath("/upcoming");
  revalidatePath("/today");
  revalidatePath("/report");
  return { success: true };
}

export async function snoozeUpcomingItem(
  id: number,
  duration: "1h" | "tomorrow" | "next_week"
) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  const now = new Date();
  let snoozeTime = new Date();

  if (duration === "1h") {
    snoozeTime.setHours(snoozeTime.getHours() + 1);
  } else if (duration === "tomorrow") {
    snoozeTime.setDate(snoozeTime.getDate() + 1);
    snoozeTime.setHours(9, 0, 0, 0);
  } else if (duration === "next_week") {
    snoozeTime.setDate(snoozeTime.getDate() + 7);
    snoozeTime.setHours(9, 0, 0, 0);
  }

  await db
    .update(upcomingItems)
    .set({ snoozedUntil: snoozeTime })
    .where(eq(upcomingItems.id, id));

  revalidatePath("/upcoming");
  revalidatePath("/today");
  return { success: true, snoozedUntil: snoozeTime.toISOString() };
}

export async function deleteUpcomingItem(id: number) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  await db
    .update(upcomingItems)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(upcomingItems.id, id));

  revalidatePath("/upcoming");
  revalidatePath("/today");
  revalidatePath("/report");
  return { success: true };
}
