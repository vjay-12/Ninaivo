import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  items,
  dailyLogs,
  upcomingItems,
  upcomingCompletions,
  settings,
} from "@/db/schema";
import { isUserAuthenticated } from "@/lib/auth";
import { gt, or, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await isUserAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const sinceParam = url.searchParams.get("since");
  const sinceDate = sinceParam && !isNaN(new Date(sinceParam).getTime()) ? new Date(sinceParam) : null;
  const now = new Date();

  try {
    let itemsQuery = db.select().from(items);
    let logsQuery = db.select().from(dailyLogs);
    let upcomingQuery = db.select().from(upcomingItems);
    let completionsQuery = db.select().from(upcomingCompletions);
    let settingsQuery = db.select().from(settings);

    let [
      fetchedItems,
      fetchedLogs,
      fetchedUpcoming,
      fetchedCompletions,
      fetchedSettings,
    ] = await Promise.all([
      sinceDate
        ? db
            .select()
            .from(items)
            .where(or(gt(items.updatedAt, sinceDate), gt(items.deletedAt, sinceDate)))
        : db.select().from(items),

      sinceDate
        ? db
            .select()
            .from(dailyLogs)
            .where(or(gt(dailyLogs.updatedAt, sinceDate), gt(dailyLogs.deletedAt, sinceDate)))
        : db.select().from(dailyLogs),

      sinceDate
        ? db
            .select()
            .from(upcomingItems)
            .where(or(gt(upcomingItems.updatedAt, sinceDate), gt(upcomingItems.deletedAt, sinceDate)))
        : db.select().from(upcomingItems),

      sinceDate
        ? db
            .select()
            .from(upcomingCompletions)
            .where(or(gt(upcomingCompletions.updatedAt, sinceDate), gt(upcomingCompletions.deletedAt, sinceDate)))
        : db.select().from(upcomingCompletions),

      sinceDate
        ? db
            .select()
            .from(settings)
            .where(or(gt(settings.updatedAt, sinceDate), gt(settings.deletedAt, sinceDate)))
        : db.select().from(settings),
    ]);

    // Clean settings to strip any secret / pin hashes
    const cleanSettings = fetchedSettings.filter((s) => {
      const k = s.key.toLowerCase();
      return (
        !k.includes("pin") &&
        !k.includes("secret") &&
        !k.includes("auth") &&
        !k.includes("hash") &&
        !k.includes("token") &&
        !k.includes("password")
      );
    });

    return NextResponse.json({
      serverCursor: now.toISOString(),
      items: fetchedItems.map((item) => ({
        ...item,
        createdAt: item.createdAt?.toISOString(),
        updatedAt: item.updatedAt?.toISOString(),
        deletedAt: item.deletedAt?.toISOString() || null,
      })),
      dailyLogs: fetchedLogs.map((log) => ({
        ...log,
        updatedAt: log.updatedAt?.toISOString(),
        deletedAt: log.deletedAt?.toISOString() || null,
      })),
      upcomingItems: fetchedUpcoming.map((up) => ({
        ...up,
        dueAt: up.dueAt?.toISOString() || null,
        endAt: up.endAt?.toISOString() || null,
        doneAt: up.doneAt?.toISOString() || null,
        snoozedUntil: up.snoozedUntil?.toISOString() || null,
        createdAt: up.createdAt?.toISOString(),
        updatedAt: up.updatedAt?.toISOString(),
        deletedAt: up.deletedAt?.toISOString() || null,
      })),
      upcomingCompletions: fetchedCompletions.map((comp) => ({
        ...comp,
        completedAt: comp.completedAt?.toISOString(),
        updatedAt: comp.updatedAt?.toISOString(),
        deletedAt: comp.deletedAt?.toISOString() || null,
      })),
      settings: cleanSettings.map((s) => ({
        key: s.key,
        uuid: s.uuid,
        value: s.value,
        updatedAt: s.updatedAt?.toISOString(),
        deletedAt: s.deletedAt?.toISOString() || null,
      })),
    });
  } catch (err: any) {
    console.error("[Sync Pull Error]:", err?.message || err);
    return NextResponse.json(
      { error: `Sync pull failed: ${err?.message || "Internal database error"}` },
      { status: 500 }
    );
  }
}
