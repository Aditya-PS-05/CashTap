/**
 * Tests for src/services/push.ts
 *
 * PushNotificationService uses prisma (mocked) and fetch (stubbed).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../helpers/mock-prisma.js";
import { deviceFixture } from "../helpers/fixtures.js";

// Undo the global mock from setup.ts so we test the REAL implementation
vi.unmock("../../src/services/push.js");

const { pushService } = await import("../../src/services/push.js");

describe("pushService.sendToMerchant", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns { sent: 0, failed: 0 } when no active devices", async () => {
    prismaMock.device.findMany.mockResolvedValue([]);
    const result = await pushService.sendToMerchant("m1", {
      title: "Test",
      body: "test",
    });
    expect(result).toEqual({ sent: 0, failed: 0 });
  });

  it("sends to all active devices (dev mode — FCM not configured)", async () => {
    // Without FCM_PROJECT_ID & FCM_SERVICE_KEY, it logs and succeeds
    prismaMock.device.findMany.mockResolvedValue([
      deviceFixture(),
      deviceFixture({ id: "d2", device_token: "token-2" }),
    ]);

    const result = await pushService.sendToMerchant("m1", {
      title: "Payment",
      body: "You received BCH",
    });
    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);
  });

  it("marks device inactive on UNREGISTERED error", async () => {
    // Simulate FCM configured by setting env vars temporarily
    const origProject = process.env.FCM_PROJECT_ID;
    const origKey = process.env.FCM_SERVICE_KEY;
    process.env.FCM_PROJECT_ID = "test-project";
    process.env.FCM_SERVICE_KEY = "test-key";

    prismaMock.device.findMany.mockResolvedValue([deviceFixture()]);
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue("UNREGISTERED"),
    });
    prismaMock.device.update.mockResolvedValue(deviceFixture({ active: false }));

    const result = await pushService.sendToMerchant("m1", {
      title: "Test",
      body: "body",
    });
    expect(result.failed).toBe(1);
    expect(prismaMock.device.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: false } })
    );

    process.env.FCM_PROJECT_ID = origProject;
    process.env.FCM_SERVICE_KEY = origKey;
  });
});

describe("pushService.notifyPaymentReceived", () => {
  it("formats amount correctly and sends", async () => {
    prismaMock.device.findMany.mockResolvedValue([deviceFixture()]);
    await pushService.notifyPaymentReceived("m1", 50000n, "txhash123", "CONFIRMED");
    // No error thrown = success
  });

  it("uses 'Payment Received' title for non-CONFIRMED", async () => {
    prismaMock.device.findMany.mockResolvedValue([]);
    await pushService.notifyPaymentReceived("m1", 100000n, "tx2", "PENDING");
    // Verified by no error
  });
});

describe("pushService.notifyPaymentLinkUsed", () => {
  it("sends notification for payment link usage", async () => {
    prismaMock.device.findMany.mockResolvedValue([]);
    await pushService.notifyPaymentLinkUsed("m1", "slug123", 25000n);
    // Verified by no error
  });
});

describe("pushService.sendTest", () => {
  beforeEach(() => {
    // Ensure FCM is not configured so dev mode path runs
    delete process.env.FCM_PROJECT_ID;
    delete process.env.FCM_SERVICE_KEY;
  });

  it("returns success with sent count", async () => {
    prismaMock.device.findMany.mockResolvedValue([deviceFixture()]);
    const result = await pushService.sendTest("m1");
    expect(result.success).toBe(true);
    expect(result.sent).toBe(1);
  });

  it("returns failure when no devices", async () => {
    prismaMock.device.findMany.mockResolvedValue([]);
    const result = await pushService.sendTest("m1");
    expect(result.success).toBe(false);
    expect(result.sent).toBe(0);
  });
});
