"use server";

import { verifyPinAndCreateSession, clearSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function loginAction(prevState: { error?: string } | null, formData: FormData) {
  const pin = formData.get("pin") as string;
  if (!pin) {
    return { error: "Please enter your PIN" };
  }

  const result = await verifyPinAndCreateSession(pin);
  if (!result.success) {
    return { error: result.error || "Incorrect PIN" };
  }

  redirect("/today");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

