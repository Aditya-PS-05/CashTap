import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AppEnv } from "../types/hono.js";

const paymentLinks = new Hono<AppEnv>();

// --- Schemas ---

const createPaymentLinkSchema = z
  .object({
    amount_satoshis: z
      .number()
      .int()
      .positive("Amount must be a positive integer (satoshis)"),
    currency: z.string().default("BCH"),
    memo: z.string().max(500).optional(),
    type: z.enum(["SINGLE", "MULTI", "RECURRING"]).default("SINGLE"),
    recurring_interval: z
      .enum(["daily", "weekly", "monthly", "yearly"])
      .optional(),
    expires_at: z.string().datetime().optional(),
    contract_instance_id: z.string().optional(),
  })
  .refine(
    (data) => data.type !== "RECURRING" || !!data.recurring_interval,
    { message: "recurring_interval is required for RECURRING links", path: ["recurring_interval"] },
  );

const updatePaymentLinkSchema = z.object({
  amount_satoshis: z.number().int().positive().optional(),
  currency: z.string().optional(),
  memo: z.string().max(500).optional().nullable(),
  type: z.enum(["SINGLE", "MULTI", "RECURRING"]).optional(),
  recurring_interval: z.enum(["daily", "weekly", "monthly", "yearly"]).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "EXPIRED"]).optional(),
  expires_at: z.string().datetime().optional().nullable(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["ACTIVE", "INACTIVE", "EXPIRED"]).optional(),
  type: z.enum(["SINGLE", "MULTI", "RECURRING"]).optional(),
});

// --- Routes ---

/**
 * POST /api/payment-links
 * Create a new payment link with a unique slug.
 */
paymentLinks.post("/", authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = createPaymentLinkSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const merchantId = c.get("merchantId") as string;
  const { amount_satoshis, currency, memo, type, recurring_interval, expires_at, contract_instance_id } = parsed.data;

  // Validate contract_instance_id if provided
  if (contract_instance_id) {
    const contract = await prisma.contractInstance.findFirst({
      where: { id: contract_instance_id, merchant_id: merchantId },
    });
    if (!contract) {
      return c.json({ error: "Contract instance not found" }, 404);
    }
  }

  const slug = nanoid(12);

  // Derive a unique payment address using the HD wallet
  let paymentAddress: string | null = null;
  let derivationIndex: number | null = null;

  try {
    const { walletService } = await import("../services/wallet.js");
    if (walletService.isInitialised()) {
      derivationIndex = await walletService.getNextDerivationIndex();
      paymentAddress = await walletService.derivePaymentAddress(derivationIndex);
    }
  } catch (err) {
    console.warn("[PaymentLinks] Wallet service unavailable, skipping address derivation");
  }

  const paymentLink = await prisma.paymentLink.create({
    data: {
      merchant_id: merchantId,
      amount_satoshis: BigInt(amount_satoshis),
      currency,
      memo: memo ?? null,
      type,
      recurring_interval: recurring_interval ?? null,
      slug,
      payment_address: paymentAddress,
      derivation_index: derivationIndex,
      expires_at: expires_at ? new Date(expires_at) : null,
      contract_instance_id: contract_instance_id ?? null,
    },
  });

  // Register address with transaction monitor for real-time payment detection
  if (paymentAddress) {
    try {
      const { transactionMonitor } = await import("../services/monitor.js");
      await transactionMonitor.watchAddress(
        paymentAddress,
        paymentLink.id,
        merchantId,
        BigInt(amount_satoshis)
      );
    } catch {
      console.warn("[PaymentLinks] Monitor unavailable, address not watched");
    }
  }

  return c.json(
    {
      payment_link: serializePaymentLink(paymentLink),
      pay_url: `${getBaseUrl(c)}/pay/${slug}`,
    },
    201
  );
});

/**
 * GET /api/payment-links/:slug
 * Public endpoint — get payment link details by slug.
 */
paymentLinks.get("/:slug", async (c) => {
  const slug = c.req.param("slug");

  // Special route: stats endpoint
  // This is handled separately below via a more specific route

  // Determine if this is a slug (nanoid, typically 12 chars) or a CUID id
  // CUIDs start with 'c' and are ~25 chars; slugs are 12 chars
  const isSlug = slug.length <= 16;

  const paymentLink = await prisma.paymentLink.findFirst({
    where: isSlug ? { slug } : { id: slug },
    include: {
      merchant: {
        select: {
          id: true,
          business_name: true,
          bch_address: true,
          logo_url: true,
        },
      },
    },
  });

  if (!paymentLink) {
    return c.json({ error: "Payment link not found" }, 404);
  }

  // Check expiration
  if (
    paymentLink.expires_at &&
    new Date(paymentLink.expires_at) < new Date() &&
    paymentLink.status === "ACTIVE"
  ) {
    await prisma.paymentLink.update({
      where: { id: paymentLink.id },
      data: { status: "EXPIRED" },
    });
    paymentLink.status = "EXPIRED";
  }

  return c.json({
    payment_link: {
      ...serializePaymentLink(paymentLink),
      merchant: paymentLink.merchant,
    },
  });
});

