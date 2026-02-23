import type { PaymentResult } from "./types.js";

let currentOverlay: HTMLDivElement | null = null;

export function openModal(
  checkoutUrl: string,
  callbacks: {
    onSuccess?: (data: PaymentResult) => void;
    onError?: (error: Error) => void;
    onCancel?: () => void;
  }
): void {
  // Close any existing modal
  closeModal();

  // Create overlay
  const overlay = document.createElement("div");
  overlay.id = "bchpay-overlay";
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.6); z-index: 999999;
    display: flex; align-items: center; justify-content: center;
    animation: bchpay-fade-in 0.2s ease;
  `;

  // Create container
  const container = document.createElement("div");
  container.style.cssText = `
    background: white; border-radius: 16px; overflow: hidden;
    width: 420px; max-width: 95vw; height: 680px; max-height: 90vh;
    box-shadow: 0 25px 50px rgba(0,0,0,0.25);
    position: relative;
  `;

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "&times;";
  closeBtn.style.cssText = `
    position: absolute; top: 8px; right: 12px; z-index: 10;
    background: none; border: none; font-size: 24px;
    cursor: pointer; color: #666; line-height: 1;
    width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
    border-radius: 50%; transition: background 0.15s;
  `;
  closeBtn.onmouseenter = () => (closeBtn.style.background = "#f0f0f0");
  closeBtn.onmouseleave = () => (closeBtn.style.background = "none");
  closeBtn.onclick = () => {
    closeModal();
    callbacks.onCancel?.();
  };

  // Iframe
  const iframe = document.createElement("iframe");
  // Add query param to signal we're in an iframe
  const url = new URL(checkoutUrl);
  url.searchParams.set("embed", "true");
  iframe.src = url.toString();
  iframe.style.cssText = `
    width: 100%; height: 100%; border: none;
  `;

  container.appendChild(closeBtn);
  container.appendChild(iframe);
  overlay.appendChild(container);

  // Click outside to close
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeModal();
      callbacks.onCancel?.();
    }
  });

  // Listen for postMessage events from the checkout page
  const messageHandler = (event: MessageEvent) => {
    if (!event.data || typeof event.data !== "object") return;

    if (event.data.type === "bchpay:success") {
      closeModal();
      callbacks.onSuccess?.(event.data.payload);
    } else if (event.data.type === "bchpay:cancel") {
      closeModal();
      callbacks.onCancel?.();
    } else if (event.data.type === "bchpay:error") {
      closeModal();
      callbacks.onError?.(new Error(event.data.message || "Payment failed"));
    }
  };

  window.addEventListener("message", messageHandler);

  // Store reference for cleanup
  overlay.dataset.messageHandler = "true";
  (overlay as any)._messageHandler = messageHandler;

  // Add animation styles
  if (!document.getElementById("bchpay-styles")) {
    const style = document.createElement("style");
    style.id = "bchpay-styles";
    style.textContent = `
      @keyframes bchpay-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(overlay);
  currentOverlay = overlay;
}

export function closeModal(): void {
  if (currentOverlay) {
    const handler = (currentOverlay as any)._messageHandler;
    if (handler) {
      window.removeEventListener("message", handler);
    }
    currentOverlay.remove();
    currentOverlay = null;
  }
}
