import {
  localDb,
  type LocalItem,
  type LocalDailyLog,
  type LocalUpcomingItem,
  type LocalUpcomingCompletion,
  type LocalSetting,
  type OutboxEntry,
} from "./db-local";

export type SyncState = "idle" | "syncing" | "offline" | "error";

export interface SyncStatus {
  state: SyncState;
  pendingCount: number;
  lastSyncedAt: Date | null;
  humanStatus: string;
}

type SyncListener = (status: SyncStatus) => void;

class SyncEngine {
  private isSyncing = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private backoffDelayMs = 5000;
  private listeners = new Set<SyncListener>();

  private currentStatus: SyncStatus = {
    state: "idle",
    pendingCount: 0,
    lastSyncedAt: null,
    humanStatus: "Synced just now",
  };

  constructor() {
    if (typeof window !== "undefined") {
      this.init();
    }
  }

  private async init() {
    // 1. Restore lastSyncedAt from Dexie
    try {
      const meta = await localDb.syncMeta.get("lastSyncedAt");
      if (meta?.value) {
        this.currentStatus.lastSyncedAt = new Date(meta.value);
      }
      const count = await localDb.syncOutbox.count();
      this.currentStatus.pendingCount = count;
      this.updateHumanStatus();
    } catch {}

    // 2. Setup event listeners
    window.addEventListener("online", () => {
      this.backoffDelayMs = 5000;
      this.sync();
    });

    window.addEventListener("offline", () => {
      this.currentStatus.state = "offline";
      this.updateHumanStatus();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.sync();
      }
    });

    // 3. Periodic sync every 60 seconds
    setInterval(() => {
      if (document.visibilityState === "visible" && !this.isSyncing) {
        this.sync();
      }
    }, 60000);

