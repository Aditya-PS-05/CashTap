export interface ButtonOptions {
  merchant: string;
  amount: number;
  memo?: string;
  containerId: string;
  apiKey?: string;
  apiUrl?: string;
  buttonText?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  buttonSize?: "small" | "medium" | "large";
  onSuccess?: (data: PaymentResult) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}

export interface CheckoutOptions {
  amount: number;
  memo?: string;
  apiKey: string;
  apiUrl?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface PaymentResult {
  session_id: string;
  status: "COMPLETE";
  tx_hash?: string;
}

export interface CheckoutSession {
  session_id: string;
  checkout_url: string;
  expires_at: string;
}
