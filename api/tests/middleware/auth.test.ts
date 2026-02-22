import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { prismaMock } from "../helpers/mock-prisma.js";
import { merchantFixture } from "../helpers/fixtures.js";
import { makeToken, makeExpiredToken, TEST_MERCHANT_ID, TEST_ADDRESS } from "../helpers/auth.js";

// Import real auth code — prisma is mocked globally via setup.ts
import { authMiddleware, signToken, signRefreshToken, verifyToken } from "../../src/middleware/auth.js";

// Mini app for testing the middleware
function buildApp() {
  const app = new Hono();
  app.get("/protected", authMiddleware, (c) => {
    return c.json({ merchantId: c.get("merchantId") });
  });
  return app;
}

describe("authMiddleware", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const app = buildApp();
    const res = await app.request("/protected");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/Missing/);
  });

  it("returns 401 when Authorization header has no Bearer prefix", async () => {
    const app = buildApp();
    const res = await app.request("/protected", {
      headers: { Authorization: "Token abc" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 for an invalid JWT", async () => {
    const app = buildApp();
    const res = await app.request("/protected", {
      headers: { Authorization: "Bearer not-a-real-jwt" },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid token");
  });

  it("returns 401 for an expired JWT", async () => {
    const app = buildApp();
    const token = makeExpiredToken();
    // Wait a tick so the 0s token is definitely expired
    await new Promise((r) => setTimeout(r, 50));
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Token expired");
  });

  it("returns 401 when merchant is not found in DB", async () => {
    const app = buildApp();
    prismaMock.merchant.findUnique.mockResolvedValue(null);
    const token = makeToken();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Merchant not found");
  });

  it("passes and sets context when token and merchant are valid", async () => {
    const app = buildApp();
    const merchant = merchantFixture();
    prismaMock.merchant.findUnique.mockResolvedValue(merchant);
    const token = makeToken();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.merchantId).toBe(TEST_MERCHANT_ID);
  });
});

describe("signToken / signRefreshToken / verifyToken", () => {
  it("signToken returns a valid JWT string", () => {
    const token = signToken(TEST_MERCHANT_ID, TEST_ADDRESS);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("verifyToken decodes a token signed by signToken", () => {
    const token = signToken(TEST_MERCHANT_ID, TEST_ADDRESS);
    const payload = verifyToken(token);
    expect(payload.merchantId).toBe(TEST_MERCHANT_ID);
    expect(payload.address).toBe(TEST_ADDRESS);
  });

  it("signRefreshToken creates a longer-lived token", () => {
    const token = signRefreshToken(TEST_MERCHANT_ID, TEST_ADDRESS);
    const payload = verifyToken(token);
    expect(payload.merchantId).toBe(TEST_MERCHANT_ID);
    // exp should be ~7 days from now
    const sevenDays = 7 * 24 * 3600;
    const lifetime = payload.exp - payload.iat;
    expect(lifetime).toBe(sevenDays);
  });
});
