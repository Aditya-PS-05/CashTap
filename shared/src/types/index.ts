// ============================================================================
// BCH-Specific Primitive Types
// ============================================================================

/** A Bitcoin Cash address in CashAddr format (e.g. "bitcoincash:qz...") */
export type BchAddress = string & { readonly __brand: "BchAddress" };

/** An amount in satoshis represented as a bigint */
export type Satoshis = bigint & { readonly __brand: "Satoshis" };

/** A BIP21 payment URI (e.g. "bitcoincash:qz...?amount=0.05&message=Coffee") */
export type PaymentURI = string & { readonly __brand: "PaymentURI" };

// ============================================================================
// Enums (matching Prisma schema)
// ============================================================================

export enum PaymentLinkType {
  SINGLE = "SINGLE",
  MULTI = "MULTI",
}

export enum PaymentLinkStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  EXPIRED = "EXPIRED",
}

export enum InvoiceStatus {
  DRAFT = "DRAFT",
  SENT = "SENT",
  VIEWED = "VIEWED",
  PAID = "PAID",
  OVERDUE = "OVERDUE",
}

export enum TransactionStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
}

export enum WebhookStatus {
  PENDING = "PENDING",
  DELIVERED = "DELIVERED",
  FAILED = "FAILED",
}

export enum Platform {
  IOS = "IOS",
  ANDROID = "ANDROID",
}

export enum TokenPurpose {
  LOYALTY = "LOYALTY",
  RECEIPT = "RECEIPT",
  REWARD = "REWARD",
}

export enum WebhookEventType {
  PAYMENT_RECEIVED = "payment.received",
  PAYMENT_CONFIRMED = "payment.confirmed",
  PAYMENT_EXPIRED = "payment.expired",
  INVOICE_PAID = "invoice.paid",
}

// ============================================================================
// Core Entity Types
// ============================================================================

