"use server";

import { db } from "@/db";
import { items, dailyLogs, upcomingItems, upcomingCompletions, settings } from "@/db/schema";
import { isUserAuthenticated } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { BackupPayloadSchema, type BackupPayload } from "@/lib/backup-schema";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface BackupPreviewResult {
  success: boolean;
  error?: string;
  preview?: {
    app: string;
    version: number;
    exportedAt: string;
    timezone: string;
    counts: {
      items: number;
      dailyLogs: number;
      upcoming: number;
      completions: number;
    };
    comparison: {
      items: { new: number; existing: number };
      dailyLogs: { new: number; existing: number };
      upcoming: { new: number; existing: number };
      completions: { new: number; existing: number };
    };
  };
}

export interface RestoreResult {
  success: boolean;
  error?: string;
  counts?: {
    items: number;
    dailyLogs: number;
    upcoming: number;
    completions?: number;
  };
}

/**
 * Validates backup JSON, checks referential integrity, and generates a pre-restore preview
 */
export async function previewBackup(rawJson: unknown): Promise<BackupPreviewResult> {
  const auth = await isUserAuthenticated();
  if (!auth) {
    return { success: false, error: "Unauthorized. Please log in first." };
  }

  // Rate limiting (max 20 previews/min)
  const { success: rateOk } = checkRateLimit("backup-preview", 20, 60000);
  if (!rateOk) {
    return { success: false, error: "Too many requests. Please wait a moment." };
  }

  // 1. Zod schema validation
  const parseResult = BackupPayloadSchema.safeParse(rawJson);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0];
    const pathStr = firstIssue.path.length > 0 ? ` at '${firstIssue.path.join(".")}'` : "";
    return {
      success: false,
      error: `Validation error${pathStr}: ${firstIssue.message}`,
    };
  }

  const payload: BackupPayload = parseResult.data;
  const { items: bItems, dailyLogs: bLogs, upcoming: bUpcoming, completions: bCompletions } = payload.data;

  // 2. Referential integrity check
  const fileItemIds = new Set(
    bItems.map((i) => i.id).filter((id): id is number => typeof id === "number")
  );
  const currentDbItems = await db
    .select({ id: items.id, name: items.name, type: items.type })
    .from(items);
  const validItemIds = new Set(fileItemIds);
  currentDbItems.forEach((i) => validItemIds.add(i.id));

  for (const log of bLogs) {
    if (!validItemIds.has(log.itemId)) {
      return {
        success: false,
        error: `Inconsistent backup: Daily log for ${log.logDate} references item ID ${log.itemId}, which does not exist in the backup or database.`,
      };
    }
  }

  const fileUpcomingIds = new Set(
    bUpcoming.map((u) => u.id).filter((id): id is number => typeof id === "number")
  );
  const currentDbUpcoming = await db
    .select({ id: upcomingItems.id, title: upcomingItems.title })
    .from(upcomingItems);
  const validUpcomingIds = new Set(fileUpcomingIds);
  currentDbUpcoming.forEach((u) => validUpcomingIds.add(u.id));

  for (const comp of bCompletions) {
    if (!validUpcomingIds.has(comp.itemId)) {
      return {
        success: false,
        error: `Inconsistent backup: Completion for ${comp.occurrenceDate} references upcoming item ID ${comp.itemId}, which does not exist in the backup or database.`,
      };
    }
  }

  // 3. Calculate comparison (new vs existing records)
  // Items comparison: match on (name.toLowerCase(), type)
  const existingItemKeys = new Set(
    currentDbItems.map((i) => `${i.name.trim().toLowerCase()}::${i.type}`)
  );
  let newItemsCount = 0;
  for (const item of bItems) {
    const key = `${item.name.trim().toLowerCase()}::${item.type}`;
    if (!existingItemKeys.has(key)) {
      newItemsCount++;
    }
  }
  const existingItemsCount = bItems.length - newItemsCount;

  // Daily logs comparison: match on (itemId, logDate)
  const currentDbLogs = await db.select({ itemId: dailyLogs.itemId, logDate: dailyLogs.logDate }).from(dailyLogs);
  const existingLogKeys = new Set(currentDbLogs.map((l) => `${l.itemId}::${l.logDate}`));
  let newLogsCount = 0;
  for (const log of bLogs) {
    const key = `${log.itemId}::${log.logDate}`;
    if (!existingLogKeys.has(key)) {
      newLogsCount++;
    }
  }
  const existingLogsCount = bLogs.length - newLogsCount;

  // Upcoming items comparison: match on (title.toLowerCase(), dueAt)
  const currentDbUpcomingKeys = new Set(
    currentDbUpcoming.map((u) => u.title.trim().toLowerCase())
  );
  let newUpcomingCount = 0;
  for (const up of bUpcoming) {
    if (!currentDbUpcomingKeys.has(up.title.trim().toLowerCase())) {
      newUpcomingCount++;
    }
  }
  const existingUpcomingCount = bUpcoming.length - newUpcomingCount;

  // Completions comparison: match on (itemId, occurrenceDate)
  const currentDbCompletions = await db
    .select({ itemId: upcomingCompletions.itemId, occurrenceDate: upcomingCompletions.occurrenceDate })
    .from(upcomingCompletions);
  const existingCompKeys = new Set(currentDbCompletions.map((c) => `${c.itemId}::${c.occurrenceDate}`));
  let newCompletionsCount = 0;
  for (const comp of bCompletions) {
    const key = `${comp.itemId}::${comp.occurrenceDate}`;
    if (!existingCompKeys.has(key)) {
      newCompletionsCount++;
    }
  }
  const existingCompletionsCount = bCompletions.length - newCompletionsCount;

  return {
    success: true,
    preview: {
      app: String(payload.app),
      version: Number(payload.version),
      exportedAt: String(payload.exportedAt),
      timezone: String(payload.timezone),
      counts: {
        items: bItems.length,
        dailyLogs: bLogs.length,
        upcoming: bUpcoming.length,
        completions: bCompletions.length,
      },
      comparison: {
        items: { new: newItemsCount, existing: existingItemsCount },
        dailyLogs: { new: newLogsCount, existing: existingLogsCount },
        upcoming: { new: newUpcomingCount, existing: existingUpcomingCount },
        completions: { new: newCompletionsCount, existing: existingCompletionsCount },
      },
    },
  };
}

