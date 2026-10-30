import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const COOKIE_NAME = "m_routine_session";
const SESSION_EXPIRY = "30d";

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET || "m_routine_fallback_secret_must_be_32_chars_long!!";
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(): Promise<string> {
  const secretKey = getSecretKey();
  return await new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRY)
    .sign(secretKey);
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey);
    return payload.authenticated === true;
  } catch {
    return false;
  }
}

export async function isUserAuthenticated(): Promise<boolean> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return await verifySessionToken(token);
}

/**
 * Retrieves the custom PIN hash from the database settings table if set,
 * or returns null if relying on environment variables.
 */
export async function getCustomPinHashFromDb(): Promise<string | null> {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "app_pin_hash"))
      .limit(1);

    if (row?.value && typeof row.value === "object" && "hash" in (row.value as any)) {
      return (row.value as any).hash;
    }
  } catch (err) {
    console.error("Error checking custom PIN hash in DB:", err);
  }
  return null;
}

/**
 * Verifies if the provided PIN is valid against the DB hash or ENV hash/PIN
 */
export async function verifyPin(pin: string): Promise<boolean> {
  // 1. Check if database has a custom changed PIN
  const dbHash = await getCustomPinHashFromDb();
  if (dbHash) {
    try {
      const match = await bcrypt.compare(pin, dbHash);
      if (match) return true;
    } catch {
      if (pin === dbHash) return true;
    }
  }

  // 2. Direct plain PIN in ENV (e.g. APP_PIN=1234)
  if (process.env.APP_PIN && process.env.APP_PIN === pin) {
    return true;
  }

  // 3. Bcrypt hash in ENV
  let hash = process.env.APP_PIN_HASH;
  if (hash) {
    if (hash.startsWith("\\$")) {
      hash = hash.replace(/\\\$/g, "$");
    }
    if (!hash.startsWith("$2") && hash.includes("MoYL95NaFChTVGu")) {
      hash = "$2a$10$Y1AJAX3I13yIYEYBJDY7IOrE42d5mqg6buXuw/MoYL95NaFChTVGu";
    }

    try {
      const isValid = await bcrypt.compare(pin, hash);
      if (isValid) return true;
    } catch {
      if (pin === hash) return true;
    }
  }

  // 4. Fallback for default PIN 1234 if no custom hash exists in DB or ENV
  if (!dbHash && !hash && !process.env.APP_PIN && pin === "1234") {
    return true;
  }

  return false;
}

export async function verifyPinAndCreateSession(pin: string): Promise<{ success: boolean; error?: string }> {
  const isValid = await verifyPin(pin);
  if (!isValid) {
    return { success: false, error: "Invalid PIN. Try again." };
  }

  const token = await createSessionToken();
  const cookieStore = cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  return { success: true };
}

/**
 * Saves a new PIN hash to the database settings table.
 */
export async function saveNewPinHashToDb(newPin: string): Promise<void> {
  const newHash = await bcrypt.hash(newPin, 10);
  await db
    .insert(settings)
    .values({
      key: "app_pin_hash",
      value: {
        hash: newHash,
        updatedAt: new Date().toISOString(),
      },
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: {
          hash: newHash,
          updatedAt: new Date().toISOString(),
        },
      },
    });

  // Re-sign session cookie to ensure continued valid access
  const token = await createSessionToken();
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
}
