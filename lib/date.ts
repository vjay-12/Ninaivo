export const DEFAULT_TZ = "Asia/Kolkata";

/**
 * Returns today's date formatted as YYYY-MM-DD in the given timezone (defaults to Asia/Kolkata)
 */
export function getTodayDateString(timeZone: string = DEFAULT_TZ): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  } catch {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  }
}

/**
 * Converts any date or timestamptz to local YYYY-MM-DD string in Asia/Kolkata
 */
export function getDateStringInTz(date: Date | string, timeZone: string = DEFAULT_TZ): string {
  const d = typeof date === "string" ? new Date(date) : date;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }
}

/**
 * Formats a YYYY-MM-DD date string for user display, e.g. "Thu, 29 Oct" or "Thursday, 29 October"
 */
export function formatDateDisplay(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
  }
): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

/**
 * Get weekday index 0 (Sunday) to 6 (Saturday) for a given YYYY-MM-DD string
 */
export function getWeekdayFromDate(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return date.getUTCDay();
}

/**
 * Add or subtract days from YYYY-MM-DD string
 */
export function addDaysToDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return date.toISOString().slice(0, 10);
}

/**
 * Get dates for the Monday-Sunday week containing the given date
 */
export function getWeekDays(referenceDate: string = getTodayDateString()): {
  date: string;
  dayShort: string;
  dayNum: number;
  weekday: number;
  isToday: boolean;
}[] {
  const today = getTodayDateString();
  const currentWeekday = getWeekdayFromDate(referenceDate); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  
  const mondayOffset = currentWeekday === 0 ? -6 : 1 - currentWeekday;
  const mondayDateStr = addDaysToDate(referenceDate, mondayOffset);

  const days = [];
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  for (let i = 0; i < 7; i++) {
    const date = addDaysToDate(mondayDateStr, i);
    const [y, m, d] = date.split("-").map(Number);
    const dayObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const weekday = dayObj.getUTCDay(); // 0-6
    days.push({
      date,
      dayShort: dayNames[i],
      dayNum: d,
      weekday,
      isToday: date === today,
    });
  }

  return days;
}

/**
 * Format database time "HH:MM:SS" or "HH:MM" into "h:mm a" (e.g. "10:00 PM")
 */
