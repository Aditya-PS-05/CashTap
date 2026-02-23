import { Resend } from "resend";

/**
 * Email service using Resend for transactional emails.
 *
 * Requires RESEND_API_KEY environment variable.
 * Sending domain must be verified in Resend dashboard.
 */

const FROM_ADDRESS = process.env.EMAIL_FROM || "BCH Pay <noreply@bchpay.app>";
const APP_URL = process.env.APP_URL || "https://bchpay.app";

class EmailService {
  private resend: Resend | null = null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resend = new Resend(apiKey);
      console.log("[Email] Resend configured");
    } else {
      console.log("[Email] RESEND_API_KEY not set — emails will be logged only");
    }
  }

  get isConfigured(): boolean {
    return this.resend !== null;
  }

  /**
   * Send an invoice email to a customer.
   */
  async sendInvoice(params: {
    to: string;
    invoiceId: string;
    merchantName: string;
    totalBch: string;
    totalUsd: string;
    dueDate: string | null;
    items: { description: string; quantity: number; unit_price_satoshis: number }[];
  }): Promise<{ sent: boolean; id?: string }> {
    const invoiceUrl = `${APP_URL}/invoice/${params.invoiceId}`;
    const subject = `Invoice from ${params.merchantName}`;

    const itemsHtml = params.items
      .map(
        (item) =>
          `<tr>
            <td style="padding:8px;border-bottom:1px solid #eee">${item.description}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${(item.unit_price_satoshis / 1e8).toFixed(8)} BCH</td>
          </tr>`
      )
      .join("");

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="text-align:center;margin-bottom:24px">
          <h2 style="color:#0AC18E;margin:0">BCH Pay</h2>
        </div>
        <p>You have a new invoice from <strong>${params.merchantName}</strong>.</p>
        <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin:16px 0">
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <thead>
              <tr style="border-bottom:2px solid #ddd">
                <th style="padding:8px;text-align:left">Item</th>
                <th style="padding:8px;text-align:center">Qty</th>
                <th style="padding:8px;text-align:right">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div style="margin-top:12px;text-align:right;font-size:16px">
            <strong>Total: ${params.totalBch} BCH (~$${params.totalUsd} USD)</strong>
          </div>
          ${params.dueDate ? `<p style="text-align:right;font-size:12px;color:#666">Due: ${params.dueDate}</p>` : ""}
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="${invoiceUrl}" style="display:inline-block;background:#0AC18E;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold">
            View & Pay Invoice
          </a>
        </div>
        <p style="font-size:12px;color:#999;text-align:center">
          Powered by <a href="${APP_URL}" style="color:#0AC18E">BCH Pay</a>
        </p>
      </div>
    `;

    return this.send({ to: params.to, subject, html });
  }

  /**
   * Send an invoice reminder email.
   */
  async sendInvoiceReminder(params: {
    to: string;
    invoiceId: string;
    merchantName: string;
    totalBch: string;
    dueDate: string | null;
  }): Promise<{ sent: boolean; id?: string }> {
    const invoiceUrl = `${APP_URL}/invoice/${params.invoiceId}`;
    const subject = `Payment reminder from ${params.merchantName}`;

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="text-align:center;margin-bottom:24px">
          <h2 style="color:#0AC18E">BCH Pay</h2>
        </div>
        <p>This is a friendly reminder that you have an outstanding invoice from <strong>${params.merchantName}</strong>.</p>
        <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin:16px 0;text-align:center">
          <p style="font-size:20px;font-weight:bold;margin:0">${params.totalBch} BCH</p>
          ${params.dueDate ? `<p style="font-size:12px;color:#e53e3e;margin:4px 0 0">Due: ${params.dueDate}</p>` : ""}
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="${invoiceUrl}" style="display:inline-block;background:#0AC18E;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold">
            Pay Now
          </a>
        </div>
        <p style="font-size:12px;color:#999;text-align:center">
          Powered by <a href="${APP_URL}" style="color:#0AC18E">BCH Pay</a>
        </p>
      </div>
    `;

    return this.send({ to: params.to, subject, html });
  }

  /**
   * Low-level send method — uses Resend if configured, else logs.
   */
  private async send(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<{ sent: boolean; id?: string }> {
    if (!this.resend) {
      console.log(`[Email] (dev) Would send to ${params.to}: ${params.subject}`);
      return { sent: false };
    }

    try {
      const result = await this.resend.emails.send({
        from: FROM_ADDRESS,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });

      if (result.error) {
        console.error(`[Email] Failed to send to ${params.to}:`, result.error);
        return { sent: false };
      }

      console.log(`[Email] Sent to ${params.to}: ${params.subject}`);
      return { sent: true, id: result.data?.id };
    } catch (err) {
      console.error(`[Email] Error sending to ${params.to}:`, err);
      return { sent: false };
    }
  }
}

export const emailService = new EmailService();
