// Types — re-export everything
export type {
  // BCH primitive types
  BchAddress,
  Satoshis,
  PaymentURI,

  // Core entity types
  Merchant,
  PaymentLink,
  Invoice,
  InvoiceItem,
  Transaction,
  Webhook,
  ApiKey,
  Device,
  CashTokenConfig,

  // Auth types
  AuthChallenge,
  AuthTokens,

  // API request types
  ChallengeRequest,
  VerifyRequest,
  RefreshRequest,
  CreateMerchantRequest,
  UpdateMerchantRequest,
  CreatePaymentLinkRequest,
  UpdatePaymentLinkRequest,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  TransactionFilters,
  RegisterDeviceRequest,
  CreateApiKeyRequest,
  CreateCashTokenConfigRequest,
  TestWebhookRequest,

  // API response types
  ApiError,
  PaginationMeta,
  PaginatedResponse,
  PaginationParams,
  ChallengeResponse,
  VerifyResponse,
  RefreshResponse,
  MerchantResponse,
  PaymentLinkResponse,
  PaymentLinkListResponse,
  PublicPaymentLinkResponse,
  InvoiceResponse,
  InvoiceListResponse,
  TransactionResponse,
  TransactionListResponse,
  TransactionStats,
  ApiKeyCreatedResponse,
  ApiKeyResponse,
  ApiKeyListResponse,
  DeviceResponse,
  CashTokenConfigResponse,
  CashTokenConfigListResponse,
  WebhookListResponse,
  WebhookTestResponse,
} from "./types/index.js";

// Enums — re-export as values (not just types)
export {
  PaymentLinkType,
  PaymentLinkStatus,
  InvoiceStatus,
  TransactionStatus,
  WebhookStatus,
  Platform,
  TokenPurpose,
  WebhookEventType,
} from "./types/index.js";

// Constants — re-export everything
export {
  NETWORK,
  IS_CHIPNET,
  BCH_DECIMALS,
  SATOSHIS_PER_BCH,
  DEFAULT_CONFIRMATION_TARGET,
  MAX_SUPPLY_SATOSHIS,
  MIN_RELAY_FEE_PER_BYTE,
  CASHADDR_PREFIX_MAINNET,
  CASHADDR_PREFIX_CHIPNET,
  CASHADDR_PREFIX,
  PAYMENT_STATUS,
  ZERO_CONF_THRESHOLD_SATOSHIS,
  ZERO_CONF_TIMEOUT_SECONDS,
  API_BASE_URL_DEV,
  API_BASE_URL_PROD,
  API_BASE_URL,
  API_VERSION,
  API_PREFIX,
  WEB_BASE_URL_DEV,
  WEB_BASE_URL_PROD,
  WEB_BASE_URL,
  EXPLORER_URL_MAINNET,
  EXPLORER_URL_CHIPNET,
  EXPLORER_URL,
  RATE_LIMIT_AUTHENTICATED,
  RATE_LIMIT_UNAUTHENTICATED,
  RATE_LIMIT_AUTH,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PAYMENT_LINK_SLUG_LENGTH,
  EXPIRATION_DURATIONS,
  WEBHOOK_MAX_RETRIES,
  WEBHOOK_RETRY_BASE_DELAY_MS,
  WEBHOOK_TIMEOUT_MS,
} from "./constants/index.js";

export type { BchNetwork, PaymentStatus } from "./constants/index.js";

// BCH utilities
export {
  satoshisToBch,
  bchToSatoshis,
  formatBchAmount,
  formatUsd,
  shortenAddress,
  isValidBchAddress,
  generatePaymentURI,
} from "./utils/bch.js";

// API client
export { ApiClient, ApiClientError } from "./utils/api-client.js";
export type { ApiClientOptions } from "./utils/api-client.js";
