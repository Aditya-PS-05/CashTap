import { Context, Next } from "hono";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 100;

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 5 * 60_000);

/**
 * In-memory rate limiter middleware.
 * Limits to 100 requests per minute per API key / merchant ID / IP.
 */
export async function rateLimiter(c: Context, next: Next) {
  // Identify the client by API key, merchant ID, or IP
  const identifier =
    c.req.header("x-api-key")?.substring(0, 16) ||
    (c.get("merchantId") as string | undefined) ||
    c.req.header("x-forwarded-for") ||
    "unknown";

  const now = Date.now();
  let entry = store.get(identifier);

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(identifier, entry);
  }

  entry.count++;

  // Set rate limit headers
  c.header("X-RateLimit-Limit", String(MAX_REQUESTS));
  c.header("X-RateLimit-Remaining", String(Math.max(0, MAX_REQUESTS - entry.count)));
  c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

  if (entry.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    c.header("Retry-After", String(retryAfter));
    return c.json(
      { error: "Rate limit exceeded", retry_after: retryAfter },
      429
    );
  }

  await next();
}
