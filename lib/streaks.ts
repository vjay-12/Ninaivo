import { db } from "@/db";
import { dailyLogs } from "@/db/schema";
import { eq, and, lte, desc } from "drizzle-orm";
import { addDaysToDate } from "@/lib/date";

/**
 * Calculates current streak for an item as of today's date
 */
export async function calculateItemStreak(itemId: number, todayStr: string): Promise<number> {
  const logs = await db
    .select({
      logDate: dailyLogs.logDate,
      done: dailyLogs.done,
    })
    .from(dailyLogs)
    .where(and(eq(dailyLogs.itemId, itemId), eq(dailyLogs.done, true), lte(dailyLogs.logDate, todayStr)))
    .orderBy(desc(dailyLogs.logDate))
    .limit(365);

  if (logs.length === 0) return 0;

  const datesDone = new Set(logs.map((l) => l.logDate));

  let streak = 0;
  let checkDate = todayStr;

  // If today is completed, count it
  if (datesDone.has(checkDate)) {
    streak++;
    checkDate = addDaysToDate(checkDate, -1);
  } else {
    // If today is not yet completed, check if yesterday was completed
    const yesterday = addDaysToDate(todayStr, -1);
    if (!datesDone.has(yesterday)) {
      return 0; // streak broken
    }
    checkDate = yesterday;
  }

  // Count backwards day by day
  while (datesDone.has(checkDate)) {
    streak++;
    checkDate = addDaysToDate(checkDate, -1);
  }

  return streak;
}

