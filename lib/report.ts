import { db } from "@/db";
import { items, dailyLogs, Item, DailyLog } from "@/db/schema";
import { eq, and, gte, lte, desc, asc, sql } from "drizzle-orm";
import { getTodayDateString, addDaysToDate, getWeekdayFromDate } from "@/lib/date";

export type ReportRange = "week" | "month" | "all";

export interface DailyTrendPoint {
  date: string;
  dayShort: string;
  completed: number;
  total: number;
  percentage: number;
}

export interface HeatmapDay {
  date: string;
  level: number; // 0 to 4
  percentage: number;
  completed: number;
  total: number;
}

export interface ItemPerformance {
  id: number;
  name: string;
  type: string;
  targetCount: number;
  daysCompleted: number;
  totalDays: number;
  percentage: number;
  avgCount: number;
}

export interface WeekdayStats {
  weekday: number;
  name: string;
  completionRate: number;
  totalLogs: number;
}

export interface ReportData {
  range: ReportRange;
  overallCompletion: number;
  currentStreak: number;
  bestStreak: number;
  perfectDaysCount: number;
  trend: DailyTrendPoint[];
  heatmap: HeatmapDay[];
  itemsPerformance: ItemPerformance[];
  diet: {
    fruitsAvg: number;
    fruitsTarget: number;
    eggDaysDone: number;
    eggDaysTotal: number;
    eggRate: number;
  };
  bestWeekday: string;
  worstWeekday: string;
  insights: string[];
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function computeReport(range: ReportRange = "month"): Promise<ReportData> {
  const today = getTodayDateString();

  let daysBack = 30;
  if (range === "week") daysBack = 7;
  else if (range === "month") daysBack = 30;
  else daysBack = 90; // for 'all', examine up to 90 days for trends

  const startDate = addDaysToDate(today, -(daysBack - 1));

  // 1. Fetch active items
  const allItems = await db.select().from(items).where(eq(items.active, true));
  const totalActiveItems = allItems.length || 1;

  // 2. Fetch all logs in range
  const logsInRange = await db
    .select()
    .from(dailyLogs)
    .where(and(gte(dailyLogs.logDate, startDate), lte(dailyLogs.logDate, today)))
    .orderBy(asc(dailyLogs.logDate));

  // Map of date -> logs
  const dateLogsMap = new Map<string, DailyLog[]>();
  for (const log of logsInRange) {
    const list = dateLogsMap.get(log.logDate) || [];
    list.push(log);
    dateLogsMap.set(log.logDate, list);
  }

  // 3. Daily Trend Points
  const trend: DailyTrendPoint[] = [];
  let totalPctSum = 0;
  let perfectDaysCount = 0;

  for (let i = 0; i < daysBack; i++) {
    const dateStr = addDaysToDate(startDate, i);
    const logs = dateLogsMap.get(dateStr) || [];
    const completedCount = logs.filter((l) => l.done).length;
    const pct = totalActiveItems > 0 ? Math.round((completedCount / totalActiveItems) * 100) : 0;

    totalPctSum += pct;
    if (completedCount >= totalActiveItems && totalActiveItems > 0) {
      perfectDaysCount++;
    }

    const weekday = getWeekdayFromDate(dateStr);
    trend.push({
      date: dateStr,
      dayShort: WEEKDAY_NAMES[weekday].slice(0, 3),
      completed: completedCount,
      total: totalActiveItems,
      percentage: pct,
    });
  }

  const overallCompletion = daysBack > 0 ? Math.round(totalPctSum / daysBack) : 0;

  // 4. Streaks (calculated across all history)
  const allLogs = await db
    .select({
      logDate: dailyLogs.logDate,
      doneCount: sql<number>`count(*) filter (where ${dailyLogs.done} = true)`,
    })
    .from(dailyLogs)
    .groupBy(dailyLogs.logDate)
    .orderBy(desc(dailyLogs.logDate));

  let currentStreak = 0;
  let bestStreak = 0;
  let runningStreak = 0;

  const doneDateSet = new Set(
    allLogs
      .filter((r) => Number(r.doneCount) >= totalActiveItems && totalActiveItems > 0)
      .map((r) => r.logDate)
  );

  // Best streak
  const sortedDates = Array.from(doneDateSet).sort();
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      runningStreak = 1;
    } else {
      const prevDate = sortedDates[i - 1];
      const nextExpected = addDaysToDate(prevDate, 1);
      if (sortedDates[i] === nextExpected) {
        runningStreak++;
      } else {
        runningStreak = 1;
      }
    }
    bestStreak = Math.max(bestStreak, runningStreak);
  }

  // Current streak (from today or yesterday)
  let checkDate = today;
  if (doneDateSet.has(checkDate)) {
    currentStreak++;
    checkDate = addDaysToDate(checkDate, -1);
  } else {
    const yesterday = addDaysToDate(today, -1);
    if (doneDateSet.has(yesterday)) {
      currentStreak++;
      checkDate = addDaysToDate(yesterday, -1);
    }
  }
  while (doneDateSet.has(checkDate)) {
    currentStreak++;
    checkDate = addDaysToDate(checkDate, -1);
  }
  bestStreak = Math.max(bestStreak, currentStreak);

  // 5. Heatmap (last 42 days / 6 weeks or daysBack)
  const heatmapDays = Math.max(daysBack, 35);
  const heatmapStart = addDaysToDate(today, -(heatmapDays - 1));
  const heatmap: HeatmapDay[] = [];

  for (let i = 0; i < heatmapDays; i++) {
    const dStr = addDaysToDate(heatmapStart, i);
    const logs = dateLogsMap.get(dStr) || [];
    const doneCount = logs.filter((l) => l.done).length;
    const pct = totalActiveItems > 0 ? (doneCount / totalActiveItems) * 100 : 0;

    let level = 0;
    if (pct >= 100) level = 4;
    else if (pct >= 75) level = 3;
    else if (pct >= 50) level = 2;
    else if (pct > 0) level = 1;

    heatmap.push({
      date: dStr,
      level,
      percentage: Math.round(pct),
      completed: doneCount,
      total: totalActiveItems,
    });
  }

  // 6. Per-item performance
  const itemMap = new Map<number, { doneDays: number; totalCount: number }>();
  for (const log of logsInRange) {
    const cur = itemMap.get(log.itemId) || { doneDays: 0, totalCount: 0 };
    if (log.done) cur.doneDays++;
    cur.totalCount += log.count;
    itemMap.set(log.itemId, cur);
  }

  const itemsPerformance: ItemPerformance[] = allItems.map((item) => {
    const stats = itemMap.get(item.id) || { doneDays: 0, totalCount: 0 };
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      targetCount: item.targetCount,
      daysCompleted: stats.doneDays,
      totalDays: daysBack,
      percentage: Math.round((stats.doneDays / daysBack) * 100),
      avgCount: Number((stats.totalCount / daysBack).toFixed(1)),
    };
  });

  // 7. Diet Stats
  const fruitsItem = allItems.find((i) => i.name.toLowerCase().includes("fruit"));
  const eggItem = allItems.find((i) => i.name.toLowerCase().includes("egg"));

  const fruitsStats = fruitsItem ? itemMap.get(fruitsItem.id) : null;
  const fruitsAvg = fruitsStats ? Number((fruitsStats.totalCount / daysBack).toFixed(1)) : 0;

  const eggStats = eggItem ? itemMap.get(eggItem.id) : null;
  const eggDaysDone = eggStats ? eggStats.doneDays : 0;
  const eggRate = Math.round((eggDaysDone / daysBack) * 100);

  // 8. Best and worst weekday analysis
  const weekdayTotals = Array(7).fill(0);
  const weekdayDones = Array(7).fill(0);

  for (const log of logsInRange) {
    const w = getWeekdayFromDate(log.logDate);
    weekdayTotals[w]++;
    if (log.done) weekdayDones[w]++;
  }

  const weekdayRates = weekdayTotals.map((tot, idx) => {
    const rate = tot > 0 ? (weekdayDones[idx] / tot) * 100 : 0;
    return { weekday: idx, name: WEEKDAY_NAMES[idx], rate };
  });

  const validWeekdays = weekdayRates.filter((w) => weekdayTotals[w.weekday] > 0);
  validWeekdays.sort((a, b) => b.rate - a.rate);

  const bestWeekday = validWeekdays.length > 0 ? `${validWeekdays[0].name} (${Math.round(validWeekdays[0].rate)}%)` : "N/A";
  const worstWeekday =
    validWeekdays.length > 1
      ? `${validWeekdays[validWeekdays.length - 1].name} (${Math.round(validWeekdays[validWeekdays.length - 1].rate)}%)`
      : "N/A";

  // 9. Auto-insights generation
  const insights: string[] = [];

  if (perfectDaysCount > 0) {
    insights.push(`You have achieved ${perfectDaysCount} perfect routine days in this period.`);
  }

  // Find lowest performing item
  if (itemsPerformance.length > 0) {
    const sortedItems = [...itemsPerformance].sort((a, b) => a.percentage - b.percentage);
    const lowest = sortedItems[0];
    if (lowest.percentage < 80) {
      insights.push(`Routine "${lowest.name}" has the lowest consistency at ${lowest.percentage}%. Focus on locking this in early in the day.`);
    } else {
      insights.push(`All your daily habits are operating above 80% consistency. Outstanding discipline!`);
    }
  }

  if (fruitsItem && fruitsAvg < (fruitsItem.targetCount || 3)) {
    insights.push(`Fruit intake is currently averaging ${fruitsAvg} / ${fruitsItem.targetCount} portions daily.`);
  } else if (fruitsItem) {
    insights.push(`Fruit nutritional goal is on track at ${fruitsAvg} portions daily.`);
  }

  if (validWeekdays.length > 1) {
    const worst = validWeekdays[validWeekdays.length - 1];
    insights.push(`Performance drops most on ${worst.name}s (${Math.round(worst.rate)}% completion). Plan ahead for this day.`);
  }

  return {
    range,
    overallCompletion,
    currentStreak,
    bestStreak,
    perfectDaysCount,
    trend,
    heatmap,
    itemsPerformance,
    diet: {
      fruitsAvg,
      fruitsTarget: fruitsItem?.targetCount || 3,
      eggDaysDone,
      eggDaysTotal: daysBack,
      eggRate,
    },
    bestWeekday,
    worstWeekday,
    insights,
  };
}

export async function exportAllData() {
  const allItems = await db.select().from(items).orderBy(asc(items.id));
  const allDailyLogs = await db.select().from(dailyLogs).orderBy(asc(dailyLogs.logDate));
  const allWeekly = await db.select().from(items).orderBy(asc(items.id));
  const allWeeklyTasks = await db.select().from(items).orderBy(asc(items.id));

  return {
    exportedAt: new Date().toISOString(),
    items: allItems,
    dailyLogs: allDailyLogs,
  };
}

