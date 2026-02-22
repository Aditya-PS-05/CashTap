import { describe, it, expect } from "vitest";
import { createTestApp } from "../helpers/app.js";
import { prismaMock } from "../helpers/mock-prisma.js";
import { merchantFixture, paymentLinkFixture } from "../helpers/fixtures.js";
import { makeToken, TEST_MERCHANT_ID } from "../helpers/auth.js";

const app = createTestApp();
const TOKEN = makeToken();
const authHeader = { Authorization: `Bearer ${TOKEN}` };

// ---------- POST /api/payment-links ----------

describe("POST /api/payment-links", () => {
  it("creates a payment link and returns 201", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    const created = paymentLinkFixture();
    prismaMock.paymentLink.create.mockResolvedValue(created);

    const res = await app.request("/api/payment-links", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ amount_satoshis: 50000, memo: "Test" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.payment_link.slug).toBeDefined();
    expect(body.pay_url).toContain("/pay/");
  });

  it("returns 400 for missing amount_satoshis", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    const res = await app.request("/api/payment-links", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ memo: "No amount" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for negative amount", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    const res = await app.request("/api/payment-links", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ amount_satoshis: -100 }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 401 without auth", async () => {
    const res = await app.request("/api/payment-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount_satoshis: 50000 }),
    });
    expect(res.status).toBe(401);
  });

  it("accepts MULTI type and expires_at", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.paymentLink.create.mockResolvedValue(
      paymentLinkFixture({ type: "MULTI" })
    );

    const res = await app.request("/api/payment-links", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount_satoshis: 1000,
        type: "MULTI",
        expires_at: "2030-01-01T00:00:00Z",
      }),
    });
    expect(res.status).toBe(201);
  });
});

// ---------- GET /api/payment-links/:slug (public) ----------

describe("GET /api/payment-links/:slug", () => {
  it("returns payment link by slug", async () => {
    const link = {
      ...paymentLinkFixture(),
      merchant: {
        id: TEST_MERCHANT_ID,
        business_name: "Test",
        bch_address: "bchtest:qtest",
        logo_url: null,
      },
    };
    prismaMock.paymentLink.findFirst.mockResolvedValue(link);

    const res = await app.request("/api/payment-links/abc123xyz456");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payment_link.slug).toBe("abc123xyz456");
    expect(body.payment_link.amount_satoshis).toBe("50000");
  });

  it("returns 404 for non-existent slug", async () => {
    prismaMock.paymentLink.findFirst.mockResolvedValue(null);
    const res = await app.request("/api/payment-links/doesntexist1");
    expect(res.status).toBe(404);
  });

  it("marks expired link as EXPIRED", async () => {
    const expiredLink = {
      ...paymentLinkFixture({
        expires_at: new Date("2020-01-01"),
        status: "ACTIVE",
      }),
      merchant: {
        id: TEST_MERCHANT_ID,
        business_name: "Test",
        bch_address: "bchtest:q",
        logo_url: null,
      },
    };
    prismaMock.paymentLink.findFirst.mockResolvedValue(expiredLink);
    prismaMock.paymentLink.update.mockResolvedValue({
      ...expiredLink,
      status: "EXPIRED",
    });

    const res = await app.request("/api/payment-links/abc123xyz456");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payment_link.status).toBe("EXPIRED");
  });

  it("looks up by CUID id when slug is longer than 16 chars", async () => {
    const longId = "cllink0000000000000001abcde";
    prismaMock.paymentLink.findFirst.mockResolvedValue(null);
    await app.request(`/api/payment-links/${longId}`);
    expect(prismaMock.paymentLink.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: longId } })
    );
  });
});

// ---------- GET /api/payment-links (list, auth) ----------

describe("GET /api/payment-links (list)", () => {
  it("returns paginated list", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.paymentLink.findMany.mockResolvedValue([paymentLinkFixture()]);
    prismaMock.paymentLink.count.mockResolvedValue(1);

    const res = await app.request("/api/payment-links", {
      headers: authHeader,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payment_links).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });

  it("supports status and type query params", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.paymentLink.findMany.mockResolvedValue([]);
    prismaMock.paymentLink.count.mockResolvedValue(0);

    const res = await app.request(
      "/api/payment-links?status=ACTIVE&type=SINGLE&page=1&limit=10",
      { headers: authHeader }
    );
    expect(res.status).toBe(200);
  });

  it("returns 401 without auth", async () => {
    const res = await app.request("/api/payment-links");
    expect(res.status).toBe(401);
  });
});

// ---------- PUT /api/payment-links/:id ----------

describe("PUT /api/payment-links/:id", () => {
  it("updates a payment link", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.paymentLink.findFirst.mockResolvedValue(paymentLinkFixture());
    prismaMock.paymentLink.update.mockResolvedValue(
      paymentLinkFixture({ memo: "Updated" })
    );

    const res = await app.request("/api/payment-links/cllink00000000000001", {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ memo: "Updated" }),
    });
    expect(res.status).toBe(200);
  });

  it("returns 404 when not owned by merchant", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.paymentLink.findFirst.mockResolvedValue(null);

    const res = await app.request("/api/payment-links/cllink00000000000099", {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ memo: "X" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for empty update body", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.paymentLink.findFirst.mockResolvedValue(paymentLinkFixture());

    const res = await app.request("/api/payment-links/cllink00000000000001", {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

// ---------- DELETE /api/payment-links/:id ----------

describe("DELETE /api/payment-links/:id", () => {
  it("deactivates a payment link", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.paymentLink.findFirst.mockResolvedValue(paymentLinkFixture());
    prismaMock.paymentLink.update.mockResolvedValue(
      paymentLinkFixture({ status: "INACTIVE" })
    );

    const res = await app.request("/api/payment-links/cllink00000000000001", {
      method: "DELETE",
      headers: authHeader,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/deactivated/i);
  });

  it("returns 404 when link not owned", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.paymentLink.findFirst.mockResolvedValue(null);

    const res = await app.request("/api/payment-links/cllink00000000000099", {
      method: "DELETE",
      headers: authHeader,
    });
    expect(res.status).toBe(404);
  });
});
