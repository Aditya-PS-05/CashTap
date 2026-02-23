import { Hono } from "hono";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { signToken, signRefreshToken, verifyToken } from "../middleware/auth.js";
import {
  secp256k1,
  sha256,
  hash160,
  decodeCashAddress,
} from "@bitauth/libauth";

const auth = new Hono();

// Challenge store with TTL — uses Redis when REDIS_URL is set, else in-memory Map.
interface ChallengeEntry {
  nonce: string;
  createdAt: number;
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let challengeStore: {
  get(key: string): Promise<ChallengeEntry | undefined>;
  set(key: string, value: ChallengeEntry): Promise<void>;
  delete(key: string): Promise<void>;
};

// Try to use Redis if available, else fall back to in-memory Map
const redisUrl = process.env.REDIS_URL;

if (redisUrl) {
  // Dynamic import to avoid hard dependency
  let redisClient: any = null;

  (async () => {
    try {
      const { createClient } = await import("redis" as any);
      redisClient = createClient({ url: redisUrl });
      redisClient.on("error", (err: any) => console.error("[Redis] Error:", err));
      await redisClient.connect();
      console.log("[Auth] Using Redis challenge store");
    } catch {
      console.log("[Auth] Redis not available, using in-memory challenge store");
      redisClient = null;
    }
  })();

  challengeStore = {
    async get(key: string) {
      if (!redisClient?.isOpen) return memoryStore.get(key);
      const val = await redisClient.get(`auth:challenge:${key}`);
      return val ? JSON.parse(val) : undefined;
    },
    async set(key: string, value: ChallengeEntry) {
      if (!redisClient?.isOpen) {
        memoryStore.set(key, value);
        return;
      }
      await redisClient.set(
        `auth:challenge:${key}`,
        JSON.stringify(value),
        { EX: Math.ceil(CHALLENGE_TTL_MS / 1000) }
      );
    },
    async delete(key: string) {
      if (!redisClient?.isOpen) {
        memoryStore.delete(key);
        return;
      }
      await redisClient.del(`auth:challenge:${key}`);
    },
  };
} else {
  challengeStore = {
    async get(key: string) { return memoryStore.get(key); },
    async set(key: string, value: ChallengeEntry) { memoryStore.set(key, value); },
    async delete(key: string) { memoryStore.delete(key); },
  };
}

// In-memory fallback
const memoryStore = new Map<string, ChallengeEntry>();

// Clean up expired in-memory challenges every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - CHALLENGE_TTL_MS;
  for (const [key, value] of memoryStore) {
    if (value.createdAt < cutoff) {
      memoryStore.delete(key);
    }
  }
}, CHALLENGE_TTL_MS);

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

// --- Signature Verification ---

/**
 * Verify a Bitcoin Signed Message signature against a BCH CashAddr address.
 *
 * Format: double-sha256("\x18Bitcoin Signed Message:\n" + varint(len) + message)
 * Signature: 65-byte recoverable compact (recovery_id + r + s)
 */
function verifyBchSignature(
  address: string,
  message: string,
  signatureBase64: string
): boolean {
  try {
    // Decode the base64 signature (65 bytes: 1 recovery_flag + 32 r + 32 s)
    const sigBytes = Buffer.from(signatureBase64, "base64");
    if (sigBytes.length !== 65) return false;

    const recoveryFlag = sigBytes[0];
    const compactSig = sigBytes.slice(1); // 64 bytes: r + s

    // Extract recovery ID from flag byte
    // Flag = 27 + recoveryId + (compressed ? 4 : 0)
    const recoveryId = ((recoveryFlag - 27) & 3) as 0 | 1 | 2 | 3;

    // Build the message hash (Bitcoin Signed Message format)
    const prefix = "\x18Bitcoin Signed Message:\n";
    const msgBytes = new TextEncoder().encode(message);
    const prefixBytes = new TextEncoder().encode(prefix);

    // Varint encoding for message length (simplified — up to 252 bytes)
    const lenByte = new Uint8Array([msgBytes.length & 0xff]);

    const fullMsg = new Uint8Array(prefixBytes.length + lenByte.length + msgBytes.length);
    fullMsg.set(prefixBytes, 0);
    fullMsg.set(lenByte, prefixBytes.length);
    fullMsg.set(msgBytes, prefixBytes.length + lenByte.length);

    const hash1 = sha256.hash(fullMsg);
    const messageHash = sha256.hash(hash1);

    // Recover the public key from the signature
    const recovered = secp256k1.recoverPublicKeyCompressed(
      compactSig,
      recoveryId,
      messageHash
    );

    if (typeof recovered === "string") {
      // Recovery failed — returned error message
      return false;
    }

    // Verify the signature is valid for this public key
    const valid = secp256k1.verifySignatureCompact(
      compactSig,
      recovered,
      messageHash
    );

    if (!valid) return false;

    // Derive the address from the recovered public key and compare
    const pubKeyHash = hash160(recovered);
    if (typeof pubKeyHash === "string") return false;

    // Decode the provided address to get its payload
    const decoded = decodeCashAddress(address);
    if (typeof decoded === "string") return false;

    // Compare the hash160 of the recovered public key with the address payload
    const addrPayload = decoded.payload;
    if (addrPayload.length !== pubKeyHash.length) return false;

    for (let i = 0; i < addrPayload.length; i++) {
      if (addrPayload[i] !== pubKeyHash[i]) return false;
    }

    return true;
  } catch {
    return false;
  }
}

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

  await challengeStore.set(address, { nonce, createdAt: Date.now() });

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
  const challenge = await challengeStore.get(address);
  if (!challenge) {
    return c.json({ error: "No pending challenge for this address" }, 400);
  }

  // Check expiration (5 minutes)
  if (Date.now() - challenge.createdAt > CHALLENGE_TTL_MS) {
    await challengeStore.delete(address);
    return c.json({ error: "Challenge expired" }, 400);
  }

  // Check nonce matches
  if (challenge.nonce !== nonce) {
    return c.json({ error: "Invalid nonce" }, 400);
  }

  // Reconstruct the challenge message that was signed
  const challengeMessage = `Sign this message to authenticate with BCH Pay:\n\nNonce: ${nonce}\nAddress: ${address}\nTimestamp: ${new Date(challenge.createdAt).toISOString()}`;

  // Verify the BCH signature
  const signatureValid = verifyBchSignature(address, challengeMessage, signature);
  if (!signatureValid) {
    // In development mode, allow any non-empty signature for testing
    if (process.env.NODE_ENV === "production") {
      return c.json({ error: "Invalid signature" }, 401);
    }
    console.log(`[Auth] Signature verification failed for ${address} — allowing in dev mode`);
  }

  // Clean up used challenge
  await challengeStore.delete(address);

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
