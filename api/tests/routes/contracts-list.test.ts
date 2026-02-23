import { describe, it, expect } from "vitest";
import { createTestApp } from "../helpers/app.js";
import { prismaMock } from "../helpers/mock-prisma.js";
import { merchantFixture, contractInstanceFixture } from "../helpers/fixtures.js";
import { makeToken } from "../helpers/auth.js";

const app = createTestApp();
const TOKEN = makeToken();
const authHeader = { Authorization: `Bearer ${TOKEN}` };

// ---------- GET /api/contracts ----------

describe("GET /api/contracts", () => {
  it("returns paginated list of contracts", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.contractInstance.findMany.mockResolvedValue([
      contractInstanceFixture(),
      contractInstanceFixture({ id: "clcon0000000000000002", contract_type: "SPLIT_PAYMENT" }),
    ]);
    prismaMock.contractInstance.count.mockResolvedValue(2);

    const res = await app.request("/api/contracts", { headers: authHeader });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.contracts).toHaveLength(2);
    expect(body.pagination.total).toBe(2);
  });

  it("filters by type", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.contractInstance.findMany.mockResolvedValue([
      contractInstanceFixture({ contract_type: "ESCROW" }),
    ]);
    prismaMock.contractInstance.count.mockResolvedValue(1);

    const res = await app.request("/api/contracts?type=ESCROW", { headers: authHeader });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.contracts).toHaveLength(1);
  });

  it("filters by status", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.contractInstance.findMany.mockResolvedValue([]);
    prismaMock.contractInstance.count.mockResolvedValue(0);

    const res = await app.request("/api/contracts?status=COMPLETED", { headers: authHeader });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.contracts).toHaveLength(0);
  });

  it("returns 401 without auth", async () => {
    const res = await app.request("/api/contracts");
    expect(res.status).toBe(401);
  });
});

// ---------- PATCH /api/contracts/:id/status ----------

describe("PATCH /api/contracts/:id/status", () => {
  it("transitions ACTIVE to COMPLETED", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.contractInstance.findFirst.mockResolvedValue(
      contractInstanceFixture({ status: "ACTIVE" })
    );
    prismaMock.contractInstance.update.mockResolvedValue(
      contractInstanceFixture({ status: "COMPLETED" })
    );

    const res = await app.request("/api/contracts/clcon0000000000000001/status", {
      method: "PATCH",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.contract.status).toBe("COMPLETED");
  });

  it("transitions ACTIVE to EXPIRED", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.contractInstance.findFirst.mockResolvedValue(
      contractInstanceFixture({ status: "ACTIVE" })
    );
    prismaMock.contractInstance.update.mockResolvedValue(
      contractInstanceFixture({ status: "EXPIRED" })
    );

    const res = await app.request("/api/contracts/clcon0000000000000001/status", {
      method: "PATCH",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "EXPIRED" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.contract.status).toBe("EXPIRED");
  });

  it("rejects transition from non-ACTIVE status", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.contractInstance.findFirst.mockResolvedValue(
      contractInstanceFixture({ status: "COMPLETED" })
    );

    const res = await app.request("/api/contracts/clcon0000000000000001/status", {
      method: "PATCH",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "EXPIRED" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent contract", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.contractInstance.findFirst.mockResolvedValue(null);

    const res = await app.request("/api/contracts/nonexistent/status", {
      method: "PATCH",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    expect(res.status).toBe(404);
  });
});
