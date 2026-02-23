/**
 * Test Hono app factory — mirrors src/index.ts route mounting
 * but without starting a server or initializing blockchain services.
 */
import { Hono } from "hono";

import authRoutes from "../../src/routes/auth.js";
import merchantRoutes from "../../src/routes/merchants.js";
import paymentLinkRoutes from "../../src/routes/payment-links.js";
import transactionRoutes from "../../src/routes/transactions.js";
import invoiceRoutes from "../../src/routes/invoices.js";
import deviceRoutes from "../../src/routes/devices.js";
import contractRoutes from "../../src/routes/contracts.js";
import cashtokenRoutes from "../../src/routes/cashtokens.js";
import priceRoutes from "../../src/routes/price.js";

export function createTestApp(): Hono {
  const app = new Hono();

  // Error handler matching production
  app.onError((err, c) => {
    if (err.message.includes("Validation")) {
      return c.json({ error: err.message }, 400);
    }
    if (err.message.includes("Unique constraint")) {
      return c.json({ error: "Resource already exists" }, 409);
    }
    if (err.message.includes("Record to update not found")) {
      return c.json({ error: "Resource not found" }, 404);
    }
    return c.json({ error: "Internal server error", message: err.message }, 500);
  });

  app.notFound((c) => c.json({ error: "Not found", path: c.req.path }, 404));

  app.get("/api/health", (c) =>
    c.json({ status: "ok", service: "bch-pay-api" })
  );

  app.route("/api/auth", authRoutes);
  app.route("/api/merchants", merchantRoutes);
  app.route("/api/payment-links", paymentLinkRoutes);
  app.route("/api/transactions", transactionRoutes);
  app.route("/api/invoices", invoiceRoutes);
  app.route("/api/devices", deviceRoutes);
  app.route("/api/contracts", contractRoutes);
  app.route("/api/cashtokens", cashtokenRoutes);
  app.route("/api/price", priceRoutes);

  return app;
}
