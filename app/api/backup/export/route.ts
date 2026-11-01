import { NextResponse } from "next/server";
import { db } from "@/db";
import { items, dailyLogs, upcomingItems, upcomingCompletions, settings } from "@/db/schema";
import { isUserAuthenticated } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getBackupFilename, DEFAULT_TZ } from "@/lib/date";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await isUserAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting (max 10 exports per minute)
  const ip = req.headers.get("x-forwarded-for") || "local";
  const { success: rateOk } = checkRateLimit(`export-${ip}`, 10, 60000);
  if (!rateOk) {
    return NextResponse.json(
      { error: "Too many export requests. Please wait a minute before trying again." },
      { status: 429 }
    );
  }

  const [
    allItems,
    allDailyLogs,
    allUpcoming,
    allCompletions,
    allSettings,
  ] = await Promise.all([
    db.select().from(items).orderBy(asc(items.sortOrder), asc(items.id)),
    db.select().from(dailyLogs).orderBy(asc(dailyLogs.logDate)),
    db.select().from(upcomingItems).orderBy(asc(upcomingItems.dueAt)),
    db.select().from(upcomingCompletions).orderBy(asc(upcomingCompletions.occurrenceDate)),
    db.select().from(settings),
  ]);

  // Clean settings - strictly strip any secrets, hashes or credentials
  const cleanSettings: Record<string, any> = {};
  for (const s of allSettings) {
    const keyLower = s.key.toLowerCase();
    if (
      keyLower.includes("pin") ||
      keyLower.includes("secret") ||
      keyLower.includes("auth") ||
      keyLower.includes("hash") ||
      keyLower.includes("token") ||
      keyLower.includes("password")
    ) {
      continue;
    }
    cleanSettings[s.key] = s.value;
  }

  const now = new Date();
  const tz = cleanSettings.timezone?.tz || DEFAULT_TZ;
  const filename = getBackupFilename(tz);

  // Record last backup timestamp in settings
  await db
    .insert(settings)
    .values({
      key: "last_backup_at",
      value: { date: now.toISOString() },
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: { date: now.toISOString() } },
    });

  const payload = {
    app: "ninaivo",
    version: 1,
    exportedAt: now.toISOString(),
    timezone: tz,
    counts: {
      items: allItems.length,
      dailyLogs: allDailyLogs.length,
      upcoming: allUpcoming.length,
      completions: allCompletions.length,
      settings: Object.keys(cleanSettings).length,
    },
    data: {
      items: allItems,
      dailyLogs: allDailyLogs,
      upcoming: allUpcoming,
      completions: allCompletions,
      settings: cleanSettings,
    },
  };

  const jsonString = JSON.stringify(payload, null, 2);

  return new Response(jsonString, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

