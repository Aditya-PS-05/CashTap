import { Context, Next } from "hono";
import { authMiddleware } from "./auth.js";
import { apiKeyAuth } from "./api-key-auth.js";

/**
 * Combined auth middleware: accepts either JWT Bearer token or x-api-key.
 * - If Authorization: Bearer ... → delegate to JWT authMiddleware
 * - Else if x-api-key header → delegate to apiKeyAuth
 * - Else → 401
 */
export async function combinedAuth(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  const apiKey = c.req.header("x-api-key");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authMiddleware(c, next);
  }

  if (apiKey) {
    return apiKeyAuth(c, next);
  }

  return c.json({ error: "Authentication required. Provide Authorization header or x-api-key." }, 401);
}
