/**
 * Tests for src/services/cashtoken.ts
 *
 * CashTokenService uses prisma (mocked globally).
 */
import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "../helpers/mock-prisma.js";
import { cashtokenConfigFixture } from "../helpers/fixtures.js";

// No global mock for cashtoken — but ensure it's unmocked if setup adds one later
vi.unmock("../../src/services/cashtoken.js");

const { cashTokenService } = await import("../../src/services/cashtoken.js");

describe("cashTokenService.createLoyaltyToken", () => {
  it("creates a loyalty token config in DB", async () => {
    prismaMock.cashtokenConfig.create.mockResolvedValue(cashtokenConfigFixture());

    const result = await cashTokenService.createLoyaltyToken("m1", "ShopCoin", "SHOP", 0, 1_000_000n);
    expect(result.tokenCategory).toBeDefined();
    expect(result.tokenCategory.length).toBeGreaterThanOrEqual(48);
    expect(result.txHash).toBeDefined();
    expect(prismaMock.cashtokenConfig.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          merchant_id: "m1",
          token_symbol: "SHOP",
          purpose: "LOYALTY",
        }),
      })
    );
  });

  it("uses default decimals and supply", async () => {
    prismaMock.cashtokenConfig.create.mockResolvedValue(cashtokenConfigFixture());
    const result = await cashTokenService.createLoyaltyToken("m1", "Token", "TKN");
    expect(result.tokenCategory.length).toBeGreaterThanOrEqual(48);
  });
});

describe("cashTokenService.issueLoyaltyTokens", () => {
  it("returns tokens based on purchase amount", async () => {
    prismaMock.cashtokenConfig.findFirst.mockResolvedValue(
      cashtokenConfigFixture({ token_symbol: "SHOP" })
    );
    prismaMock.tokenIssuance.create.mockResolvedValue({ id: "ti1" });

    // Default rate: 1 token per 1000 sats; 5000 sats = 5 tokens
    const result = await cashTokenService.issueLoyaltyTokens("m1", "bchtest:q", 5000n);
    expect(result.tokensIssued).toBe(5n);
    expect(result.tokenSymbol).toBe("SHOP");
  });

  it("returns 0 tokens when no loyalty config exists", async () => {
    prismaMock.cashtokenConfig.findFirst.mockResolvedValue(null);
    const result = await cashTokenService.issueLoyaltyTokens("m1", "bchtest:q", 5000n);
    expect(result.tokensIssued).toBe(0n);
  });

  it("returns 0 tokens when purchase amount is too small", async () => {
    prismaMock.cashtokenConfig.findFirst.mockResolvedValue(cashtokenConfigFixture());
    // 500 sats / 1000 rate = 0 tokens (integer division)
    const result = await cashTokenService.issueLoyaltyTokens("m1", "bchtest:q", 500n);
    expect(result.tokensIssued).toBe(0n);
  });
});

describe("cashTokenService.mintReceiptNFT", () => {
  it("mints NFT with commitment data", async () => {
    prismaMock.cashtokenConfig.findFirst.mockResolvedValue(
      cashtokenConfigFixture({ purpose: "RECEIPT", token_category: "r".repeat(64) })
    );
    prismaMock.receiptNFT.create.mockResolvedValue({ id: "rn1" });

    const result = await cashTokenService.mintReceiptNFT("m1", "bchtest:q", {
      txHash: "abcdef1234567890",
      amountSats: 50000n,
      memo: "Coffee purchase",
      timestamp: new Date("2025-06-01T12:00:00Z"),
    });
    expect(result.nftCategory).toHaveLength(64);
    expect(result.commitment).toHaveLength(40); // 20 bytes = 40 hex chars
    expect(result.txHash).toBeDefined();
    expect(result.receiptId).toBe("rn1");
  });

  it("handles missing receipt config gracefully", async () => {
    prismaMock.cashtokenConfig.findFirst.mockResolvedValue(null);
    prismaMock.receiptNFT.create.mockResolvedValue({ id: "rn2" });
    const result = await cashTokenService.mintReceiptNFT("m1", "bchtest:q", {
      txHash: "tx1",
      amountSats: 1000n,
      timestamp: new Date(),
    });
    expect(result.nftCategory).toHaveLength(64);
  });

  it("handles missing memo in commitment", async () => {
    prismaMock.cashtokenConfig.findFirst.mockResolvedValue(null);
    prismaMock.receiptNFT.create.mockResolvedValue({ id: "rn3" });
    const result = await cashTokenService.mintReceiptNFT("m1", "bchtest:q", {
      txHash: "tx2",
      amountSats: 2000n,
      timestamp: new Date(),
    });
    expect(result.commitment).toHaveLength(40);
  });
});

