import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  items,
  dailyLogs,
  upcomingItems,
  upcomingCompletions,
  settings,
} from "@/db/schema";
import { isUserAuthenticated } from "@/lib/auth";
import { eq, and, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface OutboxPushItem {
  id: number;
  uuid: string;
  table: "items" | "daily_logs" | "upcoming_items" | "upcoming_completions" | "settings";
  action: "insert" | "update" | "delete";
  record: any;
  timestamp: number;
}

export async function POST(req: Request) {
  const auth = await isUserAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { outbox: OutboxPushItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { outbox } = body;
  if (!Array.isArray(outbox)) {
    return NextResponse.json({ error: "outbox must be an array" }, { status: 400 });
  }

  const processedIds: number[] = [];
  const now = new Date();

  try {
    await db.transaction(async (tx) => {
      for (const entry of outbox) {
        const { id, uuid, table, action, record } = entry;
        if (!uuid || !table) continue;

        const recordUpdatedAt = record.updatedAt ? new Date(record.updatedAt) : now;
        const isDelete = action === "delete" || !!record.deletedAt;
        const deletedAtVal = isDelete ? (record.deletedAt ? new Date(record.deletedAt) : now) : null;

        if (table === "items") {
          const [existing] = await tx
            .select()
            .from(items)
            .where(eq(items.uuid, uuid))
            .limit(1);

          if (existing) {
            // Last-write-wins
            if (recordUpdatedAt >= existing.updatedAt) {
              await tx
                .update(items)
                .set({
                  name: record.name ?? existing.name,
                  type: record.type ?? existing.type,
                  targetCount: record.targetCount ?? existing.targetCount,
                  reminderTime: record.reminderTime ?? existing.reminderTime,
                  sortOrder: record.sortOrder ?? existing.sortOrder,
                  active: record.active ?? existing.active,
                  updatedAt: recordUpdatedAt,
                  deletedAt: deletedAtVal,
                })
                .where(eq(items.uuid, uuid));
            }
          } else if (!isDelete) {
            await tx.insert(items).values({
              uuid,
              name: record.name,
              type: record.type,
              targetCount: record.targetCount ?? 1,
              reminderTime: record.reminderTime || null,
              sortOrder: record.sortOrder ?? 0,
              active: record.active ?? true,
              createdAt: record.createdAt ? new Date(record.createdAt) : now,
              updatedAt: recordUpdatedAt,
              deletedAt: null,
            });
          }
        } else if (table === "daily_logs") {
          // Resolve item_id if needed
          let resolvedItemId = record.itemId;
          if (!resolvedItemId && record.itemUuid) {
            const [parentItem] = await tx
              .select({ id: items.id })
              .from(items)
              .where(eq(items.uuid, record.itemUuid))
              .limit(1);
            if (parentItem) resolvedItemId = parentItem.id;
          }

          if (resolvedItemId) {
            const [existing] = await tx
              .select()
              .from(dailyLogs)
              .where(eq(dailyLogs.uuid, uuid))
              .limit(1);

            if (existing) {
              if (recordUpdatedAt >= existing.updatedAt) {
                await tx
                  .update(dailyLogs)
                  .set({
                    count: record.count ?? existing.count,
                    done: record.done ?? existing.done,
                    updatedAt: recordUpdatedAt,
                    deletedAt: deletedAtVal,
                  })
                  .where(eq(dailyLogs.uuid, uuid));
              }
            } else if (!isDelete) {
              await tx
                .insert(dailyLogs)
                .values({
                  uuid,
                  itemId: resolvedItemId,
                  itemUuid: record.itemUuid || null,
                  logDate: record.logDate,
                  count: record.count ?? 0,
                  done: record.done ?? false,
                  updatedAt: recordUpdatedAt,
                  deletedAt: null,
                })
                .onConflictDoUpdate({
                  target: [dailyLogs.itemId, dailyLogs.logDate],
                  set: {
                    count: record.count ?? 0,
                    done: record.done ?? false,
                    updatedAt: recordUpdatedAt,
                    deletedAt: null,
                  },
                });
            }
          }
        } else if (table === "upcoming_items") {
          const [existing] = await tx
            .select()
            .from(upcomingItems)
            .where(eq(upcomingItems.uuid, uuid))
            .limit(1);

          const dueAtVal = record.dueAt ? new Date(record.dueAt) : null;
          const endAtVal = record.endAt ? new Date(record.endAt) : null;
          const doneAtVal = record.doneAt ? new Date(record.doneAt) : null;
          const snoozedUntilVal = record.snoozedUntil ? new Date(record.snoozedUntil) : null;

          if (existing) {
            if (recordUpdatedAt >= existing.updatedAt) {
              await tx
                .update(upcomingItems)
                .set({
                  title: record.title ?? existing.title,
                  type: record.type ?? existing.type,
                  dueAt: dueAtVal,
                  endAt: endAtVal,
                  hasTime: record.hasTime ?? existing.hasTime,
                  repeat: record.repeat ?? existing.repeat,
                  notes: record.notes ?? existing.notes,
                  doneAt: doneAtVal,
                  snoozedUntil: snoozedUntilVal,
                  updatedAt: recordUpdatedAt,
                  deletedAt: deletedAtVal,
                })
                .where(eq(upcomingItems.uuid, uuid));
            }
          } else if (!isDelete) {
            await tx.insert(upcomingItems).values({
              uuid,
              title: record.title,
              type: record.type === "work" ? "todo" : (record.type ?? "todo"),
              dueAt: dueAtVal,
              endAt: endAtVal,
              hasTime: record.hasTime ?? true,
              repeat: record.repeat || null,
              notes: record.notes || null,
              doneAt: doneAtVal,
              snoozedUntil: snoozedUntilVal,
              createdAt: record.createdAt ? new Date(record.createdAt) : now,
              updatedAt: recordUpdatedAt,
              deletedAt: null,
            });
          }
        } else if (table === "upcoming_completions") {
          let resolvedItemId = record.itemId;
          if (!resolvedItemId && record.itemUuid) {
            const [parentItem] = await tx
              .select({ id: upcomingItems.id })
              .from(upcomingItems)
              .where(eq(upcomingItems.uuid, record.itemUuid))
              .limit(1);
            if (parentItem) resolvedItemId = parentItem.id;
          }

          if (resolvedItemId) {
            const [existing] = await tx
              .select()
              .from(upcomingCompletions)
              .where(eq(upcomingCompletions.uuid, uuid))
              .limit(1);

            if (existing) {
              if (recordUpdatedAt >= existing.updatedAt) {
                await tx
                  .update(upcomingCompletions)
                  .set({
                    occurrenceDate: record.occurrenceDate ?? existing.occurrenceDate,
                    completedAt: record.completedAt ? new Date(record.completedAt) : existing.completedAt,
                    updatedAt: recordUpdatedAt,
                    deletedAt: deletedAtVal,
                  })
                  .where(eq(upcomingCompletions.uuid, uuid));
              }
            } else if (!isDelete) {
              await tx
                .insert(upcomingCompletions)
                .values({
                  uuid,
                  itemId: resolvedItemId,
                  itemUuid: record.itemUuid || null,
                  occurrenceDate: record.occurrenceDate,
                  completedAt: record.completedAt ? new Date(record.completedAt) : now,
                  updatedAt: recordUpdatedAt,
                  deletedAt: null,
                })
                .onConflictDoUpdate({
                  target: [upcomingCompletions.itemId, upcomingCompletions.occurrenceDate],
                  set: {
                    completedAt: record.completedAt ? new Date(record.completedAt) : now,
                    updatedAt: recordUpdatedAt,
                    deletedAt: null,
                  },
                });
            }
          }
        } else if (table === "settings") {
          const key = record.key;
          if (key) {
            await tx
              .insert(settings)
              .values({
                key,
                uuid,
                value: record.value,
                updatedAt: recordUpdatedAt,
                deletedAt: deletedAtVal,
              })
              .onConflictDoUpdate({
                target: settings.key,
                set: {
                  value: record.value,
                  updatedAt: recordUpdatedAt,
                  deletedAt: deletedAtVal,
                },
              });
          }
        }

        processedIds.push(id);
      }
    });

    return NextResponse.json({
      success: true,
      processedIds,
      serverCursor: now.toISOString(),
    });
  } catch (err: any) {
    console.error("[Sync Push Error]:", err?.message || err);
    return NextResponse.json(
      { error: `Sync push failed: ${err?.message || "Internal database error"}` },
      { status: 500 }
    );
  }
}
