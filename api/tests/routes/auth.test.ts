import { describe, it, expect, beforeEach } from "vitest";
import { createTestApp } from "../helpers/app.js";
import { prismaMock } from "../helpers/mock-prisma.js";
import { merchantFixture } from "../helpers/fixtures.js";
import { makeRefreshToken } from "../helpers/auth.js";

const app = createTestApp();

function json(body: unknown) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// ---------- POST /api/auth/challenge ----------

describe("POST /api/auth/challenge", () => {
  it("returns 200 with nonce for valid BCH address", async () => {
    const res = await app.request(
      "/api/auth/challenge",
      json({ address: "bchtest:qr95sy3j9xwd2ap32xkykttr4cvcu7as5yg42lrhk3" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nonce).toBeDefined();
    expect(body.message).toContain("Sign this message");
    expect(body.expires_in).toBe(300);
  });

  it("returns 400 for missing address", async () => {
    const res = await app.request("/api/auth/challenge", json({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid address format", async () => {
    const res = await app.request(
      "/api/auth/challenge",
      json({ address: "not-a-bch-address" })
    );
    expect(res.status).toBe(400);
  });

  it("accepts bitcoincash: prefixed addresses", async () => {
    const res = await app.request(
      "/api/auth/challenge",
      json({ address: "bitcoincash:qr95sy3j9xwd2ap32xkykttr4cvcu7as5y27u39gc2" })
    );
    expect(res.status).toBe(200);
  });
});

// ---------- POST /api/auth/verify ----------

describe("POST /api/auth/verify", () => {
  const TEST_ADDR = "bchtest:qr95sy3j9xwd2ap32xkykttr4cvcu7as5yg42lrhk3";

  async function getChallenge() {
    const res = await app.request(
      "/api/auth/challenge",
      json({ address: TEST_ADDR })
    );
    return (await res.json()).nonce;
  }

  it("returns tokens for valid challenge + signature", async () => {
    const nonce = await getChallenge();
    const merchant = merchantFixture();
    prismaMock.merchant.findUnique.mockResolvedValue(merchant);

    const res = await app.request(
      "/api/auth/verify",
      json({ address: TEST_ADDR, signature: "test-sig", nonce })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.access_token).toBeDefined();
    expect(body.refresh_token).toBeDefined();
    expect(body.token_type).toBe("Bearer");
    expect(body.merchant.id).toBe(merchant.id);
  });

  it("creates a new merchant when none exists", async () => {
    const nonce = await getChallenge();
    prismaMock.merchant.findUnique.mockResolvedValue(null);
    const newMerchant = merchantFixture({ business_name: "Merchant k3" });
    prismaMock.merchant.create.mockResolvedValue(newMerchant);

    const res = await app.request(
      "/api/auth/verify",
      json({ address: TEST_ADDR, signature: "test-sig", nonce })
    );
    expect(res.status).toBe(200);
    expect(prismaMock.merchant.create).toHaveBeenCalled();
  });

  it("returns 400 when no challenge exists for address", async () => {
    const res = await app.request(
      "/api/auth/verify",
      json({ address: "bchtest:qpnoexist0000000000000000000000000000000000", signature: "sig", nonce: "fake" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/No pending challenge/);
  });

  it("returns 400 for wrong nonce", async () => {
    const nonce = await getChallenge();
    const res = await app.request(
      "/api/auth/verify",
      json({ address: TEST_ADDR, signature: "sig", nonce: "wrong-nonce" })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid nonce/);
  });

  it("returns 400 when signature is empty", async () => {
    const res = await app.request(
      "/api/auth/verify",
      json({ address: TEST_ADDR, signature: "", nonce: "x" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing fields", async () => {
    const res = await app.request(
      "/api/auth/verify",
      json({ address: TEST_ADDR })
    );
    expect(res.status).toBe(400);
  });
});

// ---------- POST /api/auth/refresh ----------

describe("POST /api/auth/refresh", () => {
  it("returns new tokens for valid refresh token", async () => {
    const merchant = merchantFixture();
    prismaMock.merchant.findUnique.mockResolvedValue(merchant);
    const refreshToken = makeRefreshToken(merchant.id, merchant.bch_address);

    const res = await app.request(
      "/api/auth/refresh",
      json({ refresh_token: refreshToken })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.access_token).toBeDefined();
    expect(body.refresh_token).toBeDefined();
  });

  it("returns 401 for invalid refresh token", async () => {
    const res = await app.request(
      "/api/auth/refresh",
      json({ refresh_token: "bad-token" })
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when merchant from token no longer exists", async () => {
    const refreshToken = makeRefreshToken();
    prismaMock.merchant.findUnique.mockResolvedValue(null);

    const res = await app.request(
      "/api/auth/refresh",
      json({ refresh_token: refreshToken })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing refresh_token field", async () => {
    const res = await app.request("/api/auth/refresh", json({}));
    expect(res.status).toBe(400);
  });
});
