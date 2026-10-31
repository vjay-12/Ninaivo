"use server";

import { db } from "@/db";
import {
  settings,
  items,
  dailyLogs,
  upcomingItems,
  upcomingCompletions,
  weeklyTasks,
  weeklyLogs,
  futureReminders,
} from "@/db/schema";
import { isUserAuthenticated, verifyPin, saveNewPinHashToDb } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getSettingsData() {
  const rows = await db.select().from(settings);
  const settingsMap: Record<string, any> = {};
  for (const r of rows) {
    settingsMap[r.key] = r.value;
  }
  return settingsMap;
}

export async function updateTimezoneSetting(tz: string) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  await db
    .insert(settings)
    .values({
      key: "timezone",
      value: { tz },
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: { tz } },
    });

  revalidatePath("/settings");
  revalidatePath("/today");
  return { success: true };
}

export async function changePinAction(currentPin: string, newPin: string) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  if (!currentPin) {
    return { success: false, error: "Please enter your current PIN" };
  }

  // 1. Verify current PIN
  const isCurrentValid = await verifyPin(currentPin);
  if (!isCurrentValid) {
    return { success: false, error: "Current PIN is incorrect" };
  }

  // 2. Validate new PIN
  if (!newPin || newPin.length < 4) {
    return { success: false, error: "New PIN must be at least 4 digits" };
  }

  if (newPin === currentPin) {
    return { success: false, error: "New PIN must be different from current PIN" };
  }

  // 3. Save new PIN hash to DB and update session
  await saveNewPinHashToDb(newPin);

  revalidatePath("/settings");
  return {
    success: true,
    message: "PIN changed successfully! Use your new PIN for future logins.",
  };
}

export async function importDatabaseBackup(data: any) {
  const auth = await isUserAuthenticated();
  if (!auth) throw new Error("Unauthorized");

  if (!data || !Array.isArray(data.items)) {
    throw new Error("Invalid backup JSON format");
  }

  // Restore items
  if (data.items.length > 0) {
    for (const item of data.items) {
      await db
        .insert(items)
        .values({
          id: item.id,
          name: item.name,
          type: item.type,
          targetCount: item.targetCount || 1,
          reminderTime: item.reminderTime || null,
          sortOrder: item.sortOrder || 0,
          active: item.active !== false,
        })
        .onConflictDoNothing();
    }
  }

  // Restore daily logs
  if (Array.isArray(data.dailyLogs) && data.dailyLogs.length > 0) {
    for (const log of data.dailyLogs) {
      await db
        .insert(dailyLogs)
        .values({
          itemId: log.itemId,
          logDate: log.logDate,
          count: log.count || 0,
          done: log.done || false,
        })
        .onConflictDoNothing();
    }
  }

  // Restore weekly tasks
  if (Array.isArray(data.weeklyTasks) && data.weeklyTasks.length > 0) {
    for (const task of data.weeklyTasks) {
      await db
        .insert(weeklyTasks)
        .values({
          id: task.id,
          name: task.name,
          weekdays: task.weekdays,
          reminderTime: task.reminderTime || null,
          active: task.active !== false,
        })
        .onConflictDoNothing();
    }
  }

  // Restore weekly logs
  if (Array.isArray(data.weeklyLogs) && data.weeklyLogs.length > 0) {
    for (const wLog of data.weeklyLogs) {
      await db
        .insert(weeklyLogs)
        .values({
          taskId: wLog.taskId,
          logDate: wLog.logDate,
          done: wLog.done || false,
        })
        .onConflictDoNothing();
    }
  }

  // Restore future reminders
  if (Array.isArray(data.futureReminders) && data.futureReminders.length > 0) {
    for (const reminder of data.futureReminders) {
      await db
        .insert(futureReminders)
        .values({
          id: reminder.id,
          title: reminder.title,
          notes: reminder.notes || null,
          dueAt: new Date(reminder.dueAt),
          doneAt: reminder.doneAt ? new Date(reminder.doneAt) : null,
        })
        .onConflictDoNothing();
    }
  }

  // Restore upcoming items
  if (Array.isArray(data.upcomingItems) && data.upcomingItems.length > 0) {
    for (const item of data.upcomingItems) {
      await db
        .insert(upcomingItems)
        .values({
          id: item.id,
          title: item.title,
          type: item.type || "todo",
          dueAt: new Date(item.dueAt),
          endAt: item.endAt ? new Date(item.endAt) : null,
          hasTime: item.hasTime !== false,
          repeat: item.repeat || null,
          notes: item.notes || null,
          doneAt: item.doneAt ? new Date(item.doneAt) : null,
          snoozedUntil: item.snoozedUntil ? new Date(item.snoozedUntil) : null,
        })
        .onConflictDoNothing();
    }
  }

  // Restore upcoming completions
  if (Array.isArray(data.upcomingCompletions) && data.upcomingCompletions.length > 0) {
    for (const comp of data.upcomingCompletions) {
      await db
        .insert(upcomingCompletions)
        .values({
          id: comp.id,
          itemId: comp.itemId,
          occurrenceDate: comp.occurrenceDate,
          completedAt: new Date(comp.completedAt),
        })
        .onConflictDoNothing();
    }
  }

  revalidatePath("/today");
  revalidatePath("/daily");
  revalidatePath("/upcoming");
  revalidatePath("/report");
  return { success: true };
}
