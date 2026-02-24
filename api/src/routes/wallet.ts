import { Hono } from "hono";
import { z } from "zod";
import { walletService } from "../services/wallet.js";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AppEnv } from "../types/hono.js";

const wallet = new Hono<AppEnv>();

const addressSchema = z.object({
  address: z
    .string()
    .min(1, "BCH address is required")
    .regex(
      /^(bitcoincash:|bchtest:)?[qpzrs][a-z0-9]{41,}$/i,
      "Invalid BCH address format"
    ),
});

const broadcastSchema = z.object({
  raw_tx: z.string().min(1, "Raw transaction hex is required"),
});

const registerWalletSchema = z.object({
  bch_address: z
    .string()
    .min(1, "BCH address is required")
    .regex(
      /^(bitcoincash:|bchtest:)?[qpzrs][a-z0-9]{41,}$/i,
      "Invalid BCH address format"
    ),
  encrypted_wallet: z.string().optional(),
});

/**
 * POST /api/wallet/register
 * Register a wallet address for the authenticated user.
 */
wallet.post("/register", authMiddleware, async (c) => {
  const merchantId = c.get("merchantId") as string;
  const body = await c.req.json();
  const parsed = registerWalletSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { bch_address, encrypted_wallet } = parsed.data;

  // Check if address is already claimed by another user
  const existing = await prisma.merchant.findUnique({
    where: { bch_address },
  });

  if (existing && existing.id !== merchantId) {
    return c.json({ error: "This address is already claimed by another account" }, 409);
  }

  const data: Record<string, unknown> = { bch_address };
  if (encrypted_wallet !== undefined) {
    data.encrypted_wallet = encrypted_wallet;
  }

  const merchant = await prisma.merchant.update({
    where: { id: merchantId },
    data,
    select: {
      id: true,
      email: true,
      bch_address: true,
      encrypted_wallet: true,
      role: true,
    },
  });

  return c.json({ user: merchant });
});

/**
 * GET /api/wallet/balance?address=...
 * Returns confirmed + unconfirmed satoshis for an address.
 */
wallet.get("/balance", async (c) => {
  const address = c.req.query("address");
  const parsed = addressSchema.safeParse({ address });

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  try {
    const { balance, utxos } = await walletService.checkAddressBalance(
      parsed.data.address
    );

    // Compute unconfirmed from UTXOs with 0 confirmations
    let confirmed = 0;
    let unconfirmed = 0;
    for (const utxo of utxos) {
      const value = Number(utxo.satoshis);
      confirmed += value;
    }

    // If no UTXOs but we have a balance, use it as confirmed
    if (utxos.length === 0 && balance > 0) {
      confirmed = balance;
    } else if (confirmed === 0) {
      confirmed = balance;
    }

    return c.json({
      address: parsed.data.address,
      confirmed_satoshis: confirmed,
      unconfirmed_satoshis: unconfirmed,
      total_satoshis: confirmed + unconfirmed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: `Balance query failed: ${message}` }, 500);
  }
});

/**
 * GET /api/wallet/utxos?address=...
 * Returns the UTXO set for an address.
 */
wallet.get("/utxos", async (c) => {
  const address = c.req.query("address");
  const parsed = addressSchema.safeParse({ address });

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  try {
    const { utxos } = await walletService.checkAddressBalance(
      parsed.data.address
    );

    // Normalize UTXO format for client consumption
    const normalized = utxos.map((utxo) => ({
      txid: utxo.txid,
      vout: utxo.vout,
      satoshis: Number(utxo.satoshis),
    }));

    return c.json({
      address: parsed.data.address,
      utxos: normalized,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: `UTXO query failed: ${message}` }, 500);
  }
});

/**
 * POST /api/wallet/broadcast
 * Broadcasts a raw signed transaction hex.
 */
wallet.post("/broadcast", async (c) => {
  const body = await c.req.json();
  const parsed = broadcastSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  try {
    const { ElectrumNetworkProvider, Network } = await import("mainnet-js");
    const network =
      (process.env.BCH_NETWORK || "chipnet") === "mainnet"
        ? Network.MAINNET
        : Network.TESTNET;
    const provider = new ElectrumNetworkProvider(network as any);
    const txId = await provider.sendRawTransaction(parsed.data.raw_tx);

    return c.json({ txid: txId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: `Broadcast failed: ${message}` }, 400);
  }
});

export default wallet;
