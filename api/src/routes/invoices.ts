import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AppEnv } from "../types/hono.js";

const invoices = new Hono<AppEnv>();

// --- Schemas ---

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_price_satoshis: z.number().int().nonnegative(),
});

const createInvoiceSchema = z.object({
  customer_email: z.string().email().optional(),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
  total_satoshis: z
    .number()
    .int()
    .positive("Total must be a positive integer (satoshis)"),
  due_date: z.string().datetime().optional(),
});

const updateInvoiceSchema = z.object({
  customer_email: z.string().email().optional().nullable(),
  items: z.array(invoiceItemSchema).min(1).optional(),
  total_satoshis: z.number().int().positive().optional(),
  status: z.enum(["DRAFT", "SENT", "VIEWED", "PAID", "OVERDUE"]).optional(),
  due_date: z.string().datetime().optional().nullable(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["DRAFT", "SENT", "VIEWED", "PAID", "OVERDUE"]).optional(),
});

// --- Routes ---

/**
 * POST /api/invoices
 * Create a new invoice.
 */
invoices.post("/", authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = createInvoiceSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const merchantId = c.get("merchantId") as string;
  const { customer_email, items, total_satoshis, due_date } = parsed.data;

  const invoice = await prisma.invoice.create({
    data: {
      merchant_id: merchantId,
      customer_email: customer_email ?? null,
      items: items as any,
      total_satoshis: BigInt(total_satoshis),
      due_date: due_date ? new Date(due_date) : null,
    },
  });

  return c.json({ invoice: serializeInvoice(invoice) }, 201);
});

/**
 * GET /api/invoices/:id
 * Public endpoint — get invoice by ID (for customer viewing).
 */
invoices.get("/:id", async (c) => {
  const id = c.req.param("id");

  // Skip the route if id matches a sub-route pattern
  // (Hono matches in order, so this shouldn't be needed, but just in case)

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      merchant: {
        select: {
          id: true,
          business_name: true,
          bch_address: true,
          logo_url: true,
          email: true,
        },
      },
    },
  });

  if (!invoice) {
    return c.json({ error: "Invoice not found" }, 404);
  }

  // If the invoice is SENT, mark it as VIEWED
  if (invoice.status === "SENT") {
    await prisma.invoice.update({
      where: { id },
      data: { status: "VIEWED" },
    });
    invoice.status = "VIEWED";
  }

  return c.json({
    invoice: {
      ...serializeInvoice(invoice),
      merchant: invoice.merchant,
    },
  });
});

/**
 * GET /api/invoices
 * List the authenticated merchant's invoices (paginated).
 */
invoices.get("/", authMiddleware, async (c) => {
  const query = listQuerySchema.safeParse(c.req.query());

  if (!query.success) {
    return c.json(
      { error: "Invalid query parameters", details: query.error.flatten() },
      400
    );
  }

  const merchantId = c.get("merchantId") as string;
  const { page, limit, status } = query.data;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { merchant_id: merchantId };
  if (status) where.status = status;

  const [invoicesList, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: "desc" },
    }),
    prisma.invoice.count({ where }),
  ]);

  return c.json({
    invoices: invoicesList.map(serializeInvoice),
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  });
});

/**
 * PUT /api/invoices/:id
 * Update an invoice (only if DRAFT or SENT).
 */
invoices.put("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const merchantId = c.get("merchantId") as string;
  const body = await c.req.json();
  const parsed = updateInvoiceSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const existing = await prisma.invoice.findFirst({
    where: { id, merchant_id: merchantId },
  });

  if (!existing) {
    return c.json({ error: "Invoice not found" }, 404);
  }

  // Only allow edits on DRAFT or SENT invoices (not PAID, VIEWED, OVERDUE)
  if (!["DRAFT", "SENT"].includes(existing.status)) {
    return c.json(
      {
        error: `Cannot update invoice with status '${existing.status}'. Only DRAFT or SENT invoices can be edited.`,
      },
      400
    );
  }

  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) {
      if (key === "items") {
        data[key] = JSON.stringify(value);
      } else if (key === "total_satoshis") {
        data[key] = BigInt(value as number);
      } else if (key === "due_date" && value !== null) {
        data[key] = new Date(value as string);
      } else {
        data[key] = value;
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }

  const invoice = await prisma.invoice.update({
    where: { id },
    data,
  });

  return c.json({ invoice: serializeInvoice(invoice) });
});

/**
 * POST /api/invoices/:id/send
 * Mark an invoice as SENT (and optionally trigger email notification).
 */
