import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { prisma } from "../lib/prisma.js";
import type { AppEnv } from "../types/hono.js";

const events = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// In-memory event bus
// ---------------------------------------------------------------------------

type EventListener = (event: SSEEvent) => void;

interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

const listeners = new Map<string, Set<EventListener>>();

function addListener(merchantId: string, listener: EventListener) {
  let set = listeners.get(merchantId);
  if (!set) {
    set = new Set();
    listeners.set(merchantId, set);
  }
  set.add(listener);
}

function removeListener(merchantId: string, listener: EventListener) {
  const set = listeners.get(merchantId);
  if (set) {
    set.delete(listener);
    if (set.size === 0) listeners.delete(merchantId);
  }
}

/**
 * Emit an event to all connected SSE clients for a merchant.
 */
export function emitEvent(merchantId: string, type: string, data: Record<string, unknown>) {
  const set = listeners.get(merchantId);
  if (!set || set.size === 0) return;
  for (const listener of set) {
    try {
      listener({ type, data });
    } catch {
      // Ignore errors from individual listeners
    }
  }
}

// ---------------------------------------------------------------------------
// SSE endpoint
// ---------------------------------------------------------------------------

events.get("/", async (c) => {
  // SSE doesn't support custom headers, so accept token via query param
  const token = c.req.query("token");
  if (!token) {
    return c.json({ error: "Missing token query parameter", code: "UNAUTHORIZED" }, 401);
  }

  // Verify the token by checking the session API pattern
  // The token is the JWT accessToken from auth
  let merchantId: string | null = null;
  try {
    // Decode JWT to get merchant ID (same as authMiddleware)
    const { verifyToken } = await import("../middleware/auth.js");
    const payload = verifyToken(token);
    merchantId = payload.merchantId || null;
  } catch {
    // Fallback: try to find merchant by looking up the token as an API key
    try {
      const crypto = await import("crypto");
      const keyHash = crypto.createHash("sha256").update(token).digest("hex");
      const apiKey = await prisma.apiKey.findFirst({
        where: { key_hash: keyHash, active: true },
      });
      if (apiKey) merchantId = apiKey.merchant_id;
    } catch {
      // Neither worked
    }
  }

  if (!merchantId) {
    return c.json({ error: "Invalid token", code: "UNAUTHORIZED" }, 401);
  }

  const mid = merchantId;

  return streamSSE(c, async (stream) => {
    let alive = true;

    const listener: EventListener = (event) => {
      if (!alive) return;
      stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event.data),
      }).catch(() => {
        alive = false;
      });
    };

    addListener(mid, listener);

    // Send initial connection event
    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({ message: "Connected to BCH Pay events" }),
    });

    // 30s heartbeat keepalive
    const heartbeat = setInterval(() => {
      if (!alive) {
        clearInterval(heartbeat);
        return;
      }
      stream.writeSSE({
        event: "heartbeat",
        data: JSON.stringify({ time: Date.now() }),
      }).catch(() => {
        alive = false;
        clearInterval(heartbeat);
      });
    }, 30_000);

    // Wait for abort
    stream.onAbort(() => {
      alive = false;
      clearInterval(heartbeat);
      removeListener(mid, listener);
    });

    // Keep the stream open by waiting indefinitely
    // The stream will be closed when the client disconnects
    while (alive) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    clearInterval(heartbeat);
    removeListener(mid, listener);
  });
});

export default events;
