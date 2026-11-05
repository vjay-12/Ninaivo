"use server";

import { db } from "@/db";
import { items } from "@/db/schema";
import { eq, asc, isNull, and } from "drizzle-orm";
import { isUserAuthenticated } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getDailyItems() {
  return await db
    .select()
    .from(items)
    .where(and(isNull(items.deletedAt), eq(items.type, "checklist")))
    .orderBy(asc(items.sortOrder), asc(items.id));
}

export async function createItem(data: {
  uuid?: string;
  name: string;
  type: "checklist" | "diet";
  targetCount: number;
  reminderTime?: string | null;
}) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  // find highest sortOrder
  const all = await db
    .select({ sortOrder: items.sortOrder })
    .from(items)
    .where(isNull(items.deletedAt));
  const maxOrder = all.reduce((max, cur) => Math.max(max, cur.sortOrder), -1);

  const itemUuid = data.uuid || crypto.randomUUID();

  await db
    .insert(items)
    .values({
      uuid: itemUuid,
      name: data.name.trim(),
      type: data.type,
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
        type: data.type,
        targetCount: Math.max(1, data.targetCount || 1),
        reminderTime: data.reminderTime || null,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/daily");
  revalidatePath("/today");
  return { success: true };
}

export async function updateItem(
  id: number,
  data: {
    name?: string;
    type?: "checklist" | "diet";
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
      ...(data.type !== undefined && { type: data.type }),
      ...(data.targetCount !== undefined && { targetCount: Math.max(1, data.targetCount) }),
      ...(data.reminderTime !== undefined && { reminderTime: data.reminderTime || null }),
      ...(data.active !== undefined && { active: data.active }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      updatedAt: new Date(),
    })
    .where(eq(items.id, id));

  revalidatePath("/daily");
  revalidatePath("/today");
  return { success: true };
}

export async function deleteItem(id: number) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  await db
    .update(items)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(items.id, id));

  revalidatePath("/daily");
  revalidatePath("/today");
  return { success: true };
}

export async function reorderItems(orderedIds: number[]) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  for (let index = 0; index < orderedIds.length; index++) {
    await db
      .update(items)
      .set({ sortOrder: index })
      .where(eq(items.id, orderedIds[index]));
  }

  revalidatePath("/daily");
  revalidatePath("/today");
  return { success: true };
}

