import { Context, Next } from "hono";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "bch-pay-dev-secret-change-me";

export interface JwtPayload {
  merchantId: string;
  address: string;
  iat: number;
  exp: number;
}

/**
 * Middleware that verifies the JWT bearer token and attaches the merchant
 * to the Hono context. Returns 401 if the token is missing or invalid.
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or malformed Authorization header" }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    const merchant = await prisma.merchant.findUnique({
      where: { id: decoded.merchantId },
    });

    if (!merchant) {
      return c.json({ error: "Merchant not found" }, 401);
    }

    c.set("merchant", merchant);
    c.set("merchantId", merchant.id);

    await next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return c.json({ error: "Token expired" }, 401);
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return c.json({ error: "Invalid token" }, 401);
    }
    return c.json({ error: "Authentication failed" }, 401);
  }
}

/**
 * Helper to sign a JWT for a merchant.
 */
export function signToken(merchantId: string, address: string): string {
  return jwt.sign({ merchantId, address }, JWT_SECRET, { expiresIn: "24h" });
}

/**
 * Helper to sign a refresh token (longer-lived).
 */
export function signRefreshToken(
  merchantId: string,
  address: string
): string {
  return jwt.sign({ merchantId, address }, JWT_SECRET, { expiresIn: "7d" });
}

/**
 * Verify a token and return the payload (used in refresh flow).
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
