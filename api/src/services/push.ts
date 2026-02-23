import { prisma } from "../lib/prisma.js";

/**
 * Push notification service using Firebase Cloud Messaging (FCM).
 *
 * Supports two modes:
 * 1. FCM HTTP v1 API with service account JSON (production)
 *    - Set FCM_PROJECT_ID and FCM_SERVICE_ACCOUNT_JSON
 * 2. FCM legacy API with server key (simpler setup)
 *    - Set FCM_SERVER_KEY
 *
 * Device tokens are registered via the /api/devices endpoint.
 */

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

class PushNotificationService {
  private projectId: string;
  private serverKey: string | null;
  private serviceAccount: any | null = null;
  private cachedAccessToken: { token: string; expiresAt: number } | null = null;

  constructor() {
    this.projectId = process.env.FCM_PROJECT_ID || "";
    this.serverKey = process.env.FCM_SERVER_KEY || null;

    // Parse service account JSON if provided
    const saJson = process.env.FCM_SERVICE_ACCOUNT_JSON;
    if (saJson) {
      try {
        this.serviceAccount = JSON.parse(saJson);
        this.projectId = this.projectId || this.serviceAccount.project_id;
        console.log("[Push] FCM configured with service account");
      } catch {
        console.error("[Push] Failed to parse FCM_SERVICE_ACCOUNT_JSON");
      }
    } else if (this.serverKey) {
      console.log("[Push] FCM configured with legacy server key");
    } else {
      console.log("[Push] FCM not configured — notifications will be logged only");
    }
  }

  get isConfigured(): boolean {
    return !!(this.serverKey || this.serviceAccount);
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
          err.message?.includes("INVALID_ARGUMENT") ||
          err.message?.includes("NotRegistered")
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
    if (!this.isConfigured) {
      console.log(
        `[Push] (dev) Would send to ${deviceToken.slice(0, 20)}...: ${payload.title} — ${payload.body}`
      );
      return;
    }

    // Use FCM HTTP v1 API if service account is available
    if (this.serviceAccount && this.projectId) {
      await this.sendViaV1Api(deviceToken, payload);
      return;
    }

    // Fall back to legacy FCM API
    if (this.serverKey) {
      await this.sendViaLegacyApi(deviceToken, payload);
      return;
    }
  }

  /**
   * Send via FCM HTTP v1 API (requires service account).
   */
  private async sendViaV1Api(
    deviceToken: string,
    payload: PushPayload
  ): Promise<void> {
    const accessToken = await this.getAccessToken();
    const url = `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`;

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
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`FCM v1 error ${response.status}: ${errorBody}`);
    }
  }

  /**
   * Send via legacy FCM HTTP API (simpler, uses server key).
   */
  private async sendViaLegacyApi(
    deviceToken: string,
    payload: PushPayload
  ): Promise<void> {
    const response = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${this.serverKey}`,
      },
      body: JSON.stringify({
        to: deviceToken,
        notification: {
          title: payload.title,
          body: payload.body,
          sound: "payment_received",
        },
        data: payload.data || {},
        priority: "high",
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`FCM legacy error ${response.status}: ${errorBody}`);
    }

    const result = (await response.json()) as { failure?: number; results?: { error?: string }[] };
    if (result.failure && result.failure > 0) {
      const error = result.results?.[0]?.error || "Unknown FCM error";
      throw new Error(error);
    }
  }

  /**
   * Get OAuth2 access token from service account (cached with TTL).
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5-minute buffer)
    if (this.cachedAccessToken && Date.now() < this.cachedAccessToken.expiresAt - 300_000) {
      return this.cachedAccessToken.token;
    }

    const sa = this.serviceAccount;
    if (!sa?.client_email || !sa?.private_key) {
      throw new Error("Invalid service account — missing client_email or private_key");
    }

    // Build JWT for Google OAuth2
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const claims = {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    };

    const { default: jwt } = await import("jsonwebtoken");
    const token = jwt.sign(claims, sa.private_key, {
      algorithm: "RS256",
      header,
    });

    // Exchange JWT for access token
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: token,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get FCM access token: ${response.status}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.cachedAccessToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return data.access_token;
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