    // Initial sync
    setTimeout(() => {
      this.sync();
    }, 500);
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.currentStatus);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      listener({ ...this.currentStatus });
    });
  }

  private updateHumanStatus() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.currentStatus.state = "offline";
      const p = this.currentStatus.pendingCount;
      this.currentStatus.humanStatus =
        p > 0 ? `Offline - ${p} change${p === 1 ? "" : "s"} waiting to sync` : "Offline";
      this.notify();
      return;
    }

    if (this.currentStatus.state === "syncing") {
      this.currentStatus.humanStatus = "Syncing...";
      this.notify();
      return;
    }

    if (this.currentStatus.pendingCount > 0) {
      const p = this.currentStatus.pendingCount;
      this.currentStatus.humanStatus = `${p} change${p === 1 ? "" : "s"} waiting to sync`;
      this.notify();
      return;
    }

    if (!this.currentStatus.lastSyncedAt) {
      this.currentStatus.humanStatus = "Ready to sync";
      this.notify();
      return;
    }

    const elapsedSec = Math.floor((Date.now() - this.currentStatus.lastSyncedAt.getTime()) / 1000);
    if (elapsedSec < 30) {
      this.currentStatus.humanStatus = "Synced just now";
    } else if (elapsedSec < 120) {
      this.currentStatus.humanStatus = "Synced 1m ago";
    } else if (elapsedSec < 3600) {
      this.currentStatus.humanStatus = `Synced ${Math.floor(elapsedSec / 60)}m ago`;
    } else {
      this.currentStatus.humanStatus = `Synced ${Math.floor(elapsedSec / 3600)}h ago`;
    }
    this.notify();
  }

  /**
   * Called by local writes: stores outbox entry and triggers debounced sync in 2s
   */
  public async queueLocalWrite(
    table: OutboxEntry["table"],
    action: OutboxEntry["action"],
    record: any
  ) {
    if (!localDb) return;
    try {
      await localDb.syncOutbox.add({
        uuid: record.uuid,
        table,
        action,
        record,
        timestamp: Date.now(),
      });
      const count = await localDb.syncOutbox.count();
      this.currentStatus.pendingCount = count;
      this.updateHumanStatus();

      // Trigger 2-second debounced sync
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.sync();
      }, 2000);
    } catch (err) {
      console.error("[Sync queueLocalWrite error]:", err);
    }
  }

  /**
   * Main sync procedure (push then pull)
   */
  public async sync(): Promise<void> {
    if (!localDb || this.isSyncing) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.currentStatus.state = "offline";
      this.updateHumanStatus();
      return;
    }

    this.isSyncing = true;
    this.currentStatus.state = "syncing";
    this.updateHumanStatus();

    try {
      // 1. Push outbox changes to server
      await this.pushOutbox();

      // 2. Pull server updates since cursor
      await this.pullUpdates();

      // Success
      this.backoffDelayMs = 5000;
      this.currentStatus.state = "idle";
      this.currentStatus.lastSyncedAt = new Date();
      await localDb.syncMeta.put({
        key: "lastSyncedAt",
        value: this.currentStatus.lastSyncedAt.toISOString(),
      });
      const count = await localDb.syncOutbox.count();
      this.currentStatus.pendingCount = count;
      this.updateHumanStatus();
    } catch (err) {
      console.warn("[Sync failed, retrying with backoff]:", err);
      this.currentStatus.state = navigator.onLine ? "error" : "offline";
      this.updateHumanStatus();

      // Schedule exponential backoff retry (up to 60s)
      if (this.syncTimer) clearTimeout(this.syncTimer);
      this.syncTimer = setTimeout(() => {
        this.sync();
      }, this.backoffDelayMs);
      this.backoffDelayMs = Math.min(this.backoffDelayMs * 2, 60000);
    } finally {
      this.isSyncing = false;
    }
  }

  private async pushOutbox(): Promise<void> {
    const entries = await localDb.syncOutbox.toArray();
    if (entries.length === 0) return;

    const res = await fetch("/api/sync/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outbox: entries }),
    });

    if (!res.ok) {
      throw new Error(`Push failed with HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.success && Array.isArray(data.processedIds)) {
      await localDb.syncOutbox.bulkDelete(data.processedIds);
      const count = await localDb.syncOutbox.count();
      this.currentStatus.pendingCount = count;
    }
  }

  private async pullUpdates(): Promise<void> {
    const metaCursor = await localDb.syncMeta.get("syncCursor");
    const cursor = metaCursor?.value || "";

    const res = await fetch(`/api/sync/pull?since=${encodeURIComponent(cursor)}`, {
      method: "GET",
    });

    if (!res.ok) {
      throw new Error(`Pull failed with HTTP ${res.status}`);
    }

    const data = await res.json();
    const {
      serverCursor,
      items: incomingItems,
      dailyLogs: incomingLogs,
      upcomingItems: incomingUpcoming,
      upcomingCompletions: incomingCompletions,
      settings: incomingSettings,
    } = data;

    // Apply into Dexie with last-write-wins
    await localDb.transaction(
      "rw",
      [
        localDb.items,
        localDb.dailyLogs,
        localDb.upcomingItems,
        localDb.upcomingCompletions,
        localDb.settings,
        localDb.syncMeta,
      ],
      async () => {
        // Items
        if (Array.isArray(incomingItems)) {
          for (const item of incomingItems) {
            if (item.deletedAt) {
              await localDb.items.delete(item.uuid);
            } else {
              const local = await localDb.items.get(item.uuid);
              if (!local || new Date(item.updatedAt) >= new Date(local.updatedAt)) {
                await localDb.items.put(item);
              }
            }
          }
        }

        // Daily Logs
        if (Array.isArray(incomingLogs)) {
          for (const log of incomingLogs) {
            if (log.deletedAt) {
              await localDb.dailyLogs.delete(log.uuid);
            } else {
              const local = await localDb.dailyLogs.get(log.uuid);
              if (!local || new Date(log.updatedAt) >= new Date(local.updatedAt)) {
                await localDb.dailyLogs.put(log);
              }
            }
          }
        }

        // Upcoming Items
        if (Array.isArray(incomingUpcoming)) {
          for (const up of incomingUpcoming) {
            if (up.deletedAt) {
              await localDb.upcomingItems.delete(up.uuid);
            } else {
              const local = await localDb.upcomingItems.get(up.uuid);
              if (!local || new Date(up.updatedAt) >= new Date(local.updatedAt)) {
                await localDb.upcomingItems.put(up);
              }
            }
          }
        }

        // Upcoming Completions
        if (Array.isArray(incomingCompletions)) {
          for (const comp of incomingCompletions) {
            if (comp.deletedAt) {
              await localDb.upcomingCompletions.delete(comp.uuid);
            } else {
              const local = await localDb.upcomingCompletions.get(comp.uuid);
              if (!local || new Date(comp.updatedAt) >= new Date(local.updatedAt)) {
                await localDb.upcomingCompletions.put(comp);
              }
            }
          }
        }

        // Settings
        if (Array.isArray(incomingSettings)) {
          for (const s of incomingSettings) {
            if (s.deletedAt) {
              await localDb.settings.delete(s.key);
            } else {
              const local = await localDb.settings.get(s.key);
              if (!local || new Date(s.updatedAt) >= new Date(local.updatedAt)) {
                await localDb.settings.put(s);
              }
            }
          }
        }

        // Update cursor
        if (serverCursor) {
          await localDb.syncMeta.put({ key: "syncCursor", value: serverCursor });
        }
      }
    );
  }
}

export const syncEngine = typeof window !== "undefined" ? new SyncEngine() : (null as any);