export function formatTimeDisplay(timeStr?: string | null): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  const hour = parseInt(parts[0], 10);
  const minute = parts[1];
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h}:${minute} ${ampm}`;
}

/**
 * Extracts 24-hour HH:MM time string in the target timezone (e.g. "10:05")
 */
export function getTimeStringInTz(date: Date | string, timeZone: string = DEFAULT_TZ): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return formatter.format(d);
}

/**
 * Constructs an ISO UTC string from a local YYYY-MM-DD date and HH:MM time in the target timezone (defaults to Asia/Kolkata).
 * Ensures deterministic parsing regardless of client browser or server execution environment.
 */
export function buildIsoStringFromLocalDateAndTime(
  dateStr: string,
  timeStr: string = "09:00",
  timeZone: string = DEFAULT_TZ
): string {
  const [hh, mm] = timeStr.split(":").map(Number);
  const hour = isNaN(hh) ? 9 : hh;
  const minute = isNaN(mm) ? 0 : mm;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (timeZone === "Asia/Kolkata") {
    // Asia/Kolkata has constant UTC+05:30 offset
    const isoWithOffset = `${dateStr}T${pad(hour)}:${pad(minute)}:00+05:30`;
    return new Date(isoWithOffset).toISOString();
  }

  // Fallback for general timezones
  return new Date(`${dateStr}T${pad(hour)}:${pad(minute)}:00`).toISOString();
}

/**
 * Formats a Date object into "h:mm A" (e.g. "3:00 PM") in Asia/Kolkata
 */
export function formatDateTimeInTz(date: Date | string, timeZone: string = DEFAULT_TZ): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Formats a meeting time range: "3:00–3:30 PM"
 */
export function formatMeetingTimeRange(start: Date | string, end?: Date | string | null, timeZone: string = DEFAULT_TZ): string {
  const s = typeof start === "string" ? new Date(start) : start;
  const startFormatted = formatDateTimeInTz(s, timeZone);
  if (!end) return startFormatted;

  const e = typeof end === "string" ? new Date(end) : end;
  const endFormatted = formatDateTimeInTz(e, timeZone);

  // If both are PM or both are AM, simplify: e.g. "3:00–3:30 PM"
  const startParts = startFormatted.split(" ");
  const endParts = endFormatted.split(" ");
  if (startParts[1] === endParts[1]) {
    return `${startParts[0]}–${endParts[0]} ${endParts[1]}`;
  }
  return `${startFormatted}–${endFormatted}`;
}

export type UpcomingSection =
  | "overdue"
  | "today"
  | "tomorrow"
  | "thisWeek"
  | "later"
  | "noDate"
  | "done";

export interface UpcomingDateItemInput {
  dueAt: Date | string | null | undefined;
  endAt?: Date | string | null | undefined;
  hasTime?: boolean;
  snoozedUntil?: Date | string | null | undefined;
  doneAt?: Date | string | null | undefined;
}

export interface UpcomingDateInfo {
  dateStr: string | null;           // "YYYY-MM-DD" in Asia/Kolkata or null
  timeDisplay: string;              // "10:05 AM", "10:00–10:30 AM", "All day", or ""
  isOverdue: boolean;               // true if active and item local date < today in Asia/Kolkata
  isToday: boolean;                 // true if item local date === today in Asia/Kolkata
  isTomorrow: boolean;              // true if item local date === tomorrow in Asia/Kolkata
  isThisWeek: boolean;              // true if item local date > tomorrow and <= today + 7 days
  isSnoozed: boolean;               // true if snoozedUntil is in the future
  section: UpcomingSection;         // "overdue" | "today" | "tomorrow" | "thisWeek" | "later" | "noDate" | "done"
  relativeLabel: string;            // Subtitle label: "Today", "Tomorrow", "Tue, 3 Nov" (or with year), "Completed", "No date"
  detailDateDisplay: string;        // Expanded details: "Tue, 3 Nov 2026 · 10:05 AM" or "Tue, 3 Nov 2026 · All day", or "No date set"
}

/**
 * Unified function that converts due_at to a local date in Asia/Kolkata and computes:
 * - Local YYYY-MM-DD date string
 * - Section grouping (Overdue, Today, Tomorrow, This week, Later, No date, Done)
 * - Human subtitle relative label ("Today", "Tomorrow", "Tue, 3 Nov", never raw ISO)
 * - Expanded detail date display ("Tue, 3 Nov 2026 · 10:05 AM", never raw ISO)
 * - Overdue and snooze status
 */
export function getUpcomingDateInfo(
  item: UpcomingDateItemInput,
  referenceNow: Date | string = new Date(),
  timeZone: string = DEFAULT_TZ
): UpcomingDateInfo {
  const now = typeof referenceNow === "string" ? new Date(referenceNow) : referenceNow;
  const isDone = !!item.doneAt;

  // 1. Snooze check (snoozed items are paused, never overdue while snooze is active)
  const isSnoozed =
    !isDone && !!(item.snoozedUntil && new Date(item.snoozedUntil).getTime() > now.getTime());

  // 2. Handle NO DATE
  if (!item.dueAt) {
    return {
      dateStr: null,
      timeDisplay: "",
      isOverdue: false,
      isToday: false,
      isTomorrow: false,
      isThisWeek: false,
      isSnoozed: false,
      section: isDone ? "done" : "noDate",
      relativeLabel: isDone ? "Completed" : "No date",
      detailDateDisplay: "No date set",
    };
  }

  // 3. Local date string in Asia/Kolkata
  const dueDate = typeof item.dueAt === "string" ? new Date(item.dueAt) : item.dueAt;
  const dateStr = getDateStringInTz(dueDate, timeZone);
  const todayStr = getDateStringInTz(now, timeZone);
  const tomorrowStr = addDaysToDate(todayStr, 1);
  const endOfWeekStr = addDaysToDate(todayStr, 7);

  // Time display
  let timeDisplay = "";
  if (item.hasTime) {
    if (item.endAt) {
      timeDisplay = formatMeetingTimeRange(dueDate, item.endAt, timeZone);
    } else {
      timeDisplay = formatDateTimeInTz(dueDate, timeZone);
    }
  } else {
    timeDisplay = "All day";
  }

  // Format parts for readable dates
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(dueDate);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const weekdayShort = getPart("weekday");
  const day = getPart("day");
  const monthShort = getPart("month");
  const year = getPart("year");

  // Current year in target timezone
  const currentYear = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
  }).format(now);

  const formattedSubtitleDate =
    year === currentYear
      ? `${weekdayShort}, ${day} ${monthShort}`
      : `${weekdayShort}, ${day} ${monthShort} ${year}`;

  const fullDate = `${weekdayShort}, ${day} ${monthShort} ${year}`;

  // Subtitle relative label: "Today", "Tomorrow", or "Tue, 3 Nov" (with year if not current year)
  let relativeLabel = "";
  if (isDone) {
    relativeLabel = "Completed";
  } else if (dateStr === todayStr) {
    relativeLabel = "Today";
  } else if (dateStr === tomorrowStr) {
    relativeLabel = "Tomorrow";
  } else {
    relativeLabel = formattedSubtitleDate;
  }

  // Expanded detail date display: "Tue, 3 Nov 2026 · 10:05 AM"
  const detailDateDisplay =
    item.hasTime && timeDisplay
      ? `${fullDate} · ${timeDisplay}`
      : `${fullDate} · All day`;

  // Comparisons & Section
  const isToday = dateStr === todayStr;
  const isTomorrow = dateStr === tomorrowStr;
  const isThisWeek = dateStr > tomorrowStr && dateStr <= endOfWeekStr;
  const isOverdue = !isDone && !isSnoozed && dateStr < todayStr;

  let section: UpcomingSection;
  if (isDone) {
    section = "done";
  } else if (isOverdue) {
    section = "overdue";
  } else if (isToday) {
    section = "today";
  } else if (isTomorrow) {
    section = "tomorrow";
  } else if (isThisWeek) {
    section = "thisWeek";
  } else {
    section = "later";
  }

  return {
    dateStr,
    timeDisplay,
    isOverdue,
    isToday,
    isTomorrow,
    isThisWeek,
    isSnoozed,
    section,
    relativeLabel,
    detailDateDisplay,
  };
}

/**
 * Generates human relative label for upcoming item (e.g. "Today", "Tomorrow", "Tue, 3 Nov")
 */
export function getRelativeDateLabel(targetDateStr: string, todayStr: string = getTodayDateString()): string {
  if (targetDateStr === todayStr) return "Today";
  const tomorrowStr = addDaysToDate(todayStr, 1);
  if (targetDateStr === tomorrowStr) return "Tomorrow";

  const [year, month, day] = targetDateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const currentYear = todayStr.split("-")[0];
  const targetYear = String(year);

  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).formatToParts(d);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const weekday = getPart("weekday");
  const dayStr = getPart("day");
  const monthStr = getPart("month");

  if (targetYear === currentYear) {
    return `${weekday}, ${dayStr} ${monthStr}`;
  }
  return `${weekday}, ${dayStr} ${monthStr} ${targetYear}`;
}

/**
 * Calculates next recurrence date in Asia/Kolkata timezone
 */
export function computeNextRecurrence(
  currentDueAt: Date | string,
  repeat: "daily" | "weekly" | "monthly",
  timeZone: string = DEFAULT_TZ
): Date {
  const current = typeof currentDueAt === "string" ? new Date(currentDueAt) : currentDueAt;
  const next = new Date(current);

  if (repeat === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (repeat === "weekly") {
    next.setDate(next.getDate() + 7);
  } else if (repeat === "monthly") {
    next.setMonth(next.getMonth() + 1);
  }

  return next;
}

/**
 * Generates backup filename formatted as ninaivo-backup-YYYY-MM-DD-HHmm.json in user's timezone
 */
export function getBackupFilename(timeZone: string = DEFAULT_TZ): string {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
    return `ninaivo-backup-${get("year")}-${get("month")}-${get("day")}-${get("hour")}${get("minute")}.json`;
  } catch {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `ninaivo-backup-${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}.json`;
  }
}

