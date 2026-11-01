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

/**
 * Generates human relative label for upcoming item (e.g. "2 days overdue", "Today", "Tomorrow", "in 3 days")
 */
export function getRelativeDateLabel(targetDateStr: string, todayStr: string = getTodayDateString()): string {
  if (targetDateStr === todayStr) return "Today";

  const [tY, tM, tD] = targetDateStr.split("-").map(Number);
  const [cY, cM, cD] = todayStr.split("-").map(Number);
  const targetUtc = Date.UTC(tY, tM - 1, tD);
  const currentUtc = Date.UTC(cY, cM - 1, cD);

  const diffDays = Math.round((targetUtc - currentUtc) / (1000 * 60 * 60 * 24));

  if (diffDays === -1) return "1 day overdue";
  if (diffDays < -1) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1 && diffDays <= 7) return `in ${diffDays} days`;

  const [year, month, day] = targetDateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
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

