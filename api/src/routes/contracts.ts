import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { contractService } from "../services/contracts.js";
import type { AppEnv } from "../types/hono.js";

const contracts = new Hono<AppEnv>();

// --- Validation helpers ---

// 20-byte hex string (40 hex chars) for public key hashes
const pkhSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{40}$/, "Must be a 40-character hex string (bytes20)");

// --- Schemas ---

const createEscrowSchema = z.object({
  buyer_pkh: pkhSchema,
  seller_pkh: pkhSchema,
  arbiter_pkh: pkhSchema,
  timeout: z
    .number()
    .int()
    .positive("Timeout must be a positive integer (block height or unix timestamp)"),
});

const createSplitPaymentSchema = z.object({
  recipient1_pkh: pkhSchema,
  recipient2_pkh: pkhSchema,
  split1_percent: z.number().int().min(1).max(99),
  split2_percent: z.number().int().min(1).max(99),
}).refine(
  (data) => data.split1_percent + data.split2_percent === 100,
  { message: "Split percentages must add up to 100" }
);

const recipientSchema = z.object({
  pkh: pkhSchema,
  percent: z.number().int().min(1).max(99),
  label: z.string().max(100).optional(),
});

const createMultiSplitSchema = z.object({
  recipients: z.array(recipientSchema).min(2).max(10),
}).refine(
  (data) => data.recipients.reduce((sum, r) => sum + r.percent, 0) === 100,
  { message: "Recipient percentages must add up to 100" }
);

const splitPreviewSchema = z.object({
  recipients: z.array(z.object({
    pkh: z.string().optional(),
    percent: z.number().int().min(1).max(99),
    label: z.string().optional(),
  })).min(2).max(10),
  total_satoshis: z.number().int().positive(),
});

const createSavingsVaultSchema = z.object({
  owner_pkh: pkhSchema,
  locktime: z
    .number()
    .int()
    .positive("Locktime must be a positive integer (block height or unix timestamp)"),
});

const listContractsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(["ESCROW", "SPLIT_PAYMENT", "SAVINGS_VAULT"]).optional(),
  status: z.enum(["ACTIVE", "FUNDED", "RELEASED", "REFUNDED", "DISPUTED", "COMPLETED", "EXPIRED"]).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["ACTIVE", "FUNDED", "RELEASED", "REFUNDED", "DISPUTED", "COMPLETED", "EXPIRED"]),
});

const resolveDisputeSchema = z.object({
  recipient_pkh: pkhSchema,
});

// --- Valid status transitions ---
const VALID_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ["FUNDED", "COMPLETED", "EXPIRED"],
  FUNDED: ["RELEASED", "REFUNDED", "DISPUTED", "COMPLETED", "EXPIRED"],
  DISPUTED: ["RELEASED", "REFUNDED", "COMPLETED"],
};

// --- Routes ---

/**
 * GET /api/contracts
 * List the authenticated merchant's contract instances (paginated).
 */
contracts.get("/", authMiddleware, async (c) => {
  const query = listContractsSchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json(
      { error: "Invalid query parameters", details: query.error.flatten() },
      400
    );
  }

  const merchantId = c.get("merchantId") as string;
  const { page, limit, type, status } = query.data;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { merchant_id: merchantId };
  if (type) where.contract_type = type;
  if (status) where.status = status;

  const [contracts_list, total] = await Promise.all([
    prisma.contractInstance.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: "desc" },
    }),
    prisma.contractInstance.count({ where }),
  ]);

  return c.json({
    contracts: contracts_list.map((inst) => ({
      id: inst.id,
      type: inst.contract_type,
      address: inst.contract_address,
      token_address: inst.token_address,
      constructor_args: inst.constructor_args,
      status: inst.status,
      created_at: inst.created_at,
    })),
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  });
});

/**
 * GET /api/contracts/types
 * List available contract types with their ABIs and constructor inputs.
 */
contracts.get("/types", authMiddleware, async (c) => {
  const types = contractService.getAllContractTypes();
  return c.json({ contract_types: types });
});

/**
 * POST /api/contracts/escrow
 * Create an escrow contract instance.
 */
