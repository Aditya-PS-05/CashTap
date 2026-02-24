const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3456";

const MAX_RETRIES = 2;

interface ApiFetchOptions extends RequestInit {
  /** Skip auth token injection */
  noAuth?: boolean;
}

/**
 * Shared fetch utility for all dashboard pages.
 * - Auto-injects bearer token from session cookie
 * - Retries up to 2 times with exponential backoff
 * - Handles 429 with Retry-After header
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { noAuth, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);

  // Get access token from session if not explicitly skipping auth
  if (!noAuth && !headers.has("Authorization")) {
    try {
      const sessionRes = await fetch("/api/auth/session", {
        credentials: "include",
      });
      if (sessionRes.ok) {
        const session = await sessionRes.json();
        if (session.accessToken) {
          headers.set("Authorization", `Bearer ${session.accessToken}`);
        }
      }
    } catch {
      // Session check failed, proceed without auth
    }
  }

  if (!headers.has("Content-Type") && fetchOptions.body) {
    headers.set("Content-Type", "application/json");
  }

  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { ...fetchOptions, headers });

      // Handle rate limiting
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000;
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        throw new Error("Rate limited");
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      return (await res.json()) as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 500ms, 1500ms
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
    }
  }

  throw lastError || new Error("Request failed");
}
