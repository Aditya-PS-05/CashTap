import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { cashTokenService } from "../services/cashtoken.js";
import type { AppEnv } from "../types/hono.js";

const cashtokens = new Hono<AppEnv>();

// --- Validation schemas ---

const createLoyaltySchema = z.object({
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(10),
  decimals: z.number().int().min(0).max(18).optional().default(0),
});

const issueLoyaltySchema = z.object({
  customer_address: z.string().min(1),
  amount_sats: z.number().int().positive(),
});

const redeemLoyaltySchema = z.object({
  customer_address: z.string().min(1),
  amount: z.number().int().positive(),
  description: z.string().optional(),
});

const mintReceiptSchema = z.object({
  customer_address: z.string().min(1),
  tx_hash: z.string().min(1),
  amount_sats: z.number().int().positive(),
  memo: z.string().optional(),
});

// --- Loyalty Routes ---

/**
 * POST /api/cashtokens/loyalty/create
 * Create a loyalty token for the merchant. 409 if already exists.
 */
cashtokens.post("/loyalty/create", authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = createLoyaltySchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const merchantId = c.get("merchantId") as string;

  // Check if loyalty token already exists
  const existing = await prisma.cashtokenConfig.findFirst({
    where: { merchant_id: merchantId, purpose: "LOYALTY", active: true },
  });

  if (existing) {
    return c.json({ error: "Loyalty token already configured" }, 409);
  }

  const { name, symbol, decimals } = parsed.data;
  const result = await cashTokenService.createLoyaltyToken(
    merchantId,
    name,
    symbol,
    decimals
  );

  return c.json(
    {
      loyalty_token: {
        token_category: result.tokenCategory,
        tx_hash: result.txHash,
        name,
        symbol,
        decimals,
      },
    },
    201
  );
});

/**
 * POST /api/cashtokens/loyalty/issue
 * Manually issue loyalty tokens to a customer.
 */
cashtokens.post("/loyalty/issue", authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = issueLoyaltySchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const merchantId = c.get("merchantId") as string;
  const { customer_address, amount_sats } = parsed.data;

  const result = await cashTokenService.issueLoyaltyTokens(
    merchantId,
    customer_address,
    BigInt(amount_sats)
  );

  return c.json({
    issuance: {
      tokens_issued: result.tokensIssued.toString(),
      tx_hash: result.txHash,
      token_symbol: result.tokenSymbol,
    },
  });
});

/**
 * POST /api/cashtokens/loyalty/redeem
 * Redeem loyalty tokens from a customer.
 */
cashtokens.post("/loyalty/redeem", authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = redeemLoyaltySchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const merchantId = c.get("merchantId") as string;
  const { customer_address, amount, description } = parsed.data;

  const result = await cashTokenService.redeemLoyaltyTokens(
    merchantId,
    customer_address,
    BigInt(amount),
    description
  );

  if (result.redeemed === 0n) {
    return c.json({ error: "No loyalty token configured" }, 404);
  }

  return c.json({
    redemption: {
      redeemed: result.redeemed.toString(),
      tx_hash: result.txHash,
      token_symbol: result.tokenSymbol,
    },
  });
});

/**
 * GET /api/cashtokens/loyalty/stats
 * Get loyalty token and receipt NFT statistics.
 */
cashtokens.get("/loyalty/stats", authMiddleware, async (c) => {
  const merchantId = c.get("merchantId") as string;
  const stats = await cashTokenService.getTokenStats(merchantId);
  return c.json({ stats });
});

// --- Receipt NFT Routes ---

/**
 * POST /api/cashtokens/receipts/enable
 * Enable receipt NFTs for the merchant. 409 if already enabled.
 */
cashtokens.post("/receipts/enable", authMiddleware, async (c) => {
  const merchantId = c.get("merchantId") as string;

  const existing = await prisma.cashtokenConfig.findFirst({
    where: { merchant_id: merchantId, purpose: "RECEIPT", active: true },
  });

  if (existing) {
    return c.json({ error: "Receipt NFTs already enabled" }, 409);
  }

  const config = await cashTokenService.enableReceiptNFTs(merchantId);

  return c.json(
    {
      receipt_config: {
        token_category: config.token_category,
        token_name: config.token_name,
        active: config.active,
      },
    },
    201
  );
});

/**
 * POST /api/cashtokens/receipts/mint
 * Manually mint a receipt NFT.
 */
cashtokens.post("/receipts/mint", authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = mintReceiptSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const merchantId = c.get("merchantId") as string;
  const { customer_address, tx_hash, amount_sats, memo } = parsed.data;

  const result = await cashTokenService.mintReceiptNFT(
    merchantId,
    customer_address,
    {
      txHash: tx_hash,
      amountSats: BigInt(amount_sats),
      memo,
      timestamp: new Date(),
    }
  );

  return c.json(
    {
      receipt: {
        id: result.receiptId,
        nft_category: result.nftCategory,
        commitment: result.commitment,
        tx_hash: result.txHash,
      },
    },
    201
  );
});

/**
 * GET /api/cashtokens/receipts/:id
 * Public: get receipt NFT details.
 */
cashtokens.get("/receipts/:id", async (c) => {
  const id = c.req.param("id");
  const receipt = await cashTokenService.getReceipt(id);

  if (!receipt) {
    return c.json({ error: "Receipt not found" }, 404);
  }

  return c.json({
    receipt: {
      id: receipt.id,
      merchant_name: receipt.merchant?.business_name,
      merchant_logo: receipt.merchant?.logo_url,
      nft_category: receipt.nft_category,
      commitment: receipt.commitment,
      tx_hash: receipt.tx_hash,
      mint_tx_hash: receipt.mint_tx_hash,
      amount_satoshis: receipt.amount_satoshis.toString(),
      memo: receipt.memo,
      created_at: receipt.created_at,
    },
  });
});

// --- Analytics ---

/**
 * GET /api/cashtokens/analytics
 * Full CashToken analytics for the merchant.
 */
cashtokens.get("/analytics", authMiddleware, async (c) => {
  const merchantId = c.get("merchantId") as string;
  const analytics = await cashTokenService.getAnalytics(merchantId);

  return c.json({
    analytics: {
      stats: analytics.stats,
      recent_issuances: analytics.recentIssuances.map((i: any) => ({
        ...i,
        amount: i.amount.toString(),
      })),
      recent_receipts: analytics.recentReceipts.map((r: any) => ({
        ...r,
        amount_satoshis: r.amount_satoshis.toString(),
      })),
      top_holders: analytics.topHolders.map((h) => ({
        customer_address: h.customerAddress,
        total_tokens: h.totalTokens.toString(),
      })),
      redemption_rate: analytics.redemptionRate,
    },
  });
});

// --- BCMR ---

/**
 * GET /api/cashtokens/bcmr/:category
 * Public: serve BCMR metadata JSON for a token category.
 */
cashtokens.get("/bcmr/:category", async (c) => {
  const category = c.req.param("category");

  const config = await prisma.cashtokenConfig.findFirst({
    where: { token_category: category },
  });

  if (!config) {
    return c.json({ error: "Token not found" }, 404);
  }

  const bcmr = cashTokenService.generateBCMR(config);
  return c.json(bcmr);
});

export default cashtokens;
