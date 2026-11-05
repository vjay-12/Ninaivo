import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Part D: Offline-first & Data Safety", () => {
  test("Snapshot retention keeps only the last 3 snapshots", () => {
    interface FakeSnapshot {
      id: number;
      createdAt: string;
      reason: string;
    }

    let snapshots: FakeSnapshot[] = [];

    function addSnapshot(reason: string) {
      const id = snapshots.length + 1;
      snapshots.push({
        id,
        createdAt: new Date().toISOString(),
        reason,
      });

      // Keep only last 3
      if (snapshots.length > 3) {
        snapshots = snapshots.slice(snapshots.length - 3);
      }
    }

    addSnapshot("Initial state");
    addSnapshot("Before migration 1");
    addSnapshot("Before migration 2");
    assert.equal(snapshots.length, 3);
    assert.equal(snapshots[0].reason, "Initial state");

    addSnapshot("Before restore replace");
    assert.equal(snapshots.length, 3);
    assert.equal(snapshots[0].reason, "Before migration 1");
    assert.equal(snapshots[2].reason, "Before restore replace");

    addSnapshot("Before schema update");
    assert.equal(snapshots.length, 3);
    assert.equal(snapshots[0].reason, "Before migration 2");
    assert.equal(snapshots[2].reason, "Before schema update");
  });

  test("Sync merge rule: never drops missing local records without tombstone", () => {
    interface Record {
      uuid: string;
      name: string;
      updatedAt: string;
      deletedAt: string | null;
    }

    const localStore = new Map<string, Record>([
      ["item-1", { uuid: "item-1", name: "Offline created item", updatedAt: "2026-11-05T10:00:00.000Z", deletedAt: null }],
      ["item-2", { uuid: "item-2", name: "Existing item", updatedAt: "2026-11-05T09:00:00.000Z", deletedAt: null }],
    ]);

    // Server returns only item-2 with newer timestamp. It does NOT return item-1.
    const serverIncoming: Record[] = [
      { uuid: "item-2", name: "Existing item updated", updatedAt: "2026-11-05T10:30:00.000Z", deletedAt: null },
    ];

    // Apply pull updates with merge rule
    for (const incoming of serverIncoming) {
      const local = localStore.get(incoming.uuid);
      if (!local || new Date(incoming.updatedAt) >= new Date(local.updatedAt)) {
        localStore.set(incoming.uuid, incoming);
      }
    }

    // Crucial check: local item-1 must NOT have been dropped
    assert.equal(localStore.has("item-1"), true);
    assert.equal(localStore.get("item-1")?.name, "Offline created item");
    assert.equal(localStore.get("item-2")?.name, "Existing item updated");
  });

  test("Sync merge rule: applies tombstone soft-delete without dropping record from recycle bin", () => {
    interface Record {
      uuid: string;
      name: string;
      updatedAt: string;
      deletedAt: string | null;
    }

    const localStore = new Map<string, Record>([
      ["item-1", { uuid: "item-1", name: "Active item", updatedAt: "2026-11-05T10:00:00.000Z", deletedAt: null }],
    ]);

    const serverIncoming: Record[] = [
      { uuid: "item-1", name: "Active item", updatedAt: "2026-11-05T11:00:00.000Z", deletedAt: "2026-11-05T11:00:00.000Z" },
    ];

    for (const incoming of serverIncoming) {
      const local = localStore.get(incoming.uuid);
      if (!local || new Date(incoming.updatedAt) >= new Date(local.updatedAt)) {
        localStore.set(incoming.uuid, incoming);
      }
    }

    // Record remains in local store with deletedAt set (accessible to Recycle bin)
    assert.equal(localStore.has("item-1"), true);
    assert.equal(localStore.get("item-1")?.deletedAt, "2026-11-05T11:00:00.000Z");
  });
});

