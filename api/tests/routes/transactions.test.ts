import { describe, it, expect } from "vitest";
import { createTestApp } from "../helpers/app.js";
import { prismaMock } from "../helpers/mock-prisma.js";
import { merchantFixture, transactionFixture } from "../helpers/fixtures.js";
import { makeToken } from "../helpers/auth.js";

const app = createTestApp();
const TOKEN = makeToken();
const authHeader = { Authorization: `Bearer ${TOKEN}` };

// ---------- GET /api/transactions/stats ----------

describe("GET /api/transactions/stats", () => {
  it("returns aggregated stats", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount_satoshis: BigInt(100000) }, _count: 2 })
      .mockResolvedValueOnce({ _sum: { amount_satoshis: BigInt(50000) }, _count: 1 });
    prismaMock.transaction.count.mockResolvedValue(0);
    prismaMock.transaction.findMany.mockResolvedValue([]);

    const res = await app.request("/api/transactions/stats", {
      headers: authHeader,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats.confirmed.count).toBe(2);
    expect(body.stats.confirmed.total_satoshis).toBe("100000");
    expect(body.stats.pending.count).toBe(1);
  });

  it("returns 401 without auth", async () => {
    const res = await app.request("/api/transactions/stats");
    expect(res.status).toBe(401);
  });

  it("handles zero transactions gracefully", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount_satoshis: null }, _count: 0 })
      .mockResolvedValueOnce({ _sum: { amount_satoshis: null }, _count: 0 });
    prismaMock.transaction.count.mockResolvedValue(0);
    prismaMock.transaction.findMany.mockResolvedValue([]);

    const res = await app.request("/api/transactions/stats", {
      headers: authHeader,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats.confirmed.total_satoshis).toBe("0");
  });
});

// ---------- GET /api/transactions ----------

describe("GET /api/transactions (list)", () => {
  it("returns paginated transaction list", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    const tx = { ...transactionFixture(), payment_link: null, invoice: null };
    prismaMock.transaction.findMany.mockResolvedValue([tx]);
    prismaMock.transaction.count.mockResolvedValue(1);

    const res = await app.request("/api/transactions", { headers: authHeader });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0].amount_satoshis).toBe("50000");
    expect(body.pagination.total).toBe(1);
  });

  it("supports filter by status", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.transaction.findMany.mockResolvedValue([]);
    prismaMock.transaction.count.mockResolvedValue(0);

    const res = await app.request("/api/transactions?status=CONFIRMED", {
      headers: authHeader,
    });
    expect(res.status).toBe(200);
  });

  it("supports date range filter", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.transaction.findMany.mockResolvedValue([]);
    prismaMock.transaction.count.mockResolvedValue(0);

    const res = await app.request(
      "/api/transactions?from=2025-01-01T00:00:00Z&to=2025-12-31T00:00:00Z",
      { headers: authHeader }
    );
    expect(res.status).toBe(200);
  });

  it("supports payment_link_id and invoice_id filters", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.transaction.findMany.mockResolvedValue([]);
    prismaMock.transaction.count.mockResolvedValue(0);

    const res = await app.request(
      "/api/transactions?payment_link_id=abc&invoice_id=def",
      { headers: authHeader }
    );
    expect(res.status).toBe(200);
  });

  it("returns 401 without auth", async () => {
    const res = await app.request("/api/transactions");
    expect(res.status).toBe(401);
  });
});

// ---------- GET /api/transactions/:id ----------

describe("GET /api/transactions/:id", () => {
  it("returns transaction with nested relations", async () => {
    const tx = {
      ...transactionFixture(),
      payment_link: { id: "pl1", slug: "abc", memo: "test", amount_satoshis: BigInt(50000), type: "SINGLE" },
      invoice: null,
      merchant: { id: "m1", business_name: "Test", bch_address: "bchtest:q" },
    };
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.transaction.findFirst.mockResolvedValue(tx);

    const res = await app.request("/api/transactions/cltx0000000000000001", {
      headers: authHeader,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transaction.amount_satoshis).toBe("50000");
    expect(body.transaction.payment_link.amount_satoshis).toBe("50000");
  });

  it("returns 404 for non-existent transaction", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.transaction.findFirst.mockResolvedValue(null);

    const res = await app.request("/api/transactions/nonexistent", {
      headers: authHeader,
    });
    expect(res.status).toBe(404);
  });
});
