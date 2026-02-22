import { prisma } from "../lib/prisma.js";

/**
 * Push notification service using Firebase Cloud Messaging (FCM).
 *
 * Sends payment alerts and status updates to merchant mobile devices.
 * Device tokens are registered via the /api/devices endpoint.
 */

// FCM HTTP v1 API endpoint
const FCM_API_URL = "https://fcm.googleapis.com/v1/projects/{PROJECT_ID}/messages:send";

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

class PushNotificationService {
  private projectId: string;
  private accessToken: string | null = null;

  constructor() {
    this.projectId = process.env.FCM_PROJECT_ID || "bch-pay";
  }

  /**
   * Send a push notification to all active devices for a merchant.
   */
  async sendToMerchant(
    merchantId: string,
    payload: PushPayload
  ): Promise<{ sent: number; failed: number }> {
    const devices = await prisma.device.findMany({
      where: {
        merchant_id: merchantId,
        active: true,
      },
    });

    if (devices.length === 0) {
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const device of devices) {
      try {
        await this.sendToDevice(device.device_token, payload);
        sent++;
      } catch (err: any) {
        console.error(
          `[Push] Failed to send to device ${device.id}:`,
          err.message
        );
        failed++;

        // If the token is invalid, mark device as inactive
        if (
          err.message?.includes("UNREGISTERED") ||
          err.message?.includes("INVALID_ARGUMENT")
        ) {
          await prisma.device.update({
            where: { id: device.id },
            data: { active: false },
          });
        }
      }
    }

    console.log(
      `[Push] Sent ${sent}/${devices.length} notifications to merchant ${merchantId}`
    );
    return { sent, failed };
  }

  /**
   * Send a push notification to a specific device token.
   */
  private async sendToDevice(
    deviceToken: string,
    payload: PushPayload
  ): Promise<void> {
    // In production, use google-auth-library to get an OAuth2 access token
    // from a service account, then call FCM HTTP v1 API.
    //
    // For the hackathon, we log the notification and simulate sending.

    const fcmProjectId = process.env.FCM_PROJECT_ID;
    const fcmServiceKey = process.env.FCM_SERVICE_KEY;

    if (!fcmProjectId || !fcmServiceKey) {
      // FCM not configured — log and return (dev mode)
      console.log(
        `[Push] (dev) Would send to ${deviceToken.slice(0, 20)}...: ${payload.title} — ${payload.body}`
      );
      return;
    }

    const url = FCM_API_URL.replace("{PROJECT_ID}", fcmProjectId);

    const message = {
      message: {
        token: deviceToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        android: {
          priority: "high" as const,
          notification: {
            channel_id: "bch_pay_payments",
            sound: "payment_received",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "payment_received.caf",
              badge: 1,
            },
          },
        },
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${fcmServiceKey}`,
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`FCM error ${response.status}: ${errorBody}`);
    }
  }

  /**
   * Send a payment received notification.
   */
  async notifyPaymentReceived(
    merchantId: string,
    amountSats: bigint,
    txHash: string,
    status: string
  ): Promise<void> {
    const amountBch = Number(amountSats) / 100_000_000;
    const formattedAmount = amountBch.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");

    await this.sendToMerchant(merchantId, {
      title: status === "CONFIRMED" ? "Payment Confirmed" : "Payment Received",
      body: `${formattedAmount} BCH received`,
      data: {
        type: "payment_received",
        tx_hash: txHash,
        amount_satoshis: amountSats.toString(),
        status,
      },
    });
  }

  /**
   * Send a payment link used notification.
   */
  async notifyPaymentLinkUsed(
    merchantId: string,
    linkSlug: string,
    amountSats: bigint
  ): Promise<void> {
    const amountBch = Number(amountSats) / 100_000_000;
    const formattedAmount = amountBch.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");

    await this.sendToMerchant(merchantId, {
      title: "Payment Link Used",
      body: `${formattedAmount} BCH received via payment link`,
      data: {
        type: "payment_link_used",
        slug: linkSlug,
        amount_satoshis: amountSats.toString(),
      },
    });
  }

  /**
   * Send a test push notification.
   */
  async sendTest(
    merchantId: string
  ): Promise<{ success: boolean; sent: number; error?: string }> {
    try {
      const result = await this.sendToMerchant(merchantId, {
        title: "BCH Pay Test",
        body: "Push notifications are working!",
        data: { type: "test" },
      });

      return {
        success: result.sent > 0,
        sent: result.sent,
      };
    } catch (err: any) {
      return {
        success: false,
        sent: 0,
        error: err.message,
      };
    }
  }
}

export const pushService = new PushNotificationService();
