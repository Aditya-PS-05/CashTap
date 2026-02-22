import { Hono } from "hono";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { signToken, signRefreshToken, verifyToken } from "../middleware/auth.js";

const auth = new Hono();

// In-memory challenge store (swap for Redis in production)
const challengeStore = new Map<
  string,
  { nonce: string; createdAt: number }
>();

// Clean up expired challenges every 5 minutes
setInterval(() => {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const [key, value] of challengeStore) {
    if (value.createdAt < fiveMinutesAgo) {
      challengeStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// --- Schemas ---

const challengeSchema = z.object({
  address: z
    .string()
    .min(1, "BCH address is required")
    .regex(
      /^(bitcoincash:|bchtest:)?[qpzrs][a-z0-9]{41,}$/i,
      "Invalid BCH address format"
    ),
});

const verifySchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1, "Signature is required"),
  nonce: z.string().min(1, "Nonce is required"),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1, "Refresh token is required"),
});

// --- Routes ---

/**
 * POST /api/auth/challenge
 * Generate a random challenge nonce for a given BCH address.
 */
auth.post("/challenge", async (c) => {
  const body = await c.req.json();
  const parsed = challengeSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { address } = parsed.data;
  const nonce = crypto.randomBytes(32).toString("hex");

  challengeStore.set(address, { nonce, createdAt: Date.now() });

  const message = `Sign this message to authenticate with BCH Pay:\n\nNonce: ${nonce}\nAddress: ${address}\nTimestamp: ${new Date().toISOString()}`;

  return c.json({
    nonce,
    message,
    expires_in: 300, // 5 minutes
  });
});

/**
 * POST /api/auth/verify
 * Verify a signed challenge and issue JWT + refresh token.
 *
 * NOTE: In production, this should verify the actual BCH signature
 * using a library like bitcore-lib-cash or @bitauth/libauth.
 * For now we do a simplified check: verify the nonce matches.
 */
auth.post("/verify", async (c) => {
  const body = await c.req.json();
  const parsed = verifySchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { address, signature, nonce } = parsed.data;

  // Check that we issued this challenge
  const challenge = challengeStore.get(address);
  if (!challenge) {
    return c.json({ error: "No pending challenge for this address" }, 400);
  }

  // Check expiration (5 minutes)
  if (Date.now() - challenge.createdAt > 5 * 60 * 1000) {
    challengeStore.delete(address);
    return c.json({ error: "Challenge expired" }, 400);
  }

  // Check nonce matches
  if (challenge.nonce !== nonce) {
    return c.json({ error: "Invalid nonce" }, 400);
  }

  // TODO: Verify the actual BCH signature against the message + address
  // For now, accept any non-empty signature (development mode)
  if (!signature || signature.length === 0) {
    return c.json({ error: "Invalid signature" }, 400);
  }

  // Clean up used challenge
  challengeStore.delete(address);

  // Find or create merchant
  let merchant = await prisma.merchant.findUnique({
    where: { bch_address: address },
  });

  if (!merchant) {
    merchant = await prisma.merchant.create({
      data: {
        bch_address: address,
        business_name: `Merchant ${address.slice(-8)}`,
      },
    });
  }

  const accessToken = signToken(merchant.id, address);
  const refreshToken = signRefreshToken(merchant.id, address);

  return c.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: 86400, // 24 hours
    merchant: {
      id: merchant.id,
      bch_address: merchant.bch_address,
      business_name: merchant.business_name,
    },
  });
});

/**
 * POST /api/auth/refresh
 * Refresh an expired access token using a valid refresh token.
 */
auth.post("/refresh", async (c) => {
  const body = await c.req.json();
  const parsed = refreshSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { refresh_token } = parsed.data;

  try {
    const payload = verifyToken(refresh_token);

    const merchant = await prisma.merchant.findUnique({
      where: { id: payload.merchantId },
    });

    if (!merchant) {
      return c.json({ error: "Merchant not found" }, 401);
    }

    const accessToken = signToken(merchant.id, merchant.bch_address);
    const newRefreshToken = signRefreshToken(
      merchant.id,
      merchant.bch_address
    );

    return c.json({
      access_token: accessToken,
      refresh_token: newRefreshToken,
      token_type: "Bearer",
      expires_in: 86400,
    });
  } catch {
    return c.json({ error: "Invalid or expired refresh token" }, 401);
  }
});

export default auth;
