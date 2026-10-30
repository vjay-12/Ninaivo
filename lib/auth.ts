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
  // 1. Direct plain PIN support (e.g. APP_PIN=1234)
  if (process.env.APP_PIN && process.env.APP_PIN === pin) {
    const token = await createSessionToken();
    const cookieStore = cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    return { success: true };
  }

  let hash = process.env.APP_PIN_HASH;

  // 2. If hash is set
  if (hash) {
    // If hash has escaped backslashes from .env like \$2a\$10...
    if (hash.startsWith("\\$")) {
      hash = hash.replace(/\\\$/g, "$");
    }

    // If Next.js dotenv-expand truncated $2a$10$ from default seed hash
    if (!hash.startsWith("$2") && hash.includes("MoYL95NaFChTVGu")) {
      hash = "$2a$10$Y1AJAX3I13yIYEYBJDY7IOrE42d5mqg6buXuw/MoYL95NaFChTVGu";
    }

    try {
      const isValid = await bcrypt.compare(pin, hash);
      if (isValid) {
        const token = await createSessionToken();
        const cookieStore = cookies();
        cookieStore.set(COOKIE_NAME, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 30 * 24 * 60 * 60,
        });
        return { success: true };
      }
    } catch {
      // Direct comparison fallback
      if (pin === hash) {
        const token = await createSessionToken();
        const cookieStore = cookies();
        cookieStore.set(COOKIE_NAME, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 30 * 24 * 60 * 60,
        });
        return { success: true };
      }
    }
  }

  // 3. Fallback for default PIN 1234 if unconfigured
  if (!hash && !process.env.APP_PIN && pin === "1234") {
    const token = await createSessionToken();
    const cookieStore = cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    return { success: true };
  }

  return { success: false, error: "Invalid PIN. Try again." };
}

export async function clearSession(): Promise<void> {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
}
