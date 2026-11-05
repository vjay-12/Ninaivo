import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  BackupPayloadSchema,
  BackupFoodItemSchema,
  BackupFoodLogSchema,
} from "../lib/backup-schema.js";

describe("Part C: Diet tab and Food items schema", () => {
  test("BackupFoodItemSchema validates food categories", () => {
    const validFood = {
      name: "Protein Shake",
      category: "protein" as const,
      note: "with almond milk",
    };
    const parsed = BackupFoodItemSchema.safeParse(validFood);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.category, "protein");
      assert.equal(parsed.data.name, "Protein Shake");
    }
  });

  test("BackupFoodLogSchema validates food logs", () => {
    const log = {
      foodId: 10,
      logDate: "2026-11-05",
      count: 2,
    };
    const parsed = BackupFoodLogSchema.safeParse(log);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.count, 2);
      assert.equal(parsed.data.logDate, "2026-11-05");
    }
  });

  test("BackupPayloadSchema version 2 supports foodItems and foodLogs", () => {
    const payloadV2 = {
      app: "ninaivo",
      version: 2,
      exportedAt: "2026-11-05T15:00:00.000Z",
      timezone: "Asia/Kolkata",
      counts: {
        items: 1,
        dailyLogs: 0,
        upcoming: 0,
        completions: 0,
        foodItems: 1,
        foodLogs: 1,
      },
      data: {
        items: [
          {
            id: 1,
            name: "Morning Meditation",
            type: "checklist",
            targetCount: 1,
          },
        ],
        dailyLogs: [],
        upcoming: [],
        completions: [],
        foodItems: [
          {
            id: 101,
            name: "Greek Yogurt",
            category: "protein",
            note: "with berries",
          },
        ],
        foodLogs: [
          {
            id: 201,
            foodId: 101,
            logDate: "2026-11-05",
            count: 1,
          },
        ],
        settings: {},
      },
    };

    const parsed = BackupPayloadSchema.safeParse(payloadV2);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.version, 2);
      assert.equal(parsed.data.data.foodItems.length, 1);
      assert.equal(parsed.data.data.foodLogs.length, 1);
      assert.equal(parsed.data.data.foodItems[0].name, "Greek Yogurt");
    }
  });

  test("BackupPayloadSchema backwards compatibility: v1 imports still work without foodItems", () => {
    const payloadV1 = {
      app: "ninaivo",
      version: 1,
      exportedAt: "2026-11-01T10:00:00.000Z",
      timezone: "Asia/Kolkata",
      counts: {
        items: 1,
        dailyLogs: 0,
        upcoming: 0,
        completions: 0,
      },
      data: {
        items: [
          {
            id: 5,
            name: "Drink Water 3L",
            type: "diet",
            targetCount: 3,
          },
        ],
        dailyLogs: [],
        upcoming: [],
        completions: [],
        settings: {},
      },
    };

    const parsed = BackupPayloadSchema.safeParse(payloadV1);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.version, 1);
      assert.deepEqual(parsed.data.data.foodItems, []);
      assert.deepEqual(parsed.data.data.foodLogs, []);
    }
  });
});

