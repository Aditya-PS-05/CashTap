import { describe, it, expect } from "vitest";
import { createTestApp } from "../helpers/app.js";

const app = createTestApp();

describe("GET /api/price", () => {
  it("returns BCH/USD price", async () => {
    const res = await app.request("/api/price");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bch_usd).toBe(350.0);
    expect(body.updated_at).toBeDefined();
  });

  it("does not require authentication", async () => {
    const res = await app.request("/api/price");
    expect(res.status).toBe(200);
  });

  it("returns expected shape", async () => {
    const res = await app.request("/api/price");
    const body = await res.json();
    expect(typeof body.bch_usd).toBe("number");
    expect(typeof body.updated_at).toBe("string");
  });
});
