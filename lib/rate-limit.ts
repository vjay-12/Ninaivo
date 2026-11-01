// In-memory sliding rate limiter for sensitive actions (export / restore)
const requestCounts = new Map<string, { count: number; expiresAt: number }>();

export function checkRateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60000
): { success: boolean; remaining: number } {
  const now = Date.now();
  const record = requestCounts.get(key);

  if (!record || now > record.expiresAt) {
    requestCounts.set(key, { count: 1, expiresAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0 };
  }

  record.count += 1;
  return { success: true, remaining: limit - record.count };
}