/**
 * Core restore logic that runs inside a transaction with safe ID re-mapping.
 * Can be called by Server Actions (with auth) or tests.
 */
export async function restoreDatabaseData(
  payload: BackupPayload,
  mode: "merge" | "replace" = "merge"
): Promise<RestoreResult> {
  const {
    items: bItems,
    dailyLogs: bLogs,
    upcoming: bUpcoming,
    completions: bCompletions,
    settings: bSettings,
  } = payload.data;

  try {
    await db.transaction(async (tx) => {
      // 1. If 'replace' mode, wipe existing user tables
      if (mode === "replace") {
        await tx.delete(upcomingCompletions);
        await tx.delete(upcomingItems);
        await tx.delete(dailyLogs);
        await tx.delete(items);
      }

      // 2. Restore Items & map old file IDs to actual database IDs
      const itemIdMap = new Map<number, number>();

      if (mode === "merge") {
        const existingItems = await tx.select().from(items);
        const itemMapByName = new Map(
          existingItems.map((i) => [`${i.name.trim().toLowerCase()}::${i.type}`, i])
        );

        for (const item of bItems) {
          const key = `${item.name.trim().toLowerCase()}::${item.type}`;
          const existing = itemMapByName.get(key);

          if (existing) {
            // Update matching item
            await tx
              .update(items)
              .set({
                targetCount: item.targetCount,
                reminderTime: item.reminderTime || null,
                sortOrder: item.sortOrder ?? existing.sortOrder,
                active: item.active !== false,
              })
              .where(sql`${items.id} = ${existing.id}`);

            if (item.id) itemIdMap.set(item.id, existing.id);
          } else {
            // Insert new item
            const [inserted] = await tx
              .insert(items)
              .values({
                name: item.name,
                type: item.type,
                targetCount: item.targetCount,
                reminderTime: item.reminderTime || null,
                sortOrder: item.sortOrder || 0,
                active: item.active !== false,
              })
              .returning({ id: items.id });

            if (item.id) itemIdMap.set(item.id, inserted.id);
            itemMapByName.set(key, inserted as any);
          }
        }
      } else {
        // Replace mode: insert each item fresh
        for (const item of bItems) {
          const [inserted] = await tx
            .insert(items)
            .values({
              name: item.name,
              type: item.type,
              targetCount: item.targetCount,
              reminderTime: item.reminderTime || null,
              sortOrder: item.sortOrder || 0,
              active: item.active !== false,
            })
            .returning({ id: items.id });

          if (item.id) itemIdMap.set(item.id, inserted.id);
        }
      }

      // 3. Restore Daily Logs with remapped itemId
      for (const log of bLogs) {
        const mappedItemId = itemIdMap.get(log.itemId) ?? log.itemId;

        await tx
          .insert(dailyLogs)
          .values({
            itemId: mappedItemId,
            logDate: log.logDate,
            count: log.count,
            done: log.done,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [dailyLogs.itemId, dailyLogs.logDate],
            set: {
              count:
                mode === "replace"
                  ? log.count
                  : sql`GREATEST(${dailyLogs.count}, ${log.count})`,
              done: mode === "replace" ? log.done : sql`${dailyLogs.done} OR ${log.done}`,
              updatedAt: new Date(),
            },
          });
      }

      // 4. Restore Upcoming Items & map old file IDs to actual database IDs
      const upcomingIdMap = new Map<number, number>();

      if (mode === "merge") {
        const existingUpcoming = await tx.select().from(upcomingItems);
        const upcomingMapByKey = new Map(
          existingUpcoming.map((u) => [
            `${u.title.trim().toLowerCase()}::${new Date(u.dueAt).toISOString()}`,
            u,
          ])
        );

        for (const item of bUpcoming) {
          const key = `${item.title.trim().toLowerCase()}::${new Date(item.dueAt).toISOString()}`;
          const existing = upcomingMapByKey.get(key);

          if (existing) {
            if (item.id) upcomingIdMap.set(item.id, existing.id);
          } else {
            const [inserted] = await tx
              .insert(upcomingItems)
              .values({
                title: item.title,
                type: item.type,
                dueAt: new Date(item.dueAt),
                endAt: item.endAt ? new Date(item.endAt) : null,
                hasTime: item.hasTime !== false,
                repeat: item.repeat || null,
                notes: item.notes || null,
                doneAt: item.doneAt ? new Date(item.doneAt) : null,
                snoozedUntil: item.snoozedUntil ? new Date(item.snoozedUntil) : null,
              })
              .returning({ id: upcomingItems.id });

            if (item.id) upcomingIdMap.set(item.id, inserted.id);
            upcomingMapByKey.set(key, inserted as any);
          }
        }
      } else {
        // Replace mode
        for (const item of bUpcoming) {
          const [inserted] = await tx
            .insert(upcomingItems)
            .values({
              title: item.title,
              type: item.type,
              dueAt: new Date(item.dueAt),
              endAt: item.endAt ? new Date(item.endAt) : null,
              hasTime: item.hasTime !== false,
              repeat: item.repeat || null,
              notes: item.notes || null,
              doneAt: item.doneAt ? new Date(item.doneAt) : null,
              snoozedUntil: item.snoozedUntil ? new Date(item.snoozedUntil) : null,
            })
            .returning({ id: upcomingItems.id });

          if (item.id) upcomingIdMap.set(item.id, inserted.id);
        }
      }

      // 5. Restore Upcoming Completions with remapped upcoming itemId
      for (const comp of bCompletions) {
        const mappedUpcomingId = upcomingIdMap.get(comp.itemId) ?? comp.itemId;

        await tx
          .insert(upcomingCompletions)
          .values({
            itemId: mappedUpcomingId,
            occurrenceDate: comp.occurrenceDate,
            completedAt: new Date(comp.completedAt),
          })
          .onConflictDoNothing();
      }

      // 6. Restore Settings (excluding sensitive credentials/secrets)
      if (bSettings && typeof bSettings === "object") {
        for (const [key, val] of Object.entries(bSettings)) {
          const keyLower = key.toLowerCase();
          if (
            keyLower.includes("pin") ||
            keyLower.includes("secret") ||
            keyLower.includes("auth") ||
            keyLower.includes("hash") ||
            keyLower.includes("token") ||
            keyLower.includes("password")
          ) {
            continue;
          }

          await tx
            .insert(settings)
            .values({
              key,
              value: val,
            })
            .onConflictDoUpdate({
              target: settings.key,
              set: { value: val },
            });
        }
      }
    });

    try {
      revalidatePath("/today");
      revalidatePath("/daily");
      revalidatePath("/upcoming");
      revalidatePath("/report");
      revalidatePath("/settings");
    } catch {
      // Ignore outside request context
    }

    return {
      success: true,
      counts: {
        items: bItems.length,
        dailyLogs: bLogs.length,
        upcoming: bUpcoming.length,
        completions: bCompletions.length,
      },
    };
  } catch (err: any) {
    console.error("Backup restore transaction failed:", err?.message || err);
    return {
      success: false,
      error: `Restore failed: ${err?.message || "Database transaction error"}. No data was changed.`,
    };
  }
}

/**
 * Server action to execute the database restore with session authentication and rate limiting
 */
export async function executeRestore(
  rawJson: unknown,
  mode: "merge" | "replace" = "merge"
): Promise<RestoreResult> {
  const auth = await isUserAuthenticated();
  if (!auth) {
    return { success: false, error: "Unauthorized. Please log in first." };
  }

  // Rate limiting (max 10 restores/min)
  const { success: rateOk } = checkRateLimit("backup-restore", 10, 60000);
  if (!rateOk) {
    return { success: false, error: "Too many restore requests. Please wait a moment." };
  }

  // Validate payload
  const parseResult = BackupPayloadSchema.safeParse(rawJson);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues[0]?.message || "Invalid backup file structure.",
    };
  }

  return restoreDatabaseData(parseResult.data, mode);
}
