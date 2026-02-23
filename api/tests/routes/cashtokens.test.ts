import { describe, it, expect } from "vitest";
import { createTestApp } from "../helpers/app.js";
import { prismaMock } from "../helpers/mock-prisma.js";
import {
  merchantFixture,
  cashtokenConfigFixture,
  receiptNFTFixture,
} from "../helpers/fixtures.js";
import { makeToken } from "../helpers/auth.js";

// Access the mocked cashTokenService so we can override per-test
import { cashTokenService } from "../../src/services/cashtoken.js";
import { vi } from "vitest";

const app = createTestApp();
const TOKEN = makeToken();
const authHeader = { Authorization: `Bearer ${TOKEN}` };
const jsonHeaders = { ...authHeader, "Content-Type": "application/json" };

// ---------- POST /api/cashtokens/loyalty/create ----------

describe("POST /api/cashtokens/loyalty/create", () => {
  it("creates a loyalty token and returns 201", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.cashtokenConfig.findFirst.mockResolvedValue(null);

    const res = await app.request("/api/cashtokens/loyalty/create", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ name: "Coffee Points", symbol: "CPT", decimals: 0 }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.loyalty_token.symbol).toBe("CPT");
    expect(body.loyalty_token.token_category).toBeDefined();
  });

  it("returns 409 if loyalty token already exists", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.cashtokenConfig.findFirst.mockResolvedValue(cashtokenConfigFixture());

    const res = await app.request("/api/cashtokens/loyalty/create", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ name: "Coffee Points", symbol: "CPT" }),
    });

    expect(res.status).toBe(409);
  });

  it("returns 400 for missing name", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());

    const res = await app.request("/api/cashtokens/loyalty/create", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ symbol: "CPT" }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 401 without auth", async () => {
    const res = await app.request("/api/cashtokens/loyalty/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Coffee Points", symbol: "CPT" }),
    });

    expect(res.status).toBe(401);
  });
});

// ---------- POST /api/cashtokens/loyalty/issue ----------

describe("POST /api/cashtokens/loyalty/issue", () => {
  it("issues loyalty tokens", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());

    const res = await app.request("/api/cashtokens/loyalty/issue", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        customer_address: "bchtest:qzcustomer000000000000000000000000000000000",
        amount_sats: 50000,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.issuance.tokens_issued).toBe("50");
    expect(body.issuance.token_symbol).toBe("TLT");
  });

  it("returns 400 for missing customer_address", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());

    const res = await app.request("/api/cashtokens/loyalty/issue", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ amount_sats: 50000 }),
    });

    expect(res.status).toBe(400);
  });
});

// ---------- POST /api/cashtokens/loyalty/redeem ----------

describe("POST /api/cashtokens/loyalty/redeem", () => {
  it("redeems loyalty tokens", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());

    const res = await app.request("/api/cashtokens/loyalty/redeem", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        customer_address: "bchtest:qzcustomer000000000000000000000000000000000",
        amount: 10,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.redemption.redeemed).toBe("10");
  });

  it("returns 404 when no loyalty token configured", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    (cashTokenService.redeemLoyaltyTokens as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      redeemed: 0n,
      txHash: null,
      tokenSymbol: "",
    });

    const res = await app.request("/api/cashtokens/loyalty/redeem", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        customer_address: "bchtest:qzcustomer000000000000000000000000000000000",
        amount: 10,
      }),
    });

    expect(res.status).toBe(404);
  });
});

// ---------- GET /api/cashtokens/loyalty/stats ----------

describe("GET /api/cashtokens/loyalty/stats", () => {
  it("returns token stats", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());

    const res = await app.request("/api/cashtokens/loyalty/stats", {
      headers: authHeader,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats.loyaltyTokens.configured).toBe(true);
    expect(body.stats.loyaltyTokens.totalIssued).toBe(500);
    expect(body.stats.receiptNFTs.totalMinted).toBe(5);
  });

  it("returns 401 without auth", async () => {
    const res = await app.request("/api/cashtokens/loyalty/stats");
    expect(res.status).toBe(401);
  });
});

