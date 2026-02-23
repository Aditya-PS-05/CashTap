import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AppEnv } from "../types/hono.js";

const transactions = new Hono<AppEnv>();

// --- Analytics cache ---

interface AnalyticsCacheEntry {
  data: unknown;
  expiresAt: number;
}

const analyticsCache = new Map<string, AnalyticsCacheEntry>();
const ANALYTICS_CACHE_TTL = 60_000; // 60 seconds

// --- Schemas ---

const analyticsQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d"]).optional().default("7d"),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

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
 * GET /api/transactions/analytics
 * Revenue analytics for the authenticated merchant.
 */
transactions.get("/analytics", authMiddleware, async (c) => {
  const query = analyticsQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: "Invalid query parameters", details: query.error.flatten() }, 400);
  }

  const merchantId = c.get("merchantId") as string;
  const { range, from: fromStr, to: toStr } = query.data;

  // Compute date range
  let dateFrom: Date;
  let dateTo: Date = new Date();

  if (fromStr && toStr) {
    dateFrom = new Date(fromStr);
    dateTo = new Date(toStr);
  } else {
    const days = range === "90d" ? 90 : range === "30d" ? 30 : 7;
    dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  // Check cache
  const cacheKey = `${merchantId}:${range}:${fromStr || ""}:${toStr || ""}`;
  const cached = analyticsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return c.json(cached.data as Record<string, unknown>);
  }

  const where = {
    merchant_id: merchantId,
    status: "CONFIRMED" as const,
    created_at: { gte: dateFrom, lte: dateTo },
  };

  const [dailyRaw, avgPayment, topLinksRaw, paymentLinkCount, invoiceCount, directCount, customerRaw] =
    await Promise.all([
      // 1. Daily revenue
      prisma.$queryRaw<Array<{ date: Date | string; total_satoshis: bigint; tx_count: bigint; total_usd: number }>>`
        SELECT
          DATE(created_at) as date,
          SUM(amount_satoshis) as total_satoshis,
          COUNT(*)::bigint as tx_count,
          SUM(CASE WHEN usd_rate_at_time IS NOT NULL
            THEN (CAST(amount_satoshis AS double precision) * usd_rate_at_time / 100000000.0)
            ELSE 0 END) as total_usd
        FROM transactions
        WHERE merchant_id = ${merchantId}
          AND status = 'CONFIRMED'
          AND created_at >= ${dateFrom}
          AND created_at <= ${dateTo}
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `,
      // 2. Average payment
      prisma.transaction.aggregate({
        where,
        _avg: { amount_satoshis: true },
        _sum: { amount_satoshis: true },
        _count: true,
      }),
      // 3. Top payment links
      prisma.transaction.groupBy({
        by: ["payment_link_id"],
        where: { ...where, payment_link_id: { not: null } },
        _sum: { amount_satoshis: true },
        _count: true,
        orderBy: { _sum: { amount_satoshis: "desc" } },
        take: 10,
      }),
      // 4. Payment method breakdown
      prisma.transaction.count({
        where: { ...where, payment_link_id: { not: null } },
      }),
      prisma.transaction.count({
        where: { ...where, invoice_id: { not: null } },
      }),
      prisma.transaction.count({
        where: { ...where, payment_link_id: null, invoice_id: null },
      }),
      // 5. Customer insights
      prisma.$queryRaw<Array<{ unique_count: bigint; repeat_count: bigint }>>`
        SELECT
          COUNT(DISTINCT sender_address) as unique_count,
          COUNT(*) FILTER (WHERE cnt > 1) as repeat_count
        FROM (
          SELECT sender_address, COUNT(*) as cnt
          FROM transactions
          WHERE merchant_id = ${merchantId}
            AND status = 'CONFIRMED'
            AND created_at >= ${dateFrom}
            AND created_at <= ${dateTo}
            AND sender_address != 'unknown'
          GROUP BY sender_address
        ) sub
      `,
    ]);

  // Fetch payment link names for top links
  const linkIds = topLinksRaw
    .map((g) => g.payment_link_id)
    .filter((id): id is string => id !== null);

  const linkDetails =
    linkIds.length > 0
      ? await prisma.paymentLink.findMany({
          where: { id: { in: linkIds } },
          select: { id: true, slug: true, memo: true },
        })
      : [];

  const linkMap = new Map(linkDetails.map((l) => [l.id, l]));

  // Compute total USD from daily data
  const totalRevenueUsd = dailyRaw.reduce((sum, d) => sum + (Number(d.total_usd) || 0), 0);
  const totalRevenueSatoshis = avgPayment._sum.amount_satoshis ?? 0n;
  const avgPaymentSatoshis = avgPayment._avg.amount_satoshis ?? 0;

  const responseData = {
    daily: dailyRaw.map((d) => ({
      date: typeof d.date === "object" && d.date instanceof Date
        ? d.date.toISOString().split("T")[0]
        : String(d.date).split("T")[0],
      total_satoshis: d.total_satoshis.toString(),
      tx_count: Number(d.tx_count),
      total_usd: Math.round(Number(d.total_usd) * 100) / 100,
    })),
    summary: {
      total_revenue_satoshis: totalRevenueSatoshis.toString(),
      total_revenue_usd: Math.round(totalRevenueUsd * 100) / 100,
      total_transactions: avgPayment._count,
      avg_payment_satoshis: Math.round(Number(avgPaymentSatoshis)).toString(),
      avg_payment_usd:
        avgPayment._count > 0
          ? Math.round((totalRevenueUsd / avgPayment._count) * 100) / 100
          : 0,
    },
    top_payment_links: topLinksRaw.map((g) => {
      const link = linkMap.get(g.payment_link_id!);
      return {
        id: g.payment_link_id,
        slug: link?.slug ?? null,
        memo: link?.memo ?? null,
        revenue_satoshis: (g._sum.amount_satoshis ?? 0n).toString(),
        tx_count: g._count,
      };
    }),
    payment_methods: {
      payment_link: paymentLinkCount,
      invoice: invoiceCount,
      direct: directCount,
    },
    customers: {
      unique_count: Number(customerRaw[0]?.unique_count ?? 0),
      repeat_count: Number(customerRaw[0]?.repeat_count ?? 0),
    },
  };

  // Cache the result
  analyticsCache.set(cacheKey, {
    data: responseData,
    expiresAt: Date.now() + ANALYTICS_CACHE_TTL,
  });

  return c.json(responseData);
});

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
