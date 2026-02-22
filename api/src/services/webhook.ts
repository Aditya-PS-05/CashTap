import { prisma } from "../lib/prisma.js";
import crypto from "crypto";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const TIMEOUT_MS = 10000;

class WebhookService {
  /**
   * Deliver a webhook event to a merchant's configured URL.
   * Retries up to MAX_RETRIES with exponential backoff.
   */
  async deliver(
    merchantId: string,
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    if (!merchant?.webhook_url) {
      return; // No webhook configured
    }

    // Create webhook record
    const webhook = await prisma.webhook.create({
      data: {
        merchant_id: merchantId,
        event_type: eventType,
        payload: payload as any,
        status: "PENDING",
        attempts: 0,
      },
    });

    // Attempt delivery with retries
    await this.attemptDelivery(webhook.id, merchant.webhook_url, eventType, payload);
  }

  private async attemptDelivery(
    webhookId: string,
    url: string,
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const body = JSON.stringify({
          event: eventType,
          data: payload,
          timestamp: new Date().toISOString(),
          webhook_id: webhookId,
        });

        // Generate HMAC-SHA256 signature
        const secret = process.env.WEBHOOK_SECRET || "whsec_default";
        const signature = crypto
          .createHmac("sha256", secret)
          .update(body)
          .digest("hex");

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-BCHPay-Signature": `sha256=${signature}`,
            "X-BCHPay-Event": eventType,
            "X-BCHPay-Delivery": webhookId,
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        await prisma.webhook.update({
          where: { id: webhookId },
          data: {
            attempts: attempt,
            last_attempt_at: new Date(),
            status: response.ok ? "DELIVERED" : "FAILED",
          },
        });

        if (response.ok) {
          console.log(
            `[Webhook] Delivered ${eventType} to ${url} (attempt ${attempt})`
          );
          return;
        }

        console.warn(
          `[Webhook] ${eventType} to ${url} returned ${response.status} (attempt ${attempt})`
        );
      } catch (err: any) {
        console.error(
          `[Webhook] ${eventType} to ${url} failed (attempt ${attempt}):`,
          err.message
        );

        await prisma.webhook.update({
          where: { id: webhookId },
          data: {
            attempts: attempt,
            last_attempt_at: new Date(),
            status: attempt >= MAX_RETRIES ? "FAILED" : "PENDING",
          },
        });
      }

      // Exponential backoff before retry
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Send a test webhook to verify merchant's endpoint.
   */
  async sendTest(merchantId: string): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    if (!merchant?.webhook_url) {
      return { success: false, error: "No webhook URL configured" };
    }

    try {
      const body = JSON.stringify({
        event: "test",
        data: {
          message: "This is a test webhook from BCH Pay",
          merchant_id: merchantId,
        },
        timestamp: new Date().toISOString(),
      });

      const secret = process.env.WEBHOOK_SECRET || "whsec_default";
      const signature = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("hex");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(merchant.webhook_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-BCHPay-Signature": `sha256=${signature}`,
          "X-BCHPay-Event": "test",
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      return {
        success: response.ok,
        statusCode: response.status,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
      };
    }
  }
}

export const webhookService = new WebhookService();
