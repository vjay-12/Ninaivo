import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

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

export async function verifyPinAndCreateSession(pin: string): Promise<{ success: boolean; error?: string }> {
  const hash = process.env.APP_PIN_HASH;
  if (!hash) {
    return { success: false, error: "APP_PIN_HASH environment variable not configured" };
  }

  const isValid = await bcrypt.compare(pin, hash);
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

export async function clearSession(): Promise<void> {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
}