contracts.post("/escrow", authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = createEscrowSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const merchantId = c.get("merchantId") as string;
  const { buyer_pkh, seller_pkh, arbiter_pkh, timeout } = parsed.data;

  const { address, tokenAddress } = contractService.createEscrow(
    buyer_pkh,
    seller_pkh,
    arbiter_pkh,
    BigInt(timeout)
  );

  const instance = await prisma.contractInstance.create({
    data: {
      merchant_id: merchantId,
      contract_type: "ESCROW",
      contract_address: address,
      token_address: tokenAddress,
      constructor_args: { buyer_pkh, seller_pkh, arbiter_pkh, timeout },
    },
  });

  // Register the contract address with the transaction monitor
  try {
    const { transactionMonitor } = await import("../services/monitor.js");
    await transactionMonitor.watchContractAddress(address, instance.id, merchantId);
  } catch {
    console.warn("[Contracts] Monitor unavailable, contract address not watched");
  }

  return c.json(
    {
      contract: {
        id: instance.id,
        type: "ESCROW",
        address,
        token_address: tokenAddress,
        constructor_args: instance.constructor_args,
        status: instance.status,
        created_at: instance.created_at,
      },
    },
    201
  );
});

/**
 * POST /api/contracts/split-payment
 * Create a split payment contract instance (2 recipients).
 */
contracts.post("/split-payment", authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = createSplitPaymentSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const merchantId = c.get("merchantId") as string;
  const { recipient1_pkh, recipient2_pkh, split1_percent, split2_percent } =
    parsed.data;

  const { address, tokenAddress } = contractService.createSplitPayment(
    recipient1_pkh,
    recipient2_pkh,
    BigInt(split1_percent),
    BigInt(split2_percent)
  );

  const instance = await prisma.contractInstance.create({
    data: {
      merchant_id: merchantId,
      contract_type: "SPLIT_PAYMENT",
      contract_address: address,
      token_address: tokenAddress,
      constructor_args: {
        recipient1_pkh,
        recipient2_pkh,
        split1_percent,
        split2_percent,
      },
    },
  });

  try {
    const { transactionMonitor } = await import("../services/monitor.js");
    await transactionMonitor.watchContractAddress(address, instance.id, merchantId);
  } catch {
    console.warn("[Contracts] Monitor unavailable, contract address not watched");
  }

  return c.json(
    {
      contract: {
        id: instance.id,
        type: "SPLIT_PAYMENT",
        address,
        token_address: tokenAddress,
        constructor_args: instance.constructor_args,
        status: instance.status,
        created_at: instance.created_at,
      },
    },
    201
  );
});

/**
 * POST /api/contracts/split-payment-multi
 * Create a split payment for 2-10 recipients.
 * For 2 recipients: uses CashScript contract.
 * For >2 recipients: stores all recipients, uses merchant address (application-layer split).
 */
contracts.post("/split-payment-multi", authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = createMultiSplitSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const merchantId = c.get("merchantId") as string;
  const { recipients } = parsed.data;

  let address: string;
  let tokenAddress: string | null = null;

  if (recipients.length === 2) {
    // Use the CashScript split payment contract
    const result = contractService.createSplitPayment(
      recipients[0].pkh,
      recipients[1].pkh,
      BigInt(recipients[0].percent),
      BigInt(recipients[1].percent)
    );
    address = result.address;
    tokenAddress = result.tokenAddress;
  } else {
    // For >2 recipients, use merchant's address as the collection point
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { bch_address: true },
    });
    address = merchant?.bch_address || "";
  }

  const instance = await prisma.contractInstance.create({
    data: {
      merchant_id: merchantId,
      contract_type: "SPLIT_PAYMENT",
      contract_address: address,
      token_address: tokenAddress,
      constructor_args: { recipients },
    },
  });

  try {
    const { transactionMonitor } = await import("../services/monitor.js");
    await transactionMonitor.watchContractAddress(address, instance.id, merchantId);
  } catch {
    console.warn("[Contracts] Monitor unavailable, contract address not watched");
  }

  return c.json(
    {
      contract: {
        id: instance.id,
        type: "SPLIT_PAYMENT",
        address,
        token_address: tokenAddress,
        constructor_args: instance.constructor_args,
        status: instance.status,
        created_at: instance.created_at,
      },
    },
    201
  );
});

