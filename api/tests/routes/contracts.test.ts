import { describe, it, expect } from "vitest";
import { createTestApp } from "../helpers/app.js";
import { prismaMock } from "../helpers/mock-prisma.js";
import { merchantFixture, contractInstanceFixture } from "../helpers/fixtures.js";
import { makeToken } from "../helpers/auth.js";

const app = createTestApp();
const TOKEN = makeToken();
const authHeader = { Authorization: `Bearer ${TOKEN}` };
const VALID_PKH = "0".repeat(40);

// ---------- GET /api/contracts/types ----------

describe("GET /api/contracts/types", () => {
  it("returns all contract types", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());

    const res = await app.request("/api/contracts/types", {
      headers: authHeader,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.contract_types).toHaveLength(4);
  });

  it("returns 401 without auth", async () => {
    const res = await app.request("/api/contracts/types");
    expect(res.status).toBe(401);
  });
});

// ---------- POST /api/contracts/escrow ----------

describe("POST /api/contracts/escrow", () => {
  it("creates an escrow contract and returns 201", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.contractInstance.create.mockResolvedValue(contractInstanceFixture());

    const res = await app.request("/api/contracts/escrow", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        buyer_pkh: VALID_PKH,
        seller_pkh: VALID_PKH,
        arbiter_pkh: VALID_PKH,
        timeout: 1000000,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.contract.type).toBe("ESCROW");
    expect(body.contract.address).toBeDefined();
  });

  it("returns 400 for invalid PKH (too short)", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    const res = await app.request("/api/contracts/escrow", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        buyer_pkh: "abc",
        seller_pkh: VALID_PKH,
        arbiter_pkh: VALID_PKH,
        timeout: 1000000,
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing timeout", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    const res = await app.request("/api/contracts/escrow", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        buyer_pkh: VALID_PKH,
        seller_pkh: VALID_PKH,
        arbiter_pkh: VALID_PKH,
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 401 without auth", async () => {
    const res = await app.request("/api/contracts/escrow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyer_pkh: VALID_PKH,
        seller_pkh: VALID_PKH,
        arbiter_pkh: VALID_PKH,
        timeout: 1000000,
      }),
    });
    expect(res.status).toBe(401);
  });
});

// ---------- POST /api/contracts/split-payment ----------

describe("POST /api/contracts/split-payment", () => {
  it("creates a split payment contract and returns 201", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.contractInstance.create.mockResolvedValue(
      contractInstanceFixture({ contract_type: "SPLIT_PAYMENT" })
    );

    const res = await app.request("/api/contracts/split-payment", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient1_pkh: VALID_PKH,
        recipient2_pkh: VALID_PKH,
        split1_percent: 60,
        split2_percent: 40,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.contract.type).toBe("SPLIT_PAYMENT");
  });

  it("returns 400 when splits do not add to 100", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    const res = await app.request("/api/contracts/split-payment", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient1_pkh: VALID_PKH,
        recipient2_pkh: VALID_PKH,
        split1_percent: 60,
        split2_percent: 60,
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for split percent out of range", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    const res = await app.request("/api/contracts/split-payment", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient1_pkh: VALID_PKH,
        recipient2_pkh: VALID_PKH,
        split1_percent: 0,
        split2_percent: 100,
      }),
    });
    expect(res.status).toBe(400);
  });
});

// ---------- POST /api/contracts/savings-vault ----------

describe("POST /api/contracts/savings-vault", () => {
  it("creates a savings vault and returns 201", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.contractInstance.create.mockResolvedValue(
      contractInstanceFixture({ contract_type: "SAVINGS_VAULT" })
    );

    const res = await app.request("/api/contracts/savings-vault", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        owner_pkh: VALID_PKH,
        locktime: 9999999,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.contract.type).toBe("SAVINGS_VAULT");
  });

  it("returns 400 for negative locktime", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    const res = await app.request("/api/contracts/savings-vault", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ owner_pkh: VALID_PKH, locktime: -1 }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing owner_pkh", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    const res = await app.request("/api/contracts/savings-vault", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ locktime: 9999999 }),
    });
    expect(res.status).toBe(400);
  });
});

// ---------- GET /api/contracts/:id ----------

describe("GET /api/contracts/:id", () => {
  it("returns contract instance by id", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.contractInstance.findFirst.mockResolvedValue(
      contractInstanceFixture()
    );

    const res = await app.request("/api/contracts/clcon0000000000000001", {
      headers: authHeader,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.contract.type).toBe("ESCROW");
    expect(body.contract.status).toBe("ACTIVE");
  });

  it("returns 404 for non-existent contract", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.contractInstance.findFirst.mockResolvedValue(null);

    const res = await app.request("/api/contracts/nonexistent", {
      headers: authHeader,
    });
    expect(res.status).toBe(404);
  });
});
