import type { ButtonOptions, CheckoutOptions } from "./types.js";
import { renderButton } from "./button.js";
import { createCheckoutSession } from "./api.js";
import { openModal, closeModal } from "./modal.js";

export { renderButton as button } from "./button.js";
export { createCheckoutSession as createCheckout } from "./api.js";
export { openModal, closeModal } from "./modal.js";
export type { ButtonOptions, CheckoutOptions, PaymentResult, CheckoutSession } from "./types.js";

// Default export for IIFE global
export default {
  button: renderButton,
  createCheckout: createCheckoutSession,
  openModal,
  closeModal,
};