/**
 * POST /api/contracts/split-payment/preview
 * Preview split payment distribution.
 */
contracts.post("/split-payment/preview", authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = splitPreviewSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { recipients, total_satoshis } = parsed.data;

  // Estimate miner fee (~200 sats per recipient)
  const estimatedFee = recipients.length * 200;
  const distributable = Math.max(0, total_satoshis - estimatedFee);

  const shares = recipients.map((r) => {
    const shareSats = Math.floor(distributable * (r.percent / 100));
    return {
      pkh: r.pkh || "",
      label: r.label || "",
      percent: r.percent,
      satoshis: shareSats,
      bch: (shareSats / 1e8).toFixed(8),
    };
  });

  // Get USD estimate
  let usdRate = 0;
  try {
    const { getBchPrice } = await import("../services/price.js");
    const price = await getBchPrice();
    usdRate = price.usd;
  } catch {
    // Price unavailable
  }

  return c.json({
    total_satoshis,
    estimated_fee: estimatedFee,
    distributable_satoshis: distributable,
    usd_rate: usdRate,
    shares: shares.map((s) => ({
      ...s,
      usd: usdRate ? ((s.satoshis / 1e8) * usdRate).toFixed(2) : null,
    })),
  });
});

/**
 * POST /api/contracts/savings-vault
 * Create a savings vault contract instance.
 */
contracts.post("/savings-vault", authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = createSavingsVaultSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const merchantId = c.get("merchantId") as string;
  const { owner_pkh, locktime } = parsed.data;

  const { address, tokenAddress } = contractService.createSavingsVault(
    owner_pkh,
    BigInt(locktime)
  );

  const instance = await prisma.contractInstance.create({
    data: {
      merchant_id: merchantId,
      contract_type: "SAVINGS_VAULT",
      contract_address: address,
      token_address: tokenAddress,
      constructor_args: { owner_pkh, locktime },
    },
  });

  try {
    const { transactionMonitor } = await import("../services/monitor.js");
    await transactionMonitor.watchContractAddress(address, instance.id, merchantId);
  } catch {
    console.warn("[Contracts] Monitor unavailable, contract address not watched");
  }

  return c.json(
    {
      contract: {
        id: instance.id,
        type: "SAVINGS_VAULT",
        address,
        token_address: tokenAddress,
        constructor_args: instance.constructor_args,
        status: instance.status,
        created_at: instance.created_at,
      },
    },
    201
  );
});

/**
 * PATCH /api/contracts/:id/status
 * Update contract status with enforced valid transitions.
 */
contracts.patch("/:id/status", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const merchantId = c.get("merchantId") as string;
  const body = await c.req.json();
  const parsed = updateStatusSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const instance = await prisma.contractInstance.findFirst({
    where: { id, merchant_id: merchantId },
  });

  if (!instance) {
    return c.json({ error: "Contract instance not found" }, 404);
  }

  // Enforce valid transitions
  const allowed = VALID_TRANSITIONS[instance.status];
  if (!allowed || !allowed.includes(parsed.data.status)) {
    return c.json(
      { error: `Cannot transition from ${instance.status} to ${parsed.data.status}` },
      400
    );
  }

  const updated = await prisma.contractInstance.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  return c.json({
    contract: {
      id: updated.id,
      type: updated.contract_type,
      address: updated.contract_address,
      token_address: updated.token_address,
      constructor_args: updated.constructor_args,
      status: updated.status,
      created_at: updated.created_at,
    },
  });
});

/**
 * POST /api/contracts/:id/release
 * Release funds from escrow (ACTIVE/FUNDED → RELEASED).
 */
