import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";

import authRoutes from "./routes/auth.js";
import merchantRoutes from "./routes/merchants.js";
import paymentLinkRoutes from "./routes/payment-links.js";
import transactionRoutes from "./routes/transactions.js";
import invoiceRoutes from "./routes/invoices.js";
import deviceRoutes from "./routes/devices.js";
import contractRoutes from "./routes/contracts.js";
import cashtokenRoutes from "./routes/cashtokens.js";
import priceRoutes from "./routes/price.js";
import checkoutRoutes from "./routes/checkout.js";
import eventRoutes from "./routes/events.js";
import walletRoutes from "./routes/wallet.js";
import { rateLimiter, authRateLimiter } from "./middleware/rate-limit.js";

const app = new Hono();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "x-api-key"],
    exposeHeaders: ["X-Request-Id", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"],
    maxAge: 86400,
  })
);

app.use("*", logger());

// Security headers
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "SAMEORIGIN");
  c.header("X-XSS-Protection", "1; mode=block");
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

app.onError((err, c) => {
  console.error(`[ERROR] ${err.message}`, err.stack);

  // Zod validation errors forwarded from middleware
  if (err.message.includes("Validation")) {
    return c.json({ error: err.message, code: "VALIDATION_ERROR" }, 400);
  }

  // Prisma known errors
  if (err.message.includes("Unique constraint")) {
    return c.json({ error: "Resource already exists", code: "ALREADY_EXISTS" }, 409);
  }

  if (err.message.includes("Record to update not found")) {
    return c.json({ error: "Resource not found", code: "NOT_FOUND" }, 404);
  }

  if (err.message.includes("Unauthorized") || err.message.includes("unauthorized")) {
    return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }

  return c.json(
    {
      error: "Internal server error",
      code: "INTERNAL_ERROR",
      ...(process.env.NODE_ENV === "development" && {
        message: err.message,
      }),
    },
    500
  );
});

// ---------------------------------------------------------------------------
// Not-found handler
// ---------------------------------------------------------------------------

app.notFound((c) => {
  return c.json(
    {
      error: "Not found",
      code: "NOT_FOUND",
      path: c.req.path,
      method: c.req.method,
    },
    404
  );
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    service: "bch-pay-api",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ---------------------------------------------------------------------------
// Route groups — original /api/ prefix (backward compat)
// ---------------------------------------------------------------------------

app.route("/api/auth", authRoutes);
app.route("/api/merchants", merchantRoutes);
app.route("/api/payment-links", paymentLinkRoutes);
app.route("/api/transactions", transactionRoutes);
app.route("/api/invoices", invoiceRoutes);
app.route("/api/devices", deviceRoutes);
app.route("/api/contracts", contractRoutes);
app.route("/api/cashtokens", cashtokenRoutes);
app.route("/api/price", priceRoutes);
app.route("/api/checkout", checkoutRoutes);
app.route("/api/events", eventRoutes);
app.route("/api/wallet", walletRoutes);

// ---------------------------------------------------------------------------
// Route groups — versioned /api/v1/ prefix (with rate limiting)
// ---------------------------------------------------------------------------

app.use("/api/v1/*", rateLimiter);

// Stricter rate limit on auth endpoints
app.use("/api/v1/auth/*", authRateLimiter);

app.route("/api/v1/auth", authRoutes);
app.route("/api/v1/merchants", merchantRoutes);
app.route("/api/v1/payment-links", paymentLinkRoutes);
app.route("/api/v1/transactions", transactionRoutes);
app.route("/api/v1/invoices", invoiceRoutes);
app.route("/api/v1/devices", deviceRoutes);
app.route("/api/v1/contracts", contractRoutes);
app.route("/api/v1/cashtokens", cashtokenRoutes);
app.route("/api/v1/price", priceRoutes);
app.route("/api/v1/checkout", checkoutRoutes);
app.route("/api/v1/events", eventRoutes);
app.route("/api/v1/wallet", walletRoutes);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const port = parseInt(process.env.PORT || "3456", 10);

console.log(`
  ╔══════════════════════════════════════╗
  ║         BCH Pay API Server           ║
  ║──────────────────────────────────────║
  ║  Port:  ${String(port).padEnd(27)}║
  ║  Env:   ${(process.env.NODE_ENV || "development").padEnd(27)}║
  ╚══════════════════════════════════════╝
`);

serve({
  fetch: app.fetch,
  port,
});

// ---------------------------------------------------------------------------
// Initialize blockchain services
// ---------------------------------------------------------------------------

async function initBlockchainServices() {
  try {
    // Initialize wallet from seed phrase (env) or generate new one
    const { walletService } = await import("./services/wallet.js");
    const seedPhrase = process.env.BCH_SEED_PHRASE;

    if (seedPhrase) {
      await walletService.initMasterWallet(seedPhrase);
    } else {
      console.log("[Init] No BCH_SEED_PHRASE set — wallet will initialize on first use");
    }

    // Start transaction monitor
    const { transactionMonitor } = await import("./services/monitor.js");
    await transactionMonitor.connect();
    await transactionMonitor.loadActivePaymentLinks();
    await transactionMonitor.loadActiveContracts();
    transactionMonitor.startPolling(10_000); // Poll every 10s as fallback

    console.log("[Init] Blockchain services initialized");
  } catch (err) {
    console.error("[Init] Blockchain services failed to start:", err);
    console.log("[Init] API will continue running without blockchain monitoring");
  }
}

// Start blockchain services asynchronously (don't block the HTTP server)
initBlockchainServices();

export default app;
