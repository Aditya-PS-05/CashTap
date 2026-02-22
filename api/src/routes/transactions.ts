import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AppEnv } from "../types/hono.js";

const transactions = new Hono<AppEnv>();

// --- Schemas ---

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["PENDING", "CONFIRMED", "FAILED"]).optional(),
  payment_link_id: z.string().optional(),
  invoice_id: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// --- Routes ---

/**
 * GET /api/transactions/stats
 * Summary statistics for the authenticated merchant's transactions.
 * NOTE: This route is defined before /:id to avoid the "stats" param
 * being captured as an id.
 */
transactions.get("/stats", authMiddleware, async (c) => {
  const merchantId = c.get("merchantId") as string;

  const [totalConfirmed, totalPending, totalFailed, recentTransactions] =
    await Promise.all([
      prisma.transaction.aggregate({
        where: { merchant_id: merchantId, status: "CONFIRMED" },
        _sum: { amount_satoshis: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { merchant_id: merchantId, status: "PENDING" },
        _sum: { amount_satoshis: true },
        _count: true,
      }),
      prisma.transaction.count({
        where: { merchant_id: merchantId, status: "FAILED" },
      }),
      prisma.transaction.findMany({
        where: { merchant_id: merchantId },
        orderBy: { created_at: "desc" },
        take: 5,
      }),
    ]);

  return c.json({
    stats: {
      confirmed: {
        count: totalConfirmed._count,
        total_satoshis: totalConfirmed._sum.amount_satoshis?.toString() ?? "0",
      },
      pending: {
        count: totalPending._count,
        total_satoshis: totalPending._sum.amount_satoshis?.toString() ?? "0",
      },
      failed_count: totalFailed,
    },
    recent_transactions: recentTransactions.map(serializeTransaction),
  });
});

/**
 * GET /api/transactions
 * List the authenticated merchant's transactions (paginated, filterable).
 */
transactions.get("/", authMiddleware, async (c) => {
  const query = listQuerySchema.safeParse(c.req.query());

  if (!query.success) {
    return c.json(
      { error: "Invalid query parameters", details: query.error.flatten() },
      400
    );
  }

  const merchantId = c.get("merchantId") as string;
  const { page, limit, status, payment_link_id, invoice_id, from, to } =
    query.data;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { merchant_id: merchantId };
  if (status) where.status = status;
  if (payment_link_id) where.payment_link_id = payment_link_id;
  if (invoice_id) where.invoice_id = invoice_id;

  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.gte = new Date(from);
    if (to) createdAt.lte = new Date(to);
    where.created_at = createdAt;
  }

  const [transactionsList, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: "desc" },
      include: {
        payment_link: {
          select: { id: true, slug: true, memo: true },
        },
        invoice: {
          select: { id: true, customer_email: true },
        },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return c.json({
    transactions: transactionsList.map(serializeTransaction),
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  });
});

/**
 * GET /api/transactions/:id
 * Get a single transaction with full details.
 */
transactions.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const merchantId = c.get("merchantId") as string;

  const transaction = await prisma.transaction.findFirst({
    where: { id, merchant_id: merchantId },
    include: {
      payment_link: {
        select: {
          id: true,
          slug: true,
          memo: true,
          amount_satoshis: true,
          type: true,
        },
      },
      invoice: {
        select: {
          id: true,
          customer_email: true,
          total_satoshis: true,
          status: true,
        },
      },
      merchant: {
        select: {
          id: true,
          business_name: true,
          bch_address: true,
        },
      },
    },
  });

  if (!transaction) {
    return c.json({ error: "Transaction not found" }, 404);
  }

  return c.json({ transaction: serializeTransaction(transaction) });
});

// --- Helpers ---

function serializeTransaction(tx: Record<string, unknown>) {
  const serialized: Record<string, unknown> = { ...tx };

  if (serialized.amount_satoshis !== undefined && serialized.amount_satoshis !== null) {
    serialized.amount_satoshis = serialized.amount_satoshis.toString();
  }

  // Serialize nested BigInt fields if present
  if (serialized.payment_link && typeof serialized.payment_link === "object") {
    const pl = serialized.payment_link as Record<string, unknown>;
    if (pl.amount_satoshis !== undefined && pl.amount_satoshis !== null) {
      pl.amount_satoshis = pl.amount_satoshis.toString();
    }
  }

  if (serialized.invoice && typeof serialized.invoice === "object") {
    const inv = serialized.invoice as Record<string, unknown>;
    if (inv.total_satoshis !== undefined && inv.total_satoshis !== null) {
      inv.total_satoshis = inv.total_satoshis.toString();
    }
  }

  return serialized;
}

export default transactions;
