import { Hono } from "hono";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
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

const registerSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

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
  role: z.enum(["MERCHANT", "BUYER"]).optional(),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1, "Refresh token is required"),
});

// --- Signature Verification ---

/**
 * Verify a Bitcoin Signed Message signature against a BCH CashAddr address.
 */
function verifyBchSignature(
  address: string,
  message: string,
  signatureBase64: string
): boolean {
  try {
    const sigBytes = Buffer.from(signatureBase64, "base64");
    if (sigBytes.length !== 65) return false;

    const recoveryFlag = sigBytes[0];
    const compactSig = sigBytes.slice(1);

    const recoveryId = ((recoveryFlag - 27) & 3) as 0 | 1 | 2 | 3;

    const prefix = "\x18Bitcoin Signed Message:\n";
    const msgBytes = new TextEncoder().encode(message);
    const prefixBytes = new TextEncoder().encode(prefix);

    const lenByte = new Uint8Array([msgBytes.length & 0xff]);

    const fullMsg = new Uint8Array(prefixBytes.length + lenByte.length + msgBytes.length);
    fullMsg.set(prefixBytes, 0);
    fullMsg.set(lenByte, prefixBytes.length);
    fullMsg.set(msgBytes, prefixBytes.length + lenByte.length);

    const hash1 = sha256.hash(fullMsg);
    const messageHash = sha256.hash(hash1);

    const recovered = secp256k1.recoverPublicKeyCompressed(
      compactSig,
      recoveryId,
      messageHash
    );

    if (typeof recovered === "string") return false;

    const valid = secp256k1.verifySignatureCompact(
      compactSig,
      recovered,
      messageHash
    );

    if (!valid) return false;

    const pubKeyHash = hash160(recovered);
    if (typeof pubKeyHash === "string") return false;

    const decoded = decodeCashAddress(address);
    if (typeof decoded === "string") return false;

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
 * POST /api/auth/register
 * Register with email + password. Creates user with role=BUYER.
 */
auth.post("/register", async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { email, password } = parsed.data;

  // Check if email already exists
  const existing = await prisma.merchant.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existing) {
    return c.json({ error: "An account with this email already exists" }, 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const merchant = await prisma.merchant.create({
    data: {
      email: email.toLowerCase(),
      password_hash: passwordHash,
      role: "BUYER",
    },
  });

  const accessToken = signToken(merchant.id, merchant.email, merchant.role);
  const refreshToken = signRefreshToken(merchant.id, merchant.email, merchant.role);

  return c.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: 86400,
    user: {
      id: merchant.id,
      email: merchant.email,
      role: merchant.role,
      bch_address: merchant.bch_address,
    },
  }, 201);
});

/**
 * POST /api/auth/login
 * Login with email + password.
 */
auth.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { email, password } = parsed.data;

  const merchant = await prisma.merchant.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!merchant || !merchant.password_hash) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const valid = await bcrypt.compare(password, merchant.password_hash);
  if (!valid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const accessToken = signToken(merchant.id, merchant.email, merchant.role);
  const refreshToken = signRefreshToken(merchant.id, merchant.email, merchant.role);

  return c.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: 86400,
    user: {
      id: merchant.id,
      email: merchant.email,
      role: merchant.role,
      bch_address: merchant.bch_address,
      merchant_address: merchant.merchant_address,
      business_name: merchant.business_name,
      encrypted_wallet: merchant.encrypted_wallet,
    },
  });
});

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

  const { address, signature, nonce, role: requestedRole } = parsed.data;

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
        email: `wallet_${address.slice(-12)}@cashtap.local`,
        bch_address: address,
        business_name: `Merchant ${address.slice(-8)}`,
        role: requestedRole || "BUYER",
      },
    });
  }

  const accessToken = signToken(merchant.id, merchant.email, merchant.role);
  const refreshToken = signRefreshToken(merchant.id, merchant.email, merchant.role);

  return c.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: 86400, // 24 hours
    merchant: {
      id: merchant.id,
      bch_address: merchant.bch_address,
      business_name: merchant.business_name,
      role: merchant.role,
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

    const accessToken = signToken(merchant.id, merchant.email, merchant.role);
    const newRefreshToken = signRefreshToken(
      merchant.id,
      merchant.email,
      merchant.role
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
