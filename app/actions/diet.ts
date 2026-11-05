"use server";

import { db } from "@/db";
import { items, foodItems, foodLogs, Item, FoodItem, FoodLog } from "@/db/schema";
import { eq, asc, desc, isNull, and, sql } from "drizzle-orm";
import { isUserAuthenticated } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getTodayDateString } from "@/lib/date";

export async function getDailyDietItems(): Promise<Item[]> {
  return await db
    .select()
    .from(items)
    .where(and(isNull(items.deletedAt), eq(items.type, "diet")))
    .orderBy(asc(items.sortOrder), asc(items.id));
}

export async function createDailyDietItem(data: {
  uuid?: string;
  name: string;
  targetCount: number;
  reminderTime?: string | null;
}) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  const all = await db
    .select({ sortOrder: items.sortOrder })
    .from(items)
    .where(and(isNull(items.deletedAt), eq(items.type, "diet")));
  const maxOrder = all.reduce((max, cur) => Math.max(max, cur.sortOrder), -1);

  const itemUuid = data.uuid || crypto.randomUUID();

  await db
    .insert(items)
    .values({
      uuid: itemUuid,
      name: data.name.trim(),
      type: "diet",
      targetCount: Math.max(1, data.targetCount || 1),
      reminderTime: data.reminderTime || null,
      sortOrder: maxOrder + 1,
      active: true,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: items.uuid,
      set: {
        name: data.name.trim(),
        targetCount: Math.max(1, data.targetCount || 1),
        reminderTime: data.reminderTime || null,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/diet");
  revalidatePath("/today");
  revalidatePath("/report");
  return { success: true };
}

export async function updateDailyDietItem(
  id: number,
  data: {
    name?: string;
    targetCount?: number;
    reminderTime?: string | null;
    active?: boolean;
    sortOrder?: number;
  }
) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  await db
    .update(items)
    .set({
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.targetCount !== undefined && { targetCount: Math.max(1, data.targetCount) }),
      ...(data.reminderTime !== undefined && { reminderTime: data.reminderTime || null }),
      ...(data.active !== undefined && { active: data.active }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      updatedAt: new Date(),
    })
    .where(eq(items.id, id));

  revalidatePath("/diet");
  revalidatePath("/today");
  revalidatePath("/report");
  return { success: true };
}

export async function deleteDailyDietItem(id: number) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  await db
    .update(items)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(items.id, id));

  revalidatePath("/diet");
  revalidatePath("/today");
  revalidatePath("/report");
  return { success: true };
}

export async function getFoodItems(): Promise<FoodItem[]> {
  return await db
    .select()
    .from(foodItems)
    .where(isNull(foodItems.deletedAt))
    .orderBy(asc(foodItems.name));
}

export async function createFoodItem(data: {
  uuid?: string;
  name: string;
  category: "fruit" | "protein" | "grain" | "snack" | "drink" | "other";
  note?: string | null;
}) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  const foodUuid = data.uuid || crypto.randomUUID();

  await db
    .insert(foodItems)
    .values({
      uuid: foodUuid,
      name: data.name.trim(),
      category: data.category,
      note: data.note?.trim() || null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: foodItems.uuid,
      set: {
        name: data.name.trim(),
        category: data.category,
        note: data.note?.trim() || null,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/diet");
  return { success: true };
}

export async function updateFoodItem(
  id: number,
  data: {
    name?: string;
    category?: "fruit" | "protein" | "grain" | "snack" | "drink" | "other";
    note?: string | null;
  }
) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  await db
    .update(foodItems)
    .set({
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.note !== undefined && { note: data.note?.trim() || null }),
      updatedAt: new Date(),
    })
    .where(eq(foodItems.id, id));

  revalidatePath("/diet");
  return { success: true };
}

export async function deleteFoodItem(id: number) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  await db
    .update(foodItems)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(foodItems.id, id));

  revalidatePath("/diet");
  return { success: true };
}

export async function logFoodToday(foodId: number, foodUuid?: string) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  const today = getTodayDateString();
  const now = new Date();

  // Check if already logged today
  const [existing] = await db
    .select()
    .from(foodLogs)
    .where(
      and(
        eq(foodLogs.foodId, foodId),
        eq(foodLogs.logDate, today),
        isNull(foodLogs.deletedAt)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(foodLogs)
      .set({
        count: existing.count + 1,
        updatedAt: now,
      })
      .where(eq(foodLogs.id, existing.id));
  } else {
    await db.insert(foodLogs).values({
      uuid: crypto.randomUUID(),
      foodId,
      foodUuid: foodUuid || null,
      logDate: today,
      count: 1,
      updatedAt: now,
    });
  }

  revalidatePath("/diet");
  revalidatePath("/today");
  revalidatePath("/report");
  return { success: true };
}

export async function promoteFoodToDaily(foodId: number) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  const [food] = await db
    .select()
    .from(foodItems)
    .where(eq(foodItems.id, foodId))
    .limit(1);

  if (!food) throw new Error("Food item not found");

  return await createDailyDietItem({
    name: food.name,
    targetCount: 1,
    reminderTime: null,
  });
}

export async function getTodayFoodLogsWithItems(): Promise<
  Array<FoodLog & { foodName: string; category: string }>
> {
  const today = getTodayDateString();
  const rows = await db
    .select({
      id: foodLogs.id,
      uuid: foodLogs.uuid,
      foodId: foodLogs.foodId,
      foodUuid: foodLogs.foodUuid,
      logDate: foodLogs.logDate,
      count: foodLogs.count,
      createdAt: foodLogs.createdAt,
      updatedAt: foodLogs.updatedAt,
      deletedAt: foodLogs.deletedAt,
      foodName: foodItems.name,
      category: foodItems.category,
    })
    .from(foodLogs)
    .innerJoin(foodItems, eq(foodLogs.foodId, foodItems.id))
    .where(
      and(
        eq(foodLogs.logDate, today),
        isNull(foodLogs.deletedAt),
        isNull(foodItems.deletedAt)
      )
    )
    .orderBy(desc(foodLogs.updatedAt));

  return rows as any;
}

