import { Context, Next } from "hono";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";

/**
 * Middleware that authenticates via x-api-key header.
 * Looks up the API key by its prefix (first 16 chars), then bcrypt-compares.
 * Sets merchant and merchantId on context just like JWT auth.
 */
export async function apiKeyAuth(c: Context, next: Next) {
  const apiKey = c.req.header("x-api-key");

  if (!apiKey) {
    return c.json({ error: "Missing x-api-key header" }, 401);
  }

  const prefix = apiKey.substring(0, 16);

  try {
    // Find active keys matching this prefix
    const keys = await prisma.apiKey.findMany({
      where: { key_prefix: prefix, active: true },
      include: { merchant: true },
    });

    for (const key of keys) {
      const match = await bcrypt.compare(apiKey, key.key_hash);
      if (match) {
        c.set("merchant", key.merchant);
        c.set("merchantId", key.merchant.id);

        // Fire-and-forget: update last_used_at
        prisma.apiKey.update({
          where: { id: key.id },
          data: { last_used_at: new Date() },
        }).catch(() => {});

        await next();
        return;
      }
    }

    return c.json({ error: "Invalid API key" }, 401);
  } catch (err) {
    return c.json({ error: "Authentication failed" }, 401);
  }
}