contracts.post("/:id/release", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const merchantId = c.get("merchantId") as string;

  const instance = await prisma.contractInstance.findFirst({
    where: { id, merchant_id: merchantId },
  });

  if (!instance) {
    return c.json({ error: "Contract instance not found" }, 404);
  }

  if (!["ACTIVE", "FUNDED"].includes(instance.status)) {
    return c.json(
      { error: `Cannot release from ${instance.status} status` },
      400
    );
  }

  const updated = await prisma.contractInstance.update({
    where: { id },
    data: { status: "RELEASED" },
  });

  // Deliver webhook
  try {
    const { webhookService } = await import("../services/webhook.js");
    await webhookService.deliver(merchantId, "contract.released", {
      contract_id: id,
      contract_type: updated.contract_type,
      contract_address: updated.contract_address,
    });
  } catch {}

  return c.json({
    contract: {
      id: updated.id,
      type: updated.contract_type,
      address: updated.contract_address,
      token_address: updated.token_address,
      constructor_args: updated.constructor_args,
      status: updated.status,
      created_at: updated.created_at,
    },
  });
});

/**
 * POST /api/contracts/:id/refund
 * Refund escrow (ACTIVE/FUNDED → REFUNDED).
 */
contracts.post("/:id/refund", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const merchantId = c.get("merchantId") as string;

  const instance = await prisma.contractInstance.findFirst({
    where: { id, merchant_id: merchantId },
  });

  if (!instance) {
    return c.json({ error: "Contract instance not found" }, 404);
  }

  if (!["ACTIVE", "FUNDED"].includes(instance.status)) {
    return c.json(
      { error: `Cannot refund from ${instance.status} status` },
      400
    );
  }

  const updated = await prisma.contractInstance.update({
    where: { id },
    data: { status: "REFUNDED" },
  });

  try {
    const { webhookService } = await import("../services/webhook.js");
    await webhookService.deliver(merchantId, "contract.refunded", {
      contract_id: id,
      contract_type: updated.contract_type,
      contract_address: updated.contract_address,
    });
  } catch {}

  return c.json({
    contract: {
      id: updated.id,
      type: updated.contract_type,
      address: updated.contract_address,
      token_address: updated.token_address,
      constructor_args: updated.constructor_args,
      status: updated.status,
      created_at: updated.created_at,
    },
  });
});

/**
 * POST /api/contracts/:id/resolve
 * Resolve a disputed escrow (DISPUTED → COMPLETED).
 */
contracts.post("/:id/resolve", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const merchantId = c.get("merchantId") as string;
  const body = await c.req.json();
  const parsed = resolveDisputeSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const instance = await prisma.contractInstance.findFirst({
    where: { id, merchant_id: merchantId },
  });

  if (!instance) {
    return c.json({ error: "Contract instance not found" }, 404);
  }

  if (instance.status !== "DISPUTED") {
    return c.json(
      { error: `Cannot resolve from ${instance.status} status (must be DISPUTED)` },
      400
    );
  }

  const updated = await prisma.contractInstance.update({
    where: { id },
    data: { status: "COMPLETED" },
  });

  try {
    const { webhookService } = await import("../services/webhook.js");
    await webhookService.deliver(merchantId, "contract.resolved", {
      contract_id: id,
      contract_type: updated.contract_type,
      contract_address: updated.contract_address,
      resolved_to: parsed.data.recipient_pkh,
    });
  } catch {}

  return c.json({
    contract: {
      id: updated.id,
      type: updated.contract_type,
      address: updated.contract_address,
      token_address: updated.token_address,
      constructor_args: updated.constructor_args,
      status: updated.status,
      created_at: updated.created_at,
    },
  });
});

/**
 * GET /api/contracts/:id
 * Get contract instance details.
 */
contracts.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const merchantId = c.get("merchantId") as string;

  const instance = await prisma.contractInstance.findFirst({
    where: { id, merchant_id: merchantId },
  });

  if (!instance) {
    return c.json({ error: "Contract instance not found" }, 404);
  }

  return c.json({
    contract: {
      id: instance.id,
      type: instance.contract_type,
      address: instance.contract_address,
      token_address: instance.token_address,
      constructor_args: instance.constructor_args,
      status: instance.status,
      created_at: instance.created_at,
    },
  });
});

export default contracts;
