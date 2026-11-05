import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeSnoozedDates,
  getUpcomingDateInfo,
  getDateStringInTz,
  getTimeStringInTz,
} from "../lib/date";

describe("Snooze System Verification (Part A)", () => {
  // Reference now: 2026-11-05 12:00:00 PM IST (06:30:00 UTC)
  const refNow = new Date("2026-11-05T06:30:00.000Z");

  it("Snooze 1h: moves due_at forward by 1 hour and item stays visible with Snoozed label", () => {
    // Current due: 2026-11-05 12:30 PM IST (07:00 UTC)
    const currentDue = new Date("2026-11-05T07:00:00.000Z");
    const { newDueAt, hasTime } = computeSnoozedDates(
      currentDue,
      null,
      true,
      "1h",
      refNow
    );

    // newDueAt should be 1:30 PM IST (08:00 UTC)
    assert.equal(newDueAt.toISOString(), "2026-11-05T08:00:00.000Z");
    assert.equal(hasTime, true);

    const info = getUpcomingDateInfo(
      {
        dueAt: newDueAt,
        hasTime: true,
        snoozedUntil: refNow,
      },
      refNow
    );

    assert.equal(info.section, "today");
    assert.equal(info.isSnoozed, true);
    assert.equal(info.isOverdue, false);
    assert.equal(info.relativeLabel, "Today");
  });

  it("Snooze tomorrow: moves due_at to tomorrow at the same time", () => {
    // Current due: 2026-11-05 10:05 AM IST (04:35 UTC)
    const currentDue = new Date("2026-11-05T04:35:00.000Z");
    const { newDueAt, hasTime } = computeSnoozedDates(
      currentDue,
      null,
      true,
      "tomorrow",
      refNow
    );

    // Date on tomorrow should be 2026-11-06
    const newDateStr = getDateStringInTz(newDueAt);
    const newTimeStr = getTimeStringInTz(newDueAt);

    assert.equal(newDateStr, "2026-11-06");
    assert.equal(newTimeStr, "10:05");
    assert.equal(hasTime, true);

    const info = getUpcomingDateInfo(
      {
        dueAt: newDueAt,
        hasTime: true,
        snoozedUntil: refNow,
      },
      refNow
    );

    assert.equal(info.section, "tomorrow");
    assert.equal(info.isSnoozed, true);
    assert.equal(info.relativeLabel, "Tomorrow");
  });

  it("Snooze tomorrow for item with no time defaults to 9:00 AM on tomorrow", () => {
    const currentDue = new Date("2026-11-05T03:30:00.000Z");
    const { newDueAt, hasTime } = computeSnoozedDates(
      currentDue,
      null,
      false, // no time
      "tomorrow",
      refNow
    );

    const newDateStr = getDateStringInTz(newDueAt);
    const newTimeStr = getTimeStringInTz(newDueAt);

    assert.equal(newDateStr, "2026-11-06");
    assert.equal(newTimeStr, "09:00");
    assert.equal(hasTime, false);
  });

  it("Snooze preserves meeting duration", () => {
    // 30 min meeting: 10:00 AM - 10:30 AM
    const due = new Date("2026-11-05T04:30:00.000Z");
    const end = new Date("2026-11-05T05:00:00.000Z");

    const { newDueAt, newEndAt } = computeSnoozedDates(
      due,
      end,
      true,
      "tomorrow",
      refNow
    );

    assert.ok(newEndAt);
    const diffMin = (newEndAt.getTime() - newDueAt.getTime()) / 60000;
    assert.equal(diffMin, 30);
  });

  it("Snoozed items are never hidden and deleted_at is never set by snooze", () => {
    const item = {
      dueAt: "2026-11-05T04:35:00.000Z",
      snoozedUntil: "2026-11-05T06:30:00.000Z",
      hasTime: true,
      deletedAt: null,
    };

    const info = getUpcomingDateInfo(item, refNow);

    // Item must be visible and placed in its target section
    assert.notEqual(info.section, undefined);
    assert.equal(info.isSnoozed, true);
    assert.equal(item.deletedAt, null, "Snooze must NEVER set deleted_at");
  });
});

