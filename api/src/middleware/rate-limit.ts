import { Context, Next } from "hono";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000; // 1 minute

// Cleanup stale entries every 5 minutes
const stores = new Set<Map<string, RateLimitEntry>>();

setInterval(() => {
  const now = Date.now();
  for (const store of stores) {
    for (const [key, entry] of store) {
      if (entry.resetAt < now) {
        store.delete(key);
      }
    }
  }
}, 5 * 60_000);

/**
 * Create a rate limiter middleware with a configurable max requests per window.
 */
export function createRateLimiter(maxRequests: number, windowMs: number = WINDOW_MS) {
  const store = new Map<string, RateLimitEntry>();
  stores.add(store);

  return async function rateLimitMiddleware(c: Context, next: Next) {
    // Identify the client by API key, merchant ID, or IP
    const identifier =
      c.req.header("x-api-key")?.substring(0, 16) ||
      (c.get("merchantId") as string | undefined) ||
      c.req.header("x-forwarded-for") ||
      "unknown";

    const now = Date.now();
    let entry = store.get(identifier);

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(identifier, entry);
    }

    entry.count++;

    // Set rate limit headers
    c.header("X-RateLimit-Limit", String(maxRequests));
    c.header("X-RateLimit-Remaining", String(Math.max(0, maxRequests - entry.count)));
    c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      return c.json(
        { error: "Rate limit exceeded", code: "RATE_LIMITED", retry_after: retryAfter },
        429
      );
    }

    await next();
  };
}

/**
 * Default rate limiter: 100 requests per minute.
 */
export const rateLimiter = createRateLimiter(100);

/**
 * Stricter rate limiter for auth endpoints: 10 requests per minute.
 */
export const authRateLimiter = createRateLimiter(10);
