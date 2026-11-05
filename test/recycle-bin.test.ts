import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { BackupPayloadSchema, BackupItemSchema, BackupUpcomingItemSchema } from "../lib/backup-schema.js";

describe("Part B: Recycle bin and soft delete safety", () => {
  test("BackupItemSchema accepts deletedAt and retains it", () => {
    const itemWithDeletedAt = {
      id: 1,
      name: "Meditation",
      type: "checklist" as const,
      targetCount: 1,
      deletedAt: "2026-11-05T12:00:00.000Z",
    };

    const parsed = BackupItemSchema.safeParse(itemWithDeletedAt);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.deletedAt, "2026-11-05T12:00:00.000Z");
    }
  });

  test("BackupUpcomingItemSchema accepts deletedAt and retains it", () => {
    const upcomingWithDeletedAt = {
      id: 42,
      title: "Team Standup",
      type: "meeting" as const,
      dueAt: "2026-11-06T10:00:00.000Z",
      deletedAt: "2026-11-05T14:30:00.000Z",
    };

    const parsed = BackupUpcomingItemSchema.safeParse(upcomingWithDeletedAt);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.deletedAt, "2026-11-05T14:30:00.000Z");
    }
  });

  test("BackupPayloadSchema validates full backup including deleted items in recycle bin", () => {
    const payload = {
      app: "ninaivo",
      version: 1,
      exportedAt: "2026-11-05T15:00:00.000Z",
      timezone: "Asia/Kolkata",
      counts: {
        items: 1,
        dailyLogs: 0,
        upcoming: 1,
        completions: 0,
        settings: 0,
      },
      data: {
        items: [
          {
            id: 10,
            name: "Deleted Habit",
            type: "checklist",
            targetCount: 1,
            deletedAt: "2026-11-04T10:00:00.000Z",
          },
        ],
        dailyLogs: [],
        upcoming: [
          {
            id: 20,
            title: "Deleted Meeting",
            type: "meeting",
            dueAt: "2026-11-05T10:00:00.000Z",
            deletedAt: "2026-11-05T09:00:00.000Z",
          },
        ],
        completions: [],
        settings: {
          auto_clean_bin: "30",
        },
      },
    };

    const parsed = BackupPayloadSchema.safeParse(payload);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.data.items[0].deletedAt, "2026-11-04T10:00:00.000Z");
      assert.equal(parsed.data.data.upcoming[0].deletedAt, "2026-11-05T09:00:00.000Z");
      assert.equal(parsed.data.data.settings.auto_clean_bin, "30");
    }
  });

  test("Days ago calculation relative formatting", () => {
    function formatDaysAgo(deletedAt: Date, now: Date) {
      const diffMs = now.getTime() - deletedAt.getTime();
      const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      if (diffDays === 0) return { daysAgo: 0, relativeTime: "Today" };
      if (diffDays === 1) return { daysAgo: 1, relativeTime: "1 day ago" };
      return { daysAgo: diffDays, relativeTime: `${diffDays} days ago` };
    }

    const now = new Date("2026-11-05T12:00:00.000Z");
    assert.deepEqual(formatDaysAgo(new Date("2026-11-05T08:00:00.000Z"), now), {
      daysAgo: 0,
      relativeTime: "Today",
    });
    assert.deepEqual(formatDaysAgo(new Date("2026-11-04T11:00:00.000Z"), now), {
      daysAgo: 1,
      relativeTime: "1 day ago",
    });
    assert.deepEqual(formatDaysAgo(new Date("2026-11-01T12:00:00.000Z"), now), {
      daysAgo: 4,
      relativeTime: "4 days ago",
    });
  });
});

