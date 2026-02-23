import type { ButtonOptions } from "./types.js";
import { createCheckoutSession } from "./api.js";
import { openModal } from "./modal.js";

const BCH_LOGO_SVG = `<svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="16" fill="#0AC18E"/>
  <path d="M21.2 13.6c.4-2.6-1.6-4-4.3-4.9l.9-3.5-2.1-.5-.8 3.4c-.6-.1-1.1-.3-1.7-.4l.9-3.4-2.1-.5-.9 3.5c-.5-.1-.9-.2-1.4-.3l-2.9-.7-.6 2.2s1.6.4 1.5.4c.9.2 1 .8 1 1.2l-1 4.1c.1 0 .1 0 .2.1h-.2l-1.4 5.8c-.1.3-.4.7-.9.6 0 0-1.5-.4-1.5-.4l-1 2.4 2.7.7c.5.1 1 .3 1.5.4l-.9 3.5 2.1.5.9-3.5c.6.2 1.1.3 1.7.4l-.9 3.5 2.1.5.9-3.5c3.7.7 6.5.4 7.7-2.9.9-2.7 0-4.2-2-5.2 1.4-.3 2.5-1.3 2.8-3.2zm-5 7c-.7 2.7-5.2 1.2-6.6.9l1.2-4.7c1.5.4 6.1 1.1 5.4 3.8zm.7-7c-.6 2.4-4.4 1.2-5.6.9l1.1-4.3c1.2.3 5.2.9 4.5 3.4z" fill="white"/>
</svg>`;

export function renderButton(options: ButtonOptions): void {
  const container = document.getElementById(options.containerId);
  if (!container) {
    console.error(`[BCHPay] Container #${options.containerId} not found`);
    return;
  }

  const size = options.buttonSize || "medium";
  const sizes = {
    small: { padding: "8px 16px", fontSize: "13px", gap: "6px" },
    medium: { padding: "12px 24px", fontSize: "15px", gap: "8px" },
    large: { padding: "16px 32px", fontSize: "17px", gap: "10px" },
  };
  const s = sizes[size];

  const btn = document.createElement("button");
  btn.innerHTML = `${BCH_LOGO_SVG}<span>${options.buttonText || "Pay with BCH"}</span>`;
  btn.style.cssText = `
    display: inline-flex; align-items: center; gap: ${s.gap};
    padding: ${s.padding}; font-size: ${s.fontSize};
    background: ${options.buttonColor || "#0AC18E"};
    color: ${options.buttonTextColor || "#fff"};
    border: none; border-radius: 10px; cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-weight: 600; transition: opacity 0.15s, transform 0.1s;
    line-height: 1;
  `;
  btn.onmouseenter = () => (btn.style.opacity = "0.9");
  btn.onmouseleave = () => (btn.style.opacity = "1");
  btn.onmousedown = () => (btn.style.transform = "scale(0.97)");
  btn.onmouseup = () => (btn.style.transform = "scale(1)");

  btn.onclick = async () => {
    btn.disabled = true;
    btn.style.opacity = "0.7";

    try {
      const apiKey = options.apiKey || "";
      const apiUrl = options.apiUrl;

      if (!apiKey) {
        // Direct payment link flow (no checkout session)
        const payUrl = `${apiUrl || ""}/pay/${options.merchant}?amount=${options.amount}`;
        openModal(payUrl, {
          onSuccess: options.onSuccess,
          onError: options.onError,
          onCancel: options.onCancel,
        });
      } else {
        // Checkout session flow
        const session = await createCheckoutSession(apiKey, options.amount, {
          memo: options.memo,
          successUrl: window.location.href,
          cancelUrl: window.location.href,
          apiUrl,
        });

        openModal(session.checkout_url, {
          onSuccess: options.onSuccess,
          onError: options.onError,
          onCancel: options.onCancel,
        });
      }
    } catch (err) {
      options.onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      btn.disabled = false;
      btn.style.opacity = "1";
    }
  };

  container.appendChild(btn);
}
