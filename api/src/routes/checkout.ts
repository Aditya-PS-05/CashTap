import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "../lib/prisma.js";
import { combinedAuth } from "../middleware/combined-auth.js";
import { getBchPrice, convertUsdToBch } from "../services/price.js";
import type { AppEnv } from "../types/hono.js";

const checkout = new Hono<AppEnv>();

const createSessionSchema = z.object({
  amount: z.number().positive("Amount must be positive (cents USD)"),
  currency: z.string().default("USD"),
  memo: z.string().max(500).optional(),
  success_url: z.string().url("Must be a valid URL"),
  cancel_url: z.string().url("Must be a valid URL"),
});

/**
 * POST /api/checkout/sessions
 * Create a new checkout session. Requires auth (JWT or API key).
 */
checkout.post("/sessions", combinedAuth, async (c) => {
  const body = await c.req.json();
  const parsed = createSessionSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const merchantId = c.get("merchantId") as string;
  const { amount, currency, memo, success_url, cancel_url } = parsed.data;

  // Convert USD cents to satoshis
  let amountSatoshis: bigint;
  try {
    const price = await getBchPrice();
    const usdAmount = amount / 100; // cents to dollars
    amountSatoshis = convertUsdToBch(usdAmount, price.usd);
  } catch {
    return c.json({ error: "Price service unavailable" }, 503);
  }

  const slug = nanoid(12);

  // Derive a unique payment address
  let paymentAddress: string | null = null;
  let derivationIndex: number | null = null;

  try {
    const { walletService } = await import("../services/wallet.js");
    if (walletService.isInitialised()) {
      derivationIndex = await walletService.getNextDerivationIndex();
      paymentAddress = await walletService.derivePaymentAddress(derivationIndex);
    }
  } catch {
    console.warn("[Checkout] Wallet service unavailable");
  }

  // Create a SINGLE payment link under the hood
  const paymentLink = await prisma.paymentLink.create({
    data: {
      merchant_id: merchantId,
      amount_satoshis: amountSatoshis,
      currency: "BCH",
      memo: memo ?? null,
      type: "SINGLE",
      slug,
      payment_address: paymentAddress,
      derivation_index: derivationIndex,
    },
  });

  // Register with monitor
  if (paymentAddress) {
    try {
      const { transactionMonitor } = await import("../services/monitor.js");
      await transactionMonitor.watchAddress(
        paymentAddress,
        paymentLink.id,
        merchantId,
        amountSatoshis
      );
    } catch {
      console.warn("[Checkout] Monitor unavailable");
    }
  }

  // Create checkout session (expires in 30 minutes)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  const session = await prisma.checkoutSession.create({
    data: {
      merchant_id: merchantId,
      payment_link_id: paymentLink.id,
      amount_satoshis: amountSatoshis,
      currency,
      memo: memo ?? null,
      success_url,
      cancel_url,
      expires_at: expiresAt,
    },
  });

  const baseUrl = new URL(c.req.url);
  const checkoutUrl = `${baseUrl.protocol}//${baseUrl.host}/checkout/${session.id}`;

  return c.json(
    {
      session_id: session.id,
      checkout_url: checkoutUrl,
      payment_link: {
        id: paymentLink.id,
        slug,
        amount_satoshis: amountSatoshis.toString(),
        payment_address: paymentAddress,
      },
      expires_at: expiresAt.toISOString(),
    },
    201
  );
});

/**
 * GET /api/checkout/:sessionId
 * Get checkout session details (public, no auth required).
 */
checkout.get("/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");

  const session = await prisma.checkoutSession.findUnique({
    where: { id: sessionId },
    include: {
      merchant: {
        select: {
          id: true,
          business_name: true,
          bch_address: true,
          logo_url: true,
        },
      },
      payment_link: {
        select: {
          id: true,
          slug: true,
          amount_satoshis: true,
          payment_address: true,
          status: true,
        },
      },
    },
  });

  if (!session) {
    return c.json({ error: "Checkout session not found" }, 404);
  }

  // Auto-expire
  if (session.status === "OPEN" && new Date(session.expires_at) < new Date()) {
    await prisma.checkoutSession.update({
      where: { id: sessionId },
      data: { status: "EXPIRED" },
    });
    session.status = "EXPIRED";
  }

  // Check if payment link was paid (INACTIVE = paid for SINGLE links)
  if (session.status === "OPEN" && session.payment_link?.status === "INACTIVE") {
    await prisma.checkoutSession.update({
      where: { id: sessionId },
      data: { status: "COMPLETE" },
    });
    session.status = "COMPLETE";
  }

  return c.json({
    session: {
      id: session.id,
      status: session.status,
      amount_satoshis: session.amount_satoshis.toString(),
      currency: session.currency,
      memo: session.memo,
      success_url: session.success_url,
      cancel_url: session.cancel_url,
      expires_at: session.expires_at,
      created_at: session.created_at,
      merchant: session.merchant,
      payment_link: session.payment_link
        ? {
            ...session.payment_link,
            amount_satoshis: session.payment_link.amount_satoshis.toString(),
          }
        : null,
    },
  });
});

/**
 * POST /api/checkout/:sessionId/cancel
 * Cancel a checkout session (public).
 */
checkout.post("/:sessionId/cancel", async (c) => {
  const sessionId = c.req.param("sessionId");

  const session = await prisma.checkoutSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return c.json({ error: "Checkout session not found" }, 404);
  }

  if (session.status !== "OPEN") {
    return c.json({ error: `Cannot cancel session in ${session.status} status` }, 400);
  }

  await prisma.checkoutSession.update({
    where: { id: sessionId },
    data: { status: "EXPIRED" },
  });

  return c.json({ message: "Checkout session cancelled" });
});

export default checkout;
