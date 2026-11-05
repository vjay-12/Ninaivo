import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getUpcomingDateInfo,
  getDateStringInTz,
  getTimeStringInTz,
  buildIsoStringFromLocalDateAndTime,
  DEFAULT_TZ,
} from "../lib/date";

describe("Upcoming Date Grouping and Display", () => {
  // Use a fixed reference point: 2026-11-02 at 12:00 PM (noon) in Asia/Kolkata
  // 12:00 PM IST on 2026-11-02 is 06:30:00 UTC
  const refNow = new Date("2026-11-02T06:30:00.000Z");

  it("10:05 AM item on Tomorrow (2026-11-03) groups under Tomorrow with correct labels", () => {
    // 10:05 AM IST on 2026-11-03 is 04:35:00 UTC
    const item1005 = {
      dueAt: "2026-11-03T04:35:00.000Z",
      hasTime: true,
    };
    const info = getUpcomingDateInfo(item1005, refNow);

    assert.equal(info.dateStr, "2026-11-03");
    assert.equal(info.timeDisplay, "10:05 AM");
    assert.equal(info.section, "tomorrow");
    assert.equal(info.relativeLabel, "Tomorrow");
    assert.equal(info.detailDateDisplay, "Tue, 3 Nov 2026 · 10:05 AM");
    assert.equal(info.isOverdue, false);
    assert.equal(info.isToday, false);
    assert.equal(info.isTomorrow, true);
  });

  it("10:00 AM item and 10:05 AM item on same day are grouped identically into Tomorrow", () => {
    const item1000 = {
      dueAt: "2026-11-03T04:30:00.000Z", // 10:00 AM IST
      hasTime: true,
    };
    const item1005 = {
      dueAt: "2026-11-03T04:35:00.000Z", // 10:05 AM IST
      hasTime: true,
    };

    const info1000 = getUpcomingDateInfo(item1000, refNow);
    const info1005 = getUpcomingDateInfo(item1005, refNow);

    assert.equal(info1000.section, "tomorrow");
    assert.equal(info1005.section, "tomorrow");
    assert.equal(info1000.relativeLabel, "Tomorrow");
    assert.equal(info1005.relativeLabel, "Tomorrow");
    assert.equal(info1000.dateStr, info1005.dateStr);
  });

  it("Item just before midnight (11:55 PM IST) groups under Today", () => {
    // 2026-11-02 23:55 IST is 2026-11-02 18:25:00 UTC
    const itemBeforeMidnight = {
      dueAt: "2026-11-02T18:25:00.000Z",
      hasTime: true,
    };
    const info = getUpcomingDateInfo(itemBeforeMidnight, refNow);

    assert.equal(info.dateStr, "2026-11-02");
    assert.equal(info.timeDisplay, "11:55 PM");
    assert.equal(info.section, "today");
    assert.equal(info.relativeLabel, "Today");
    assert.equal(info.detailDateDisplay, "Mon, 2 Nov 2026 · 11:55 PM");
    assert.equal(info.isToday, true);
    assert.equal(info.isTomorrow, false);
    assert.equal(info.isOverdue, false);
  });

  it("Item just after midnight (00:05 AM IST) groups under Tomorrow", () => {
    // 2026-11-03 00:05 IST is 2026-11-02 18:35:00 UTC
    // Notice: in UTC it is Nov 2, but in Asia/Kolkata it is Nov 3!
    const itemAfterMidnight = {
      dueAt: "2026-11-02T18:35:00.000Z",
      hasTime: true,
    };
    const info = getUpcomingDateInfo(itemAfterMidnight, refNow);

    assert.equal(info.dateStr, "2026-11-03");
    assert.equal(info.timeDisplay, "12:05 AM");
    assert.equal(info.section, "tomorrow");
    assert.equal(info.relativeLabel, "Tomorrow");
    assert.equal(info.detailDateDisplay, "Tue, 3 Nov 2026 · 12:05 AM");
    assert.equal(info.isToday, false);
    assert.equal(info.isTomorrow, true);
    assert.equal(info.isOverdue, false);
  });

  it("Day boundary: exactly midnight (00:00:00 IST) is the start of Tomorrow", () => {
    // 2026-11-03 00:00:00 IST is 2026-11-02 18:30:00 UTC
    const itemMidnight = {
      dueAt: "2026-11-02T18:30:00.000Z",
      hasTime: true,
    };
    const info = getUpcomingDateInfo(itemMidnight, refNow);

    assert.equal(info.dateStr, "2026-11-03");
    assert.equal(info.timeDisplay, "12:00 AM");
    assert.equal(info.section, "tomorrow");
    assert.equal(info.relativeLabel, "Tomorrow");
    assert.equal(info.detailDateDisplay, "Tue, 3 Nov 2026 · 12:00 AM");
  });

  it("Day boundary transition: when reference now crosses midnight", () => {
    const itemNov2 = { dueAt: "2026-11-02T10:00:00+05:30", hasTime: true };
    const itemNov3 = { dueAt: "2026-11-03T10:00:00+05:30", hasTime: true };

    // 1 second before midnight: 2026-11-02 23:59:59 IST
    const justBeforeMidnightNow = new Date("2026-11-02T18:29:59.000Z");
    const infoBefore1 = getUpcomingDateInfo(itemNov2, justBeforeMidnightNow);
    const infoBefore2 = getUpcomingDateInfo(itemNov3, justBeforeMidnightNow);

    assert.equal(infoBefore1.section, "today");
    assert.equal(infoBefore1.isOverdue, false);
    assert.equal(infoBefore2.section, "tomorrow");

    // 1 second after midnight: 2026-11-03 00:00:01 IST
    const justAfterMidnightNow = new Date("2026-11-02T18:30:01.000Z");
    const infoAfter1 = getUpcomingDateInfo(itemNov2, justAfterMidnightNow);
    const infoAfter2 = getUpcomingDateInfo(itemNov3, justAfterMidnightNow);

    assert.equal(infoAfter1.section, "overdue");
    assert.equal(infoAfter1.isOverdue, true);
    assert.equal(infoAfter2.section, "today");
    assert.equal(infoAfter2.isToday, true);
  });

  it("Snoozed items: snooze label is present and item is placed by its due date", () => {
    // Item snoozed to tomorrow (2026-11-03)
    const snoozedItem = {
      dueAt: "2026-11-03T04:30:00.000Z", // Moved to tomorrow 10:00 AM
      snoozedUntil: "2026-11-02T06:30:00.000Z", // Timestamp when snoozed
      hasTime: true,
    };

    const info = getUpcomingDateInfo(snoozedItem, refNow);
    assert.equal(info.isSnoozed, true, "Item displays Snoozed label");
    assert.equal(info.section, "tomorrow", "Item is visible in Tomorrow section");
    assert.equal(info.isOverdue, false);
  });

  it("Never shows raw ISO date: uses human format in subtitle and details", () => {
    // Nov 5 (This week)
    const itemThisWeek = {
      dueAt: "2026-11-05T04:35:00.000Z",
      hasTime: true,
    };
    const infoThisWeek = getUpcomingDateInfo(itemThisWeek, refNow);
    assert.equal(infoThisWeek.relativeLabel, "Thu, 5 Nov");
    assert.equal(infoThisWeek.detailDateDisplay, "Thu, 5 Nov 2026 · 10:05 AM");

    // Next year (2027) - subtitle includes year
    const itemNextYear = {
      dueAt: "2027-01-15T04:35:00.000Z",
      hasTime: true,
    };
    const infoNextYear = getUpcomingDateInfo(itemNextYear, refNow);
    assert.equal(infoNextYear.relativeLabel, "Fri, 15 Jan 2027");
    assert.equal(infoNextYear.detailDateDisplay, "Fri, 15 Jan 2027 · 10:05 AM");

    // Overdue item (Oct 31) - human subtitle without raw ISO string
    const itemOverdue = {
      dueAt: "2026-10-31T04:35:00.000Z",
      hasTime: true,
    };
    const infoOverdue = getUpcomingDateInfo(itemOverdue, refNow);
    assert.equal(infoOverdue.relativeLabel, "Sat, 31 Oct");
    assert.equal(infoOverdue.section, "overdue");
  });

  it("All-day items (hasTime: false) format with All day", () => {
    const itemAllDay = {
      dueAt: "2026-11-03T03:30:00.000Z",
      hasTime: false,
    };
    const info = getUpcomingDateInfo(itemAllDay, refNow);

    assert.equal(info.timeDisplay, "All day");
    assert.equal(info.detailDateDisplay, "Tue, 3 Nov 2026 · All day");
    assert.equal(info.section, "tomorrow");
    assert.equal(info.relativeLabel, "Tomorrow");
  });

  it("No date items return clean fallback without throwing", () => {
    const itemNoDate = {
      dueAt: null,
      hasTime: false,
    };
    const info = getUpcomingDateInfo(itemNoDate, refNow);

    assert.equal(info.dateStr, null);
    assert.equal(info.timeDisplay, "");
    assert.equal(info.section, "noDate");
    assert.equal(info.relativeLabel, "No date");
    assert.equal(info.detailDateDisplay, "No date set");
    assert.equal(info.isOverdue, false);
  });

  it("buildIsoStringFromLocalDateAndTime produces deterministic Asia/Kolkata timestamps", () => {
    const iso = buildIsoStringFromLocalDateAndTime("2026-11-03", "10:05");
    // 10:05 AM IST is 04:35 UTC
    assert.equal(iso, "2026-11-03T04:35:00.000Z");

    const timeStr = getTimeStringInTz(iso);
    assert.equal(timeStr, "10:05");

    const dateStr = getDateStringInTz(iso);
    assert.equal(dateStr, "2026-11-03");
  });
});