/**
 * GET /api/payment-links
 * List the authenticated merchant's payment links (paginated).
 */
paymentLinks.get("/", authMiddleware, async (c) => {
  const query = listQuerySchema.safeParse(c.req.query());

  if (!query.success) {
    return c.json(
      { error: "Invalid query parameters", details: query.error.flatten() },
      400
    );
  }

  const merchantId = c.get("merchantId") as string;
  const { page, limit, status, type } = query.data;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { merchant_id: merchantId };
  if (status) where.status = status;
  if (type) where.type = type;

  const [paymentLinksList, total] = await Promise.all([
    prisma.paymentLink.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: "desc" },
    }),
    prisma.paymentLink.count({ where }),
  ]);

  return c.json({
    payment_links: paymentLinksList.map(serializePaymentLink),
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  });
});

/**
 * GET /api/payment-links/:id/stats
 * Get stats for a payment link (total collected, payment count, transaction history).
 */
paymentLinks.get("/:id/stats", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const merchantId = c.get("merchantId") as string;

  const paymentLink = await prisma.paymentLink.findFirst({
    where: { id, merchant_id: merchantId },
  });

  if (!paymentLink) {
    return c.json({ error: "Payment link not found" }, 404);
  }

  const transactions = await prisma.transaction.findMany({
    where: { payment_link_id: id },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      tx_hash: true,
      amount_satoshis: true,
      status: true,
      confirmations: true,
      usd_rate_at_time: true,
      created_at: true,
    },
  });

  const totalSatoshis = transactions.reduce(
    (sum, tx) => sum + Number(tx.amount_satoshis),
    0
  );

  // Get current USD rate for total
  let usdRate = 0;
  try {
    const { getBchPrice } = await import("../services/price.js");
    const price = await getBchPrice();
    usdRate = price.usd;
  } catch {}

  return c.json({
    stats: {
      payment_link_id: id,
      type: paymentLink.type,
      total_collected_satoshis: totalSatoshis.toString(),
      total_collected_bch: (totalSatoshis / 1e8).toFixed(8),
      total_collected_usd: usdRate ? ((totalSatoshis / 1e8) * usdRate).toFixed(2) : null,
      payment_count: transactions.length,
      recurring_count: paymentLink.recurring_count,
      last_paid_at: paymentLink.last_paid_at,
    },
    transactions: transactions.map((tx) => ({
      ...tx,
      amount_satoshis: tx.amount_satoshis.toString(),
    })),
  });
});

/**
 * PUT /api/payment-links/:id
 * Update a payment link.
 */
paymentLinks.put("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const merchantId = c.get("merchantId") as string;
  const body = await c.req.json();
  const parsed = updatePaymentLinkSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  // Verify ownership
  const existing = await prisma.paymentLink.findFirst({
    where: { id, merchant_id: merchantId },
  });

  if (!existing) {
    return c.json({ error: "Payment link not found" }, 404);
  }

  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) {
      if (key === "amount_satoshis") {
        data[key] = BigInt(value as number);
      } else if (key === "expires_at" && value !== null) {
        data[key] = new Date(value as string);
      } else {
        data[key] = value;
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }

  const paymentLink = await prisma.paymentLink.update({
    where: { id },
    data,
  });

  return c.json({ payment_link: serializePaymentLink(paymentLink) });
});

/**
 * DELETE /api/payment-links/:id
 * Deactivate (soft-delete) a payment link.
 */
paymentLinks.delete("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const merchantId = c.get("merchantId") as string;

  const existing = await prisma.paymentLink.findFirst({
    where: { id, merchant_id: merchantId },
  });

  if (!existing) {
    return c.json({ error: "Payment link not found" }, 404);
  }

  await prisma.paymentLink.update({
    where: { id },
    data: { status: "INACTIVE" },
  });

  return c.json({ message: "Payment link deactivated" });
});

// --- Helpers ---

function getBaseUrl(c: { req: { url: string } }): string {
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

function serializePaymentLink(link: Record<string, unknown>) {
  return {
    ...link,
    amount_satoshis: link.amount_satoshis?.toString(),
  };
}

export default paymentLinks;
