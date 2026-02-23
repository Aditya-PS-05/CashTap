import type { CheckoutSession } from "./types.js";

const DEFAULT_API_URL = "https://bchpay.app/api/v1";

export async function createCheckoutSession(
  apiKey: string,
  amount: number,
  options: {
    memo?: string;
    successUrl: string;
    cancelUrl: string;
    apiUrl?: string;
  }
): Promise<CheckoutSession> {
  const apiUrl = options.apiUrl || DEFAULT_API_URL;

  const res = await fetch(`${apiUrl}/checkout/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      amount,
      currency: "USD",
      memo: options.memo,
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}
