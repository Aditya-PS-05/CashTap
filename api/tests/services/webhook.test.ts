/**
 * Tests for src/services/webhook.ts
 *
 * The WebhookService uses prisma (mocked globally) and fetch (stubbed here).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../helpers/mock-prisma.js";
import { merchantFixture, webhookFixture } from "../helpers/fixtures.js";

// Undo the global mock from setup.ts so we test the REAL implementation
vi.unmock("../../src/services/webhook.js");

const { webhookService } = await import("../../src/services/webhook.js");

describe("webhookService.deliver", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("does nothing when merchant has no webhook_url", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(
      merchantFixture({ webhook_url: null })
    );
    await webhookService.deliver("m1", "payment.confirmed", { test: true });
    expect(prismaMock.webhook.create).not.toHaveBeenCalled();
  });

  it("creates webhook record and delivers successfully", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(
      merchantFixture({ webhook_url: "https://example.com/hook" })
    );
    prismaMock.webhook.create.mockResolvedValue(webhookFixture());
    prismaMock.webhook.update.mockResolvedValue(webhookFixture({ status: "DELIVERED" }));
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200 });

    await webhookService.deliver("m1", "payment.confirmed", { tx: "abc" });

    expect(prismaMock.webhook.create).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      "https://example.com/hook",
      expect.objectContaining({ method: "POST" })
    );
    expect(prismaMock.webhook.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DELIVERED" }),
      })
    );
  });

  it("includes HMAC signature and event headers", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(
      merchantFixture({ webhook_url: "https://example.com/hook" })
    );
    prismaMock.webhook.create.mockResolvedValue(webhookFixture());
    prismaMock.webhook.update.mockResolvedValue(webhookFixture());
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200 });

    await webhookService.deliver("m1", "payment.confirmed", {});

    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = fetchCall[1].headers;
    expect(headers["X-BCHPay-Signature"]).toMatch(/^sha256=/);
    expect(headers["X-BCHPay-Event"]).toBe("payment.confirmed");
    expect(headers["X-BCHPay-Delivery"]).toBeDefined();
  });

  it("retries on failure and eventually marks as FAILED", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(
      merchantFixture({ webhook_url: "https://example.com/hook" })
    );
    prismaMock.webhook.create.mockResolvedValue(webhookFixture());
    prismaMock.webhook.update.mockResolvedValue(webhookFixture());
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network error"));

    await webhookService.deliver("m1", "test", {});

    // Should have been called 3 times (MAX_RETRIES)
    expect(fetch).toHaveBeenCalledTimes(3);
    // Last update should mark as FAILED
    const lastUpdate = prismaMock.webhook.update.mock.calls.at(-1)?.[0];
    expect(lastUpdate?.data?.status).toBe("FAILED");
  });

  it("retries when server returns non-ok status", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(
      merchantFixture({ webhook_url: "https://example.com/hook" })
    );
    prismaMock.webhook.create.mockResolvedValue(webhookFixture());
    prismaMock.webhook.update.mockResolvedValue(webhookFixture());
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    await webhookService.deliver("m1", "test", {});

    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

describe("webhookService.sendTest", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns error when no webhook URL configured", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(
      merchantFixture({ webhook_url: null })
    );

    const result = await webhookService.sendTest("m1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("No webhook URL");
  });

  it("returns success for 200 response", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(
      merchantFixture({ webhook_url: "https://example.com/hook" })
    );
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200 });

    const result = await webhookService.sendTest("m1");
    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
  });

  it("returns failure for non-ok response", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(
      merchantFixture({ webhook_url: "https://example.com/hook" })
    );
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 503 });

    const result = await webhookService.sendTest("m1");
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(503);
  });

  it("returns failure on network error", async () => {
    prismaMock.merchant.findUnique.mockResolvedValue(
      merchantFixture({ webhook_url: "https://example.com/hook" })
    );
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("timeout"));

    const result = await webhookService.sendTest("m1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("timeout");
  });
});
