/**
 * In-memory rate limiter for AI endpoints.
 * For production, replace with Redis-backed sliding window.
 */

interface RateLimitRecord {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitRecord>();

const MAX_REQUESTS = parseInt(process.env.AI_RATE_LIMIT_REQUESTS ?? "10");
const WINDOW_MS = parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS ?? "60000");

export function checkRateLimit(key: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const record = store.get(key);

  if (!record || now - record.windowStart > WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetAt: now + WINDOW_MS };
  }

  if (record.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.windowStart + WINDOW_MS,
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: MAX_REQUESTS - record.count,
    resetAt: record.windowStart + WINDOW_MS,
  };
}

export function cleanupRateLimiter(): void {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now - record.windowStart > WINDOW_MS * 2) {
      store.delete(key);
    }
  }
}