invoices.post("/:id/send", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const merchantId = c.get("merchantId") as string;

  const existing = await prisma.invoice.findFirst({
    where: { id, merchant_id: merchantId },
  });

  if (!existing) {
    return c.json({ error: "Invoice not found" }, 404);
  }

  if (existing.status !== "DRAFT") {
    return c.json(
      {
        error: `Cannot send invoice with status '${existing.status}'. Only DRAFT invoices can be sent.`,
      },
      400
    );
  }

  const invoice = await prisma.invoice.update({
    where: { id },
    data: { status: "SENT" },
    include: {
      merchant: {
        select: { business_name: true, bch_address: true },
      },
    },
  });

  // Send email notification to customer
  let emailSent = false;
  if (invoice.customer_email) {
    try {
      const { emailService } = await import("../services/email.js");
      const totalSats = Number(invoice.total_satoshis);
      const totalBch = (totalSats / 1e8).toFixed(8);
      const items = (invoice.items as any[]) || [];

      const result = await emailService.sendInvoice({
        to: invoice.customer_email,
        invoiceId: invoice.id,
        merchantName: invoice.merchant.business_name,
        totalBch,
        totalUsd: "0.00", // USD conversion happens client-side
        dueDate: invoice.due_date?.toISOString().split("T")[0] ?? null,
        items,
      });
      emailSent = result.sent;
    } catch {
      // Email sending is best-effort
    }
  }

  // Create webhook event for invoice.sent
  try {
    const { webhookService } = await import("../services/webhook.js");
    await webhookService.deliver(merchantId, "invoice.sent", {
      invoice_id: id,
      customer_email: invoice.customer_email,
      total_satoshis: invoice.total_satoshis.toString(),
    });
  } catch {
    // Webhook delivery is best-effort
  }

  return c.json({
    invoice: serializeInvoice(invoice),
    message: emailSent ? "Invoice sent to customer" : "Invoice marked as sent",
    email_sent: emailSent,
  });
});

/**
 * POST /api/invoices/:id/remind
 * Send a payment reminder for an unpaid invoice.
 * Triggers a webhook event and (when configured) an email to the customer.
 */
invoices.post("/:id/remind", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const merchantId = c.get("merchantId") as string;

  const invoice = await prisma.invoice.findFirst({
    where: { id, merchant_id: merchantId },
    include: {
      merchant: {
        select: { business_name: true, bch_address: true },
      },
    },
  });

  if (!invoice) {
    return c.json({ error: "Invoice not found" }, 404);
  }

  // Only remind for unpaid invoices
  if (invoice.status === "PAID") {
    return c.json({ error: "Invoice is already paid" }, 400);
  }

  // If the invoice is DRAFT, mark it as SENT first
  if (invoice.status === "DRAFT") {
    await prisma.invoice.update({
      where: { id },
      data: { status: "SENT" },
    });
  }

  // If overdue, update status
  if (
    invoice.due_date &&
    new Date(invoice.due_date) < new Date() &&
    invoice.status !== "OVERDUE"
  ) {
    await prisma.invoice.update({
      where: { id },
      data: { status: "OVERDUE" },
    });
  }

  // Trigger webhook for the reminder
  try {
    const { webhookService } = await import("../services/webhook.js");
    await webhookService.deliver(merchantId, "invoice.reminder", {
      invoice_id: id,
      customer_email: invoice.customer_email,
      total_satoshis: invoice.total_satoshis.toString(),
      due_date: invoice.due_date?.toISOString() ?? null,
      merchant_name: invoice.merchant.business_name,
      status: invoice.status,
    });
  } catch {
    // Webhook delivery is best-effort
  }

  // Trigger push notification to merchant as confirmation
  try {
    const { pushService } = await import("../services/push.js");
    const amountBch = Number(invoice.total_satoshis) / 100_000_000;
    const formatted = amountBch.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
    await pushService.sendToMerchant(merchantId, {
      title: "Reminder Sent",
      body: `Payment reminder sent for ${formatted} BCH invoice`,
      data: { type: "invoice_reminder", invoice_id: id },
    });
  } catch {
    // Push is best-effort
  }

  return c.json({
    message: "Payment reminder sent",
    invoice_id: id,
    customer_email: invoice.customer_email,
  });
});

// --- Helpers ---

function serializeInvoice(inv: Record<string, unknown>) {
  return {
    ...inv,
    total_satoshis: inv.total_satoshis?.toString(),
    items: inv.items,
  };
}

export default invoices;