export interface Merchant {
  id: string;
  bch_address: string;
  business_name: string;
  email: string | null;
  logo_url: string | null;
  api_key_hash: string | null;
  webhook_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentLink {
  id: string;
  merchant_id: string;
  amount_satoshis: string; // bigint serialized as string in JSON
  currency: string;
  memo: string | null;
  type: PaymentLinkType;
  status: PaymentLinkStatus;
  slug: string;
  expires_at: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  merchant_id: string;
  customer_email: string | null;
  items: InvoiceItem[];
  total_satoshis: string; // bigint serialized as string in JSON
  status: InvoiceStatus;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price_satoshis: string; // bigint serialized as string in JSON
}

export interface Transaction {
  id: string;
  tx_hash: string;
  payment_link_id: string | null;
  invoice_id: string | null;
  merchant_id: string;
  sender_address: string;
  recipient_address: string;
  amount_satoshis: string; // bigint serialized as string in JSON
  confirmations: number;
  status: TransactionStatus;
  block_height: number | null;
  token_category: string | null;
  created_at: string;
}

export interface Webhook {
  id: string;
  merchant_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: WebhookStatus;
  attempts: number;
  last_attempt_at: string | null;
}

export interface ApiKey {
  id: string;
  merchant_id: string;
  key_hash: string;
  label: string;
  permissions: string[];
  last_used_at: string | null;
  active: boolean;
  created_at: string;
}

export interface Device {
  id: string;
  merchant_id: string;
  device_token: string;
  platform: Platform;
  active: boolean;
  created_at: string;
}

export interface CashTokenConfig {
  id: string;
  merchant_id: string;
  token_category: string;
  token_name: string;
  token_symbol: string;
  token_decimals: number;
  purpose: TokenPurpose;
  active: boolean;
  created_at: string;
}

// ============================================================================
// Auth Types
// ============================================================================

export interface AuthChallenge {
  address: string;
  challenge: string;
  expires_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// ============================================================================
// API Request Types
// ============================================================================

// -- Auth --
export interface ChallengeRequest {
  address: string;
}

export interface VerifyRequest {
  address: string;
  signature: string;
  challenge: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

// -- Merchant --
export interface CreateMerchantRequest {
  bch_address: string;
  business_name: string;
  email?: string;
  logo_url?: string;
  webhook_url?: string;
}

export interface UpdateMerchantRequest {
  business_name?: string;
  email?: string | null;
  logo_url?: string | null;
  webhook_url?: string | null;
}

// -- Payment Links --
export interface CreatePaymentLinkRequest {
  amount_satoshis: string; // bigint as string
  currency?: string;
  memo?: string;
  type?: PaymentLinkType;
  expires_at?: string;
}

export interface UpdatePaymentLinkRequest {
  amount_satoshis?: string;
  currency?: string;
  memo?: string;
  type?: PaymentLinkType;
  status?: PaymentLinkStatus;
  expires_at?: string | null;
}

// -- Invoices --
export interface CreateInvoiceRequest {
  customer_email?: string;
  items: InvoiceItem[];
  due_date?: string;
}

export interface UpdateInvoiceRequest {
  customer_email?: string | null;
  items?: InvoiceItem[];
  due_date?: string | null;
}

// -- Transactions --
export interface TransactionFilters {
  status?: TransactionStatus;
  payment_link_id?: string;
  invoice_id?: string;
  from_date?: string;
  to_date?: string;
  min_amount?: string;
  max_amount?: string;
}

// -- Devices --
export interface RegisterDeviceRequest {
  device_token: string;
  platform: Platform;
}

// -- API Keys --
export interface CreateApiKeyRequest {
  label: string;
  permissions?: string[];
}

// -- CashToken Config --
export interface CreateCashTokenConfigRequest {
  token_category: string;
  token_name: string;
  token_symbol: string;
  token_decimals?: number;
  purpose: TokenPurpose;
}

// -- Webhooks --
export interface TestWebhookRequest {
  url: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationParams {
  page?: number;
  per_page?: number;
}

// -- Auth Responses --
export type ChallengeResponse = AuthChallenge;
export type VerifyResponse = AuthTokens;
export type RefreshResponse = AuthTokens;

// -- Merchant Responses --
export type MerchantResponse = Merchant;

// -- Payment Link Responses --
export type PaymentLinkResponse = PaymentLink;
export type PaymentLinkListResponse = PaginatedResponse<PaymentLink>;

/** Public-facing payment link data returned for /pay/:slug */
export interface PublicPaymentLinkResponse {
  slug: string;
  merchant_name: string;
  merchant_logo_url: string | null;
  amount_satoshis: string;
  currency: string;
  memo: string | null;
  status: PaymentLinkStatus;
  payment_uri: string;
  bch_address: string;
  expires_at: string | null;
}

// -- Invoice Responses --
export type InvoiceResponse = Invoice;
export type InvoiceListResponse = PaginatedResponse<Invoice>;

// -- Transaction Responses --
export type TransactionResponse = Transaction;
export type TransactionListResponse = PaginatedResponse<Transaction>;

export interface TransactionStats {
  total_revenue_satoshis: string;
  transaction_count: number;
  average_amount_satoshis: string;
  pending_count: number;
}

// -- API Key Responses --
export interface ApiKeyCreatedResponse {
  id: string;
  label: string;
  key: string; // plaintext key, only shown once at creation time
  permissions: string[];
  created_at: string;
}

export type ApiKeyResponse = Omit<ApiKey, "key_hash">;
export type ApiKeyListResponse = ApiKeyResponse[];

// -- Device Responses --
export type DeviceResponse = Device;

// -- CashToken Config Responses --
export type CashTokenConfigResponse = CashTokenConfig;
export type CashTokenConfigListResponse = CashTokenConfig[];

// -- Webhook Responses --
export type WebhookListResponse = PaginatedResponse<Webhook>;
export interface WebhookTestResponse {
  success: boolean;
  status_code: number | null;
  message: string;
}
