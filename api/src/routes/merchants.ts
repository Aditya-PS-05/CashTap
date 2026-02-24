import { Hono } from "hono";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, signToken, signRefreshToken } from "../middleware/auth.js";
import type { AppEnv } from "../types/hono.js";

const merchants = new Hono<AppEnv>();

// --- Schemas ---

const registerSchema = z.object({
  bch_address: z
    .string()
    .min(1, "BCH address is required")
    .regex(
      /^(bitcoincash:|bchtest:)?[qpzrs][a-z0-9]{41,}$/i,
      "Invalid BCH address format"
    ),
  business_name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  logo_url: z.string().url().optional(),
  webhook_url: z.string().url().optional(),
});

const updateSchema = z.object({
  business_name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional().nullable(),
  logo_url: z.string().url().optional().nullable(),
  webhook_url: z.string().url().optional().nullable(),
  display_currency: z.enum(["BCH", "USD"]).optional(),
});

const setupMerchantSchema = z.object({
  business_name: z.string().min(1, "Business name is required").max(255),
  merchant_address: z
    .string()
    .regex(
      /^(bitcoincash:|bchtest:)?[qpzrs][a-z0-9]{41,}$/i,
      "Invalid BCH address format"
    )
    .optional(),
  logo_url: z.string().url().optional(),
});

// --- Routes ---

/**
 * POST /api/merchants/setup
 * Upgrade a BUYER to MERCHANT. Sets business_name, merchant_address, role=MERCHANT.
 * Returns a fresh JWT with role=MERCHANT.
 */
merchants.post("/setup", authMiddleware, async (c) => {
  const merchantId = c.get("merchantId") as string;
  const body = await c.req.json();
  const parsed = setupMerchantSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { business_name, merchant_address, logo_url } = parsed.data;

  const data: Record<string, unknown> = {
    business_name,
    role: "MERCHANT",
  };
  if (merchant_address) data.merchant_address = merchant_address;
  if (logo_url) data.logo_url = logo_url;

  const merchant = await prisma.merchant.update({
    where: { id: merchantId },
    data,
    select: {
      id: true,
      email: true,
      bch_address: true,
      merchant_address: true,
      business_name: true,
      role: true,
      logo_url: true,
    },
  });

  const accessToken = signToken(merchant.id, merchant.email, merchant.role);
  const refreshToken = signRefreshToken(merchant.id, merchant.email, merchant.role);

  return c.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: 86400,
    user: merchant,
  });
});

/**
 * POST /api/merchants
 * Register a new merchant (legacy endpoint).
 */
merchants.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { bch_address, business_name, email, logo_url, webhook_url } =
    parsed.data;

  // Check if merchant with this address already exists
  const existing = await prisma.merchant.findUnique({
    where: { bch_address },
  });

  if (existing) {
    return c.json(
      { error: "A merchant with this BCH address already exists" },
      409
    );
  }

  // Generate an initial API key
  const rawApiKey = `bchpay_${crypto.randomBytes(32).toString("hex")}`;
  const apiKeyHash = await bcrypt.hash(rawApiKey, 10);

  const merchant = await prisma.merchant.create({
    data: {
      email: email ?? `wallet_${bch_address.slice(-12)}@cashtap.local`,
      bch_address,
      business_name,
      logo_url: logo_url ?? null,
      webhook_url: webhook_url ?? null,
      api_key_hash: apiKeyHash,
      role: "MERCHANT",
    },
  });

  // Also store the key in the api_keys table with prefix for fast lookup
  await prisma.apiKey.create({
    data: {
      merchant_id: merchant.id,
      key_hash: apiKeyHash,
      key_prefix: rawApiKey.substring(0, 16),
      label: "Default API Key",
      permissions: JSON.stringify(["*"]),
    },
  });

  return c.json(
    {
      merchant: {
        id: merchant.id,
        bch_address: merchant.bch_address,
        business_name: merchant.business_name,
        email: merchant.email,
        logo_url: merchant.logo_url,
        webhook_url: merchant.webhook_url,
        created_at: merchant.created_at,
      },
      api_key: rawApiKey, // Only returned once at creation
    },
    201
  );
});

/**
 * GET /api/merchants/me
 * Get the currently authenticated merchant's profile.
 */
merchants.get("/me", authMiddleware, async (c) => {
  const merchantId = c.get("merchantId") as string;

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: {
      id: true,
      email: true,
      bch_address: true,
      merchant_address: true,
      business_name: true,
      logo_url: true,
      webhook_url: true,
      display_currency: true,
      role: true,
      encrypted_wallet: true,
      created_at: true,
      updated_at: true,
      _count: {
        select: {
          payment_links: true,
          invoices: true,
          transactions: true,
        },
      },
    },
  });

  if (!merchant) {
    return c.json({ error: "Merchant not found" }, 404);
  }

  return c.json({ merchant });
});

/**
 * GET /api/merchants/:id
 * Public endpoint — get a merchant's public profile by ID.
 */
merchants.get("/:id", async (c) => {
  const id = c.req.param("id");

  const merchant = await prisma.merchant.findUnique({
    where: { id },
    select: {
      id: true,
      bch_address: true,
      business_name: true,
      logo_url: true,
      created_at: true,
      _count: {
        select: {
          payment_links: { where: { status: "ACTIVE" } },
        },
      },
    },
  });

  if (!merchant) {
    return c.json({ error: "Merchant not found" }, 404);
  }

  return c.json({ merchant });
});

/**
 * PUT /api/merchants/me
 * Update the currently authenticated merchant's profile.
 */
merchants.put("/me", authMiddleware, async (c) => {
  const merchantId = c.get("merchantId") as string;
  const body = await c.req.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  // Filter out undefined values so we only update provided fields
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) {
      data[key] = value;
    }
  }

  if (Object.keys(data).length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }

  const merchant = await prisma.merchant.update({
    where: { id: merchantId },
    data,
    select: {
      id: true,
      bch_address: true,
      business_name: true,
      email: true,
      logo_url: true,
      webhook_url: true,
      created_at: true,
      updated_at: true,
    },
  });

  return c.json({ merchant });
});

/**
 * PATCH /api/merchants/me/role
 * Switch the authenticated user's role between MERCHANT and BUYER.
 * Returns a fresh JWT with the new role.
 */
merchants.patch("/me/role", authMiddleware, async (c) => {
  const merchantId = c.get("merchantId") as string;
  const body = await c.req.json();

  const roleSchema = z.object({
    role: z.enum(["MERCHANT", "BUYER"]),
  });

  const parsed = roleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const merchant = await prisma.merchant.update({
    where: { id: merchantId },
    data: { role: parsed.data.role },
    select: {
      id: true,
      email: true,
      bch_address: true,
      business_name: true,
      role: true,
    },
  });

  const accessToken = signToken(merchant.id, merchant.email, merchant.role);
  const refreshToken = signRefreshToken(merchant.id, merchant.email, merchant.role);

  return c.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: 86400,
    merchant,
  });
});

export default merchants;
