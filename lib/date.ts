export const DEFAULT_TZ = process.env.TZ_DEFAULT || "Asia/Kolkata";

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
  // Create UTC noon to avoid any drift
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
  
  // Calculate offset to Monday (if Sunday (0), Monday was 6 days ago; else weekday - 1)
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