// ---------- POST /api/cashtokens/receipts/enable ----------

describe("POST /api/cashtokens/receipts/enable", () => {
  it("enables receipt NFTs and returns 201", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.cashtokenConfig.findFirst.mockResolvedValue(null);

    const res = await app.request("/api/cashtokens/receipts/enable", {
      method: "POST",
      headers: authHeader,
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.receipt_config.token_name).toBe("Payment Receipt");
  });

  it("returns 409 if already enabled", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.cashtokenConfig.findFirst.mockResolvedValue(
      cashtokenConfigFixture({ purpose: "RECEIPT" })
    );

    const res = await app.request("/api/cashtokens/receipts/enable", {
      method: "POST",
      headers: authHeader,
    });

    expect(res.status).toBe(409);
  });
});

// ---------- POST /api/cashtokens/receipts/mint ----------

describe("POST /api/cashtokens/receipts/mint", () => {
  it("mints a receipt NFT and returns 201", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());

    const res = await app.request("/api/cashtokens/receipts/mint", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        customer_address: "bchtest:qzcustomer000000000000000000000000000000000",
        tx_hash: "abc123",
        amount_sats: 50000,
        memo: "Coffee",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.receipt.id).toBeDefined();
    expect(body.receipt.nft_category).toBeDefined();
    expect(body.receipt.commitment).toBeDefined();
  });

  it("returns 400 for missing tx_hash", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());

    const res = await app.request("/api/cashtokens/receipts/mint", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        customer_address: "bchtest:qz000",
        amount_sats: 50000,
      }),
    });

    expect(res.status).toBe(400);
  });
});

// ---------- GET /api/cashtokens/receipts/:id ----------

describe("GET /api/cashtokens/receipts/:id", () => {
  it("returns receipt details (no auth required)", async () => {
    (cashTokenService.getReceipt as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      receiptNFTFixture()
    );

    const res = await app.request("/api/cashtokens/receipts/clrn0000000000000001");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.receipt.merchant_name).toBe("Test Merchant");
    expect(body.receipt.nft_category).toBeDefined();
  });

  it("returns 404 for non-existent receipt", async () => {
    (cashTokenService.getReceipt as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const res = await app.request("/api/cashtokens/receipts/nonexistent");

    expect(res.status).toBe(404);
  });
});

// ---------- GET /api/cashtokens/analytics ----------

describe("GET /api/cashtokens/analytics", () => {
  it("returns full analytics", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());

    const res = await app.request("/api/cashtokens/analytics", {
      headers: authHeader,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.analytics.stats).toBeDefined();
    expect(body.analytics.recent_issuances).toBeDefined();
    expect(body.analytics.top_holders).toBeDefined();
    expect(typeof body.analytics.redemption_rate).toBe("number");
  });

  it("returns 401 without auth", async () => {
    const res = await app.request("/api/cashtokens/analytics");
    expect(res.status).toBe(401);
  });
});

// ---------- GET /api/cashtokens/bcmr/:category ----------

describe("GET /api/cashtokens/bcmr/:category", () => {
  it("returns BCMR metadata (no auth required)", async () => {
    const category = "a".repeat(64);
    prismaMock.cashtokenConfig.findFirst.mockResolvedValue(
      cashtokenConfigFixture({ token_category: category })
    );

    const res = await app.request(`/api/cashtokens/bcmr/${category}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Test Token");
    expect(body.token.symbol).toBe("TLT");
  });

  it("returns 404 for unknown category", async () => {
    prismaMock.cashtokenConfig.findFirst.mockResolvedValue(null);

    const res = await app.request("/api/cashtokens/bcmr/unknown");

    expect(res.status).toBe(404);
  });
});