describe("cashTokenService.enableReceiptNFTs", () => {
  it("creates receipt token config", async () => {
    prismaMock.cashtokenConfig.create.mockResolvedValue(
      cashtokenConfigFixture({ purpose: "RECEIPT", token_symbol: "RCPT" })
    );
    const config = await cashTokenService.enableReceiptNFTs("m1");
    expect(prismaMock.cashtokenConfig.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          purpose: "RECEIPT",
          token_symbol: "RCPT",
        }),
      })
    );
  });

  it("accepts custom name", async () => {
    prismaMock.cashtokenConfig.create.mockResolvedValue(cashtokenConfigFixture());
    await cashTokenService.enableReceiptNFTs("m1", "My Receipts");
    expect(prismaMock.cashtokenConfig.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ token_name: "My Receipts" }),
      })
    );
  });
});

describe("cashTokenService.generateBCMR", () => {
  it("generates BCMR metadata for LOYALTY token", () => {
    const bcmr = cashTokenService.generateBCMR({
      token_category: "a".repeat(64),
      token_name: "ShopCoin",
      token_symbol: "SHOP",
      token_decimals: 0,
      purpose: "LOYALTY",
    });
    expect(bcmr.name).toBe("ShopCoin");
    expect(bcmr.description).toContain("Loyalty");
    expect(bcmr.token.symbol).toBe("SHOP");
    expect(bcmr.token.category).toHaveLength(64);
  });

  it("generates BCMR metadata for RECEIPT token", () => {
    const bcmr = cashTokenService.generateBCMR({
      token_category: "b".repeat(64),
      token_name: "Receipt",
      token_symbol: "RCPT",
      token_decimals: 0,
      purpose: "RECEIPT",
    });
    expect(bcmr.description).toContain("receipt");
  });
});

describe("cashTokenService.getTokenStats", () => {
  it("returns stats with configured tokens", async () => {
    prismaMock.cashtokenConfig.findFirst
      .mockResolvedValueOnce(cashtokenConfigFixture({ token_symbol: "SHOP" }))
      .mockResolvedValueOnce(cashtokenConfigFixture({ purpose: "RECEIPT" }));
    prismaMock.tokenIssuance.aggregate.mockResolvedValue({
      _sum: { amount: 500n },
      _count: { id: 10 },
    });
    prismaMock.receiptNFT.count.mockResolvedValue(5);

    const stats = await cashTokenService.getTokenStats("m1");
    expect(stats.loyaltyTokens.configured).toBe(true);
    expect(stats.loyaltyTokens.symbol).toBe("SHOP");
    expect(stats.loyaltyTokens.totalIssued).toBe(500);
    expect(stats.loyaltyTokens.issuanceCount).toBe(10);
    expect(stats.receiptNFTs.configured).toBe(true);
    expect(stats.receiptNFTs.totalMinted).toBe(5);
  });

  it("returns unconfigured when no tokens exist", async () => {
    prismaMock.cashtokenConfig.findFirst.mockResolvedValue(null);
    prismaMock.tokenIssuance.aggregate.mockResolvedValue({
      _sum: { amount: null },
      _count: { id: 0 },
    });
    prismaMock.receiptNFT.count.mockResolvedValue(0);

    const stats = await cashTokenService.getTokenStats("m1");
    expect(stats.loyaltyTokens.configured).toBe(false);
    expect(stats.receiptNFTs.configured).toBe(false);
    expect(stats.loyaltyTokens.totalIssued).toBe(0);
    expect(stats.receiptNFTs.totalMinted).toBe(0);
  });
});
