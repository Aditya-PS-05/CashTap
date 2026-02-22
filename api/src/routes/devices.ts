import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AppEnv } from "../types/hono.js";

const devices = new Hono<AppEnv>();

// --- Schemas ---

const registerDeviceSchema = z.object({
  device_token: z.string().min(1, "Device token is required"),
  platform: z.enum(["IOS", "ANDROID"]),
});

// --- Routes ---

/**
 * POST /api/devices
 * Register a device for push notifications.
 */
devices.post("/", authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = registerDeviceSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const merchantId = c.get("merchantId") as string;
  const { device_token, platform } = parsed.data;

  // Upsert: if same token exists for this merchant, reactivate it
  const existing = await prisma.device.findFirst({
    where: {
      merchant_id: merchantId,
      device_token,
    },
  });

  if (existing) {
    const device = await prisma.device.update({
      where: { id: existing.id },
      data: { active: true, platform },
    });
    return c.json({ device }, 200);
  }

  const device = await prisma.device.create({
    data: {
      merchant_id: merchantId,
      device_token,
      platform,
    },
  });

  return c.json({ device }, 201);
});

/**
 * GET /api/devices
 * List registered devices for the authenticated merchant.
 */
devices.get("/", authMiddleware, async (c) => {
  const merchantId = c.get("merchantId") as string;

  const deviceList = await prisma.device.findMany({
    where: { merchant_id: merchantId },
    orderBy: { created_at: "desc" },
  });

  return c.json({ devices: deviceList });
});

/**
 * DELETE /api/devices/:id
 * Deactivate a device (stop receiving push notifications).
 */
devices.delete("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const merchantId = c.get("merchantId") as string;

  const existing = await prisma.device.findFirst({
    where: { id, merchant_id: merchantId },
  });

  if (!existing) {
    return c.json({ error: "Device not found" }, 404);
  }

  await prisma.device.update({
    where: { id },
    data: { active: false },
  });

  return c.json({ message: "Device deactivated" });
});

/**
 * POST /api/devices/test
 * Send a test push notification to all merchant devices.
 */
devices.post("/test", authMiddleware, async (c) => {
  const merchantId = c.get("merchantId") as string;

  const { pushService } = await import("../services/push.js");
  const result = await pushService.sendTest(merchantId);

  return c.json(result);
});

export default devices;
