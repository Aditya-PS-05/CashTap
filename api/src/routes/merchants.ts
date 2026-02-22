import { Hono } from "hono";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
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
});

// --- Routes ---

/**
 * POST /api/merchants
 * Register a new merchant.
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
      bch_address,
      business_name,
      email: email ?? null,
      logo_url: logo_url ?? null,
      webhook_url: webhook_url ?? null,
      api_key_hash: apiKeyHash,
    },
  });

  // Also store the key in the api_keys table
  await prisma.apiKey.create({
    data: {
      merchant_id: merchant.id,
      key_hash: apiKeyHash,
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
      bch_address: true,
      business_name: true,
      email: true,
      logo_url: true,
      webhook_url: true,
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

export default merchants;
