"use client";

import { localDb } from "@/lib/db-local";

export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      return isPersisted;
    } catch {
      return false;
    }
  }
  return false;
}

export async function checkStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persisted) {
    try {
      return await navigator.storage.persisted();
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Saves a snapshot of current local IndexedDB tables.
 * Retains only the last 3 snapshots to prevent runaway storage usage.
 */
export async function saveLocalSnapshot(reason: string): Promise<boolean> {
  if (!localDb) return false;

  try {
    const [
      items,
      dailyLogs,
      upcomingItems,
      upcomingCompletions,
      foodItems,
      foodLogs,
      settings,
    ] = await Promise.all([
      localDb.items.toArray(),
      localDb.dailyLogs.toArray(),
      localDb.upcomingItems.toArray(),
      localDb.upcomingCompletions.toArray(),
      localDb.foodItems.toArray(),
      localDb.foodLogs.toArray(),
      localDb.settings.toArray(),
    ]);

    const snapshotData = {
      items,
      dailyLogs,
      upcomingItems,
      upcomingCompletions,
      foodItems,
      foodLogs,
      settings,
    };

    await localDb.snapshots.add({
      createdAt: new Date().toISOString(),
      reason,
      data: snapshotData,
    });

    // Keep only the last 3 snapshots
    const allSnapshots = await localDb.snapshots.orderBy("id").toArray();
    if (allSnapshots.length > 3) {
      const toDelete = allSnapshots.slice(0, allSnapshots.length - 3);
      for (const s of toDelete) {
        if (s.id) await localDb.snapshots.delete(s.id);
      }
    }

    return true;
  } catch (err) {
    console.error("Failed to save local snapshot:", err);
    return false;
  }
}

