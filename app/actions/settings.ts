"use server";

import { db } from "@/db";
import { settings } from "@/db/schema";
import { isUserAuthenticated, verifyPin, saveNewPinHashToDb } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { executeRestore } from "@/app/actions/backup";

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
  return executeRestore(data, "merge");
}
