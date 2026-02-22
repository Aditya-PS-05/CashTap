import { describe, it, expect } from "vitest";
import { createTestApp } from "../helpers/app.js";
import { prismaMock } from "../helpers/mock-prisma.js";
import { merchantFixture } from "../helpers/fixtures.js";
import { makeToken, TEST_MERCHANT_ID } from "../helpers/auth.js";

const app = createTestApp();
const TOKEN = makeToken();
const authHeader = { Authorization: `Bearer ${TOKEN}` };

function json(body: unknown, token?: string) {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  };
}

// ---------- POST /api/merchants (register) ----------

describe("POST /api/merchants", () => {
  const validBody = {
    bch_address: "bchtest:qr95sy3j9xwd2ap32xkykttr4cvcu7as5yg42lrhk3",
    business_name: "New Store",
  };

  it("creates a merchant and returns 201", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(null);
    const created = merchantFixture({ business_name: "New Store" });
    prismaMock.merchant.create.mockResolvedValue(created);
    prismaMock.apiKey.create.mockResolvedValue({ id: "key1" });

    const res = await app.request("/api/merchants", json(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.merchant.business_name).toBe("New Store");
    expect(body.api_key).toMatch(/^bchpay_/);
  });

  it("returns 409 when address already exists", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    const res = await app.request("/api/merchants", json(validBody));
    expect(res.status).toBe(409);
  });

  it("returns 400 for missing bch_address", async () => {
    const res = await app.request(
      "/api/merchants",
      json({ business_name: "Test" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid bch_address format", async () => {
    const res = await app.request(
      "/api/merchants",
      json({ bch_address: "invalid", business_name: "Test" })
    );
    expect(res.status).toBe(400);
  });

  it("accepts optional fields (email, logo_url, webhook_url)", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(null);
    prismaMock.merchant.create.mockResolvedValue(
      merchantFixture({ email: "a@b.com", webhook_url: "https://hook.example.com" })
    );
    prismaMock.apiKey.create.mockResolvedValue({ id: "key1" });

    const res = await app.request(
      "/api/merchants",
      json({
        ...validBody,
        email: "a@b.com",
        webhook_url: "https://hook.example.com",
      })
    );
    expect(res.status).toBe(201);
  });
});

// ---------- GET /api/merchants/me ----------

describe("GET /api/merchants/me", () => {
  it("returns authenticated merchant profile", async () => {
    const merchant = {
      ...merchantFixture(),
      _count: { payment_links: 3, invoices: 2, transactions: 5 },
    };
    // findUnique called by authMiddleware
    prismaMock.merchant.findUnique.mockResolvedValue(merchant);

    const res = await app.request("/api/merchants/me", {
      headers: authHeader,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.merchant.id).toBe(TEST_MERCHANT_ID);
  });

  it("returns 401 without auth", async () => {
    const res = await app.request("/api/merchants/me");
    expect(res.status).toBe(401);
  });

  it("returns 404 when merchant deleted after token issued", async () => {
    // authMiddleware finds merchant, but then GET /me does another findUnique
    prismaMock.merchant.findUnique
      .mockResolvedValueOnce(merchantFixture()) // authMiddleware
      .mockResolvedValueOnce(null); // GET /me handler

    const res = await app.request("/api/merchants/me", {
      headers: authHeader,
    });
    expect(res.status).toBe(404);
  });
});

// ---------- GET /api/merchants/:id ----------

describe("GET /api/merchants/:id", () => {
  it("returns public merchant profile by id", async () => {
    const merchant = {
      ...merchantFixture(),
      _count: { payment_links: 1 },
    };
    prismaMock.merchant.findUnique.mockResolvedValue(merchant);

    const res = await app.request(`/api/merchants/${TEST_MERCHANT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.merchant.business_name).toBe("Test Merchant");
  });

  it("returns 404 for non-existent merchant", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(null);
    const res = await app.request("/api/merchants/does-not-exist");
    expect(res.status).toBe(404);
  });
});

// ---------- PUT /api/merchants/me ----------

describe("PUT /api/merchants/me", () => {
  it("updates business_name", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.merchant.update.mockResolvedValue(
      merchantFixture({ business_name: "Updated Name" })
    );

    const res = await app.request("/api/merchants/me", {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ business_name: "Updated Name" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.merchant.business_name).toBe("Updated Name");
  });

  it("returns 400 for empty update body", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    const res = await app.request("/api/merchants/me", {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid email", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    const res = await app.request("/api/merchants/me", {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    expect(res.status).toBe(400);
  });

  it("allows nullable fields (email, logo_url, webhook_url)", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.merchant.update.mockResolvedValue(
      merchantFixture({ email: null })
    );

    const res = await app.request("/api/merchants/me", {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ email: null }),
    });
    expect(res.status).toBe(200);
  });

  it("returns 401 without auth", async () => {
    const res = await app.request("/api/merchants/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business_name: "X" }),
    });
    expect(res.status).toBe(401);
  });
});
