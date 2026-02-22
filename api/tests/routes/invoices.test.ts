import { describe, it, expect } from "vitest";
import { createTestApp } from "../helpers/app.js";
import { prismaMock } from "../helpers/mock-prisma.js";
import { merchantFixture, invoiceFixture } from "../helpers/fixtures.js";
import { makeToken, TEST_MERCHANT_ID } from "../helpers/auth.js";

const app = createTestApp();
const TOKEN = makeToken();
const authHeader = { Authorization: `Bearer ${TOKEN}` };

const validInvoiceBody = {
  customer_email: "cust@example.com",
  items: [{ description: "Widget", quantity: 2, unit_price_satoshis: 25000 }],
  total_satoshis: 50000,
};

// ---------- POST /api/invoices ----------

describe("POST /api/invoices", () => {
  it("creates an invoice and returns 201", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.invoice.create.mockResolvedValue(invoiceFixture());

    const res = await app.request("/api/invoices", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify(validInvoiceBody),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.invoice.id).toBeDefined();
    expect(body.invoice.total_satoshis).toBe("50000");
  });

  it("returns 400 for missing items", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    const res = await app.request("/api/invoices", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ total_satoshis: 1000 }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty items array", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    const res = await app.request("/api/invoices", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ items: [], total_satoshis: 1000 }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for negative total", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    const res = await app.request("/api/invoices", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ description: "X", quantity: 1, unit_price_satoshis: 100 }],
        total_satoshis: -1,
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 401 without auth", async () => {
    const res = await app.request("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validInvoiceBody),
    });
    expect(res.status).toBe(401);
  });

  it("accepts optional due_date", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.invoice.create.mockResolvedValue(invoiceFixture());

    const res = await app.request("/api/invoices", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ ...validInvoiceBody, due_date: "2030-01-01T00:00:00Z" }),
    });
    expect(res.status).toBe(201);
  });
});

// ---------- GET /api/invoices/:id (public) ----------

describe("GET /api/invoices/:id", () => {
  it("returns invoice by id", async () => {
    const invoice = {
      ...invoiceFixture(),
      merchant: {
        id: TEST_MERCHANT_ID,
        business_name: "Test",
        bch_address: "bchtest:q",
        logo_url: null,
        email: null,
      },
    };
    prismaMock.invoice.findUnique.mockResolvedValue(invoice);

    const res = await app.request(`/api/invoices/${invoice.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invoice.id).toBe(invoice.id);
  });

  it("marks SENT invoice as VIEWED on access", async () => {
    const invoice = {
      ...invoiceFixture({ status: "SENT" }),
      merchant: {
        id: TEST_MERCHANT_ID,
        business_name: "Test",
        bch_address: "bchtest:q",
        logo_url: null,
        email: null,
      },
    };
    prismaMock.invoice.findUnique.mockResolvedValue(invoice);
    prismaMock.invoice.update.mockResolvedValue({ ...invoice, status: "VIEWED" });

    const res = await app.request(`/api/invoices/${invoice.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invoice.status).toBe("VIEWED");
    expect(prismaMock.invoice.update).toHaveBeenCalled();
  });

  it("returns 404 for non-existent invoice", async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(null);
    const res = await app.request("/api/invoices/nonexistent");
    expect(res.status).toBe(404);
  });
});

// ---------- GET /api/invoices (list, auth) ----------

describe("GET /api/invoices (list)", () => {
  it("returns paginated list", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.invoice.findMany.mockResolvedValue([invoiceFixture()]);
    prismaMock.invoice.count.mockResolvedValue(1);

    const res = await app.request("/api/invoices", { headers: authHeader });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invoices).toHaveLength(1);
    expect(body.pagination).toBeDefined();
  });

  it("supports status filter", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.invoice.findMany.mockResolvedValue([]);
    prismaMock.invoice.count.mockResolvedValue(0);

    const res = await app.request("/api/invoices?status=PAID", {
      headers: authHeader,
    });
    expect(res.status).toBe(200);
  });
});

// ---------- PUT /api/invoices/:id ----------

describe("PUT /api/invoices/:id", () => {
  it("updates a DRAFT invoice", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.invoice.findFirst.mockResolvedValue(invoiceFixture());
    prismaMock.invoice.update.mockResolvedValue(
      invoiceFixture({ customer_email: "new@test.com" })
    );

    const res = await app.request("/api/invoices/clinv00000000000001", {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ customer_email: "new@test.com" }),
    });
    expect(res.status).toBe(200);
  });

  it("rejects update on PAID invoice", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.invoice.findFirst.mockResolvedValue(
      invoiceFixture({ status: "PAID" })
    );

    const res = await app.request("/api/invoices/clinv00000000000001", {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ customer_email: "x@y.com" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("PAID");
  });

  it("returns 404 for non-owned invoice", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    const res = await app.request("/api/invoices/clinv00000000000099", {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ customer_email: "x@y.com" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for empty update", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.invoice.findFirst.mockResolvedValue(invoiceFixture());

    const res = await app.request("/api/invoices/clinv00000000000001", {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

// ---------- POST /api/invoices/:id/send ----------

describe("POST /api/invoices/:id/send", () => {
  it("marks DRAFT invoice as SENT", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.invoice.findFirst.mockResolvedValue(invoiceFixture());
    prismaMock.invoice.update.mockResolvedValue(
      invoiceFixture({ status: "SENT" })
    );

    const res = await app.request("/api/invoices/clinv00000000000001/send", {
      method: "POST",
      headers: authHeader,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("sent");
  });

  it("rejects sending non-DRAFT invoice", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.invoice.findFirst.mockResolvedValue(
      invoiceFixture({ status: "SENT" })
    );

    const res = await app.request("/api/invoices/clinv00000000000001/send", {
      method: "POST",
      headers: authHeader,
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-owned invoice", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    const res = await app.request("/api/invoices/clinv00000000000099/send", {
      method: "POST",
      headers: authHeader,
    });
    expect(res.status).toBe(404);
  });
});

// ---------- POST /api/invoices/:id/remind ----------

describe("POST /api/invoices/:id/remind", () => {
  it("sends reminder for unpaid invoice", async () => {
    const invoice = {
      ...invoiceFixture({ status: "SENT" }),
      merchant: { business_name: "Test", bch_address: "bchtest:q" },
    };
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.invoice.findFirst.mockResolvedValue(invoice);

    const res = await app.request("/api/invoices/clinv00000000000001/remind", {
      method: "POST",
      headers: authHeader,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("reminder");
  });

  it("rejects reminder for PAID invoice", async () => {
    const invoice = {
      ...invoiceFixture({ status: "PAID" }),
      merchant: { business_name: "Test", bch_address: "bchtest:q" },
    };
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.invoice.findFirst.mockResolvedValue(invoice);

    const res = await app.request("/api/invoices/clinv00000000000001/remind", {
      method: "POST",
      headers: authHeader,
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-owned invoice", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(merchantFixture());
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    const res = await app.request("/api/invoices/clinv00000000000099/remind", {
      method: "POST",
      headers: authHeader,
    });
    expect(res.status).toBe(404);
  });
});
