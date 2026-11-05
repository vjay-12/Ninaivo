"use server";

import { db } from "@/db";
import { items, upcomingItems, settings } from "@/db/schema";
import { eq, isNotNull, desc, and, sql } from "drizzle-orm";
import { isUserAuthenticated } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface RecycleBinItem {
  id: number;
  uuid: string;
  sourceTable: "items" | "upcoming_items" | "food_items";
  typeLabel: string;
  name: string;
  deletedAt: string;
  daysAgo: number;
  relativeTime: string;
  metadata?: {
    dueAt?: string | null;
    type?: string;
    targetCount?: number;
    category?: string | null;
  };
}

function formatDaysAgo(deletedAt: Date, now: Date = new Date()): { daysAgo: number; relativeTime: string } {
  const diffMs = now.getTime() - deletedAt.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (diffDays === 0) {
    return { daysAgo: 0, relativeTime: "Today" };
  } else if (diffDays === 1) {
    return { daysAgo: 1, relativeTime: "1 day ago" };
  } else {
    return { daysAgo: diffDays, relativeTime: `${diffDays} days ago` };
  }
}

export async function getRecycleBinItems(): Promise<RecycleBinItem[]> {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  const now = new Date();

  // 1. Fetch soft-deleted habit items (checklist & diet)
  const deletedItems = await db
    .select()
    .from(items)
    .where(isNotNull(items.deletedAt))
    .orderBy(desc(items.deletedAt));

  // 2. Fetch soft-deleted upcoming items
  const deletedUpcoming = await db
    .select()
    .from(upcomingItems)
    .where(isNotNull(upcomingItems.deletedAt))
    .orderBy(desc(upcomingItems.deletedAt));

  // Combine and format
  const list: RecycleBinItem[] = [];

  for (const item of deletedItems) {
    if (!item.deletedAt) continue;
    const { daysAgo, relativeTime } = formatDaysAgo(new Date(item.deletedAt), now);
    list.push({
      id: item.id,
      uuid: item.uuid,
      sourceTable: "items",
      typeLabel: item.type === "diet" ? "Daily diet" : "Daily checklist",
      name: item.name,
      deletedAt: new Date(item.deletedAt).toISOString(),
      daysAgo,
      relativeTime,
      metadata: {
        type: item.type,
        targetCount: item.targetCount,
      },
    });
  }

  for (const up of deletedUpcoming) {
    if (!up.deletedAt) continue;
    const { daysAgo, relativeTime } = formatDaysAgo(new Date(up.deletedAt), now);
    list.push({
      id: up.id,
      uuid: up.uuid,
      sourceTable: "upcoming_items",
      typeLabel: `Upcoming (${up.type})`,
      name: up.title,
      deletedAt: new Date(up.deletedAt).toISOString(),
      daysAgo,
      relativeTime,
      metadata: {
        dueAt: up.dueAt ? new Date(up.dueAt).toISOString() : null,
        type: up.type,
      },
    });
  }

  // Sort by deletedAt descending (newest deletion first)
  list.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

  return list;
}

export async function getRecycleBinCount(): Promise<number> {
  const auth = await isUserAuthenticated();
  if (!auth) return 0;

  const [itemsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(items)
    .where(isNotNull(items.deletedAt));

  const [upcomingCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(upcomingItems)
    .where(isNotNull(upcomingItems.deletedAt));

  return (itemsCount?.count || 0) + (upcomingCount?.count || 0);
}

export async function restoreBinItem(
  sourceTable: "items" | "upcoming_items" | "food_items",
  id: number
) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  const now = new Date();

  if (sourceTable === "items") {
    await db
      .update(items)
      .set({ deletedAt: null, updatedAt: now })
      .where(eq(items.id, id));
  } else if (sourceTable === "upcoming_items") {
    await db
      .update(upcomingItems)
      .set({ deletedAt: null, updatedAt: now })
      .where(eq(upcomingItems.id, id));
  }

  revalidatePath("/upcoming");
  revalidatePath("/daily");
  revalidatePath("/diet");
  revalidatePath("/today");
  revalidatePath("/settings");
  revalidatePath("/report");

  return { success: true };
}

export async function restoreAllBinItems() {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  const now = new Date();

  await db
    .update(items)
    .set({ deletedAt: null, updatedAt: now })
    .where(isNotNull(items.deletedAt));

  await db
    .update(upcomingItems)
    .set({ deletedAt: null, updatedAt: now })
    .where(isNotNull(upcomingItems.deletedAt));

  revalidatePath("/upcoming");
  revalidatePath("/daily");
  revalidatePath("/diet");
  revalidatePath("/today");
  revalidatePath("/settings");
  revalidatePath("/report");

  return { success: true };
}

export async function permanentDeleteBinItem(
  sourceTable: "items" | "upcoming_items" | "food_items",
  id: number
) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  if (sourceTable === "items") {
    await db.delete(items).where(eq(items.id, id));
  } else if (sourceTable === "upcoming_items") {
    await db.delete(upcomingItems).where(eq(upcomingItems.id, id));
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function emptyBin() {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  await db.delete(items).where(isNotNull(items.deletedAt));
  await db.delete(upcomingItems).where(isNotNull(upcomingItems.deletedAt));

  revalidatePath("/settings");
  return { success: true };
}

export async function setAutoCleanSetting(days: "off" | "30" | "90") {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  const now = new Date();
  await db
    .insert(settings)
    .values({
      key: "auto_clean_bin",
      uuid: "setting-auto-clean-bin",
      value: days,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: days,
        updatedAt: now,
      },
    });

  revalidatePath("/settings");
  return { success: true };
}

