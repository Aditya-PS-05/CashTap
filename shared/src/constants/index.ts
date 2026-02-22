// ============================================================================
// Network Configuration
// ============================================================================

export type BchNetwork = "mainnet" | "chipnet";

/** Current active network — change to "mainnet" for production */
export const NETWORK: BchNetwork = "chipnet";

/** Whether the app is running against chipnet (testnet) */
export const IS_CHIPNET = NETWORK === "chipnet";

// ============================================================================
// BCH Constants
// ============================================================================

/** Number of decimal places for BCH amounts */
export const BCH_DECIMALS = 8;

/** Number of satoshis in 1 BCH */
export const SATOSHIS_PER_BCH = 100_000_000n;

/** Default number of confirmations to consider a transaction settled */
export const DEFAULT_CONFIRMATION_TARGET = 1;

/** Maximum amount of satoshis (21 million BCH supply cap) */
export const MAX_SUPPLY_SATOSHIS = 2_100_000_000_000_000n;

/** The minimum relay fee in satoshis per byte */
export const MIN_RELAY_FEE_PER_BYTE = 1;

/** CashAddr prefix for mainnet */
export const CASHADDR_PREFIX_MAINNET = "bitcoincash";

/** CashAddr prefix for chipnet/testnet */
export const CASHADDR_PREFIX_CHIPNET = "bchtest";

/** The active CashAddr prefix based on the current network */
export const CASHADDR_PREFIX = IS_CHIPNET
  ? CASHADDR_PREFIX_CHIPNET
  : CASHADDR_PREFIX_MAINNET;

// ============================================================================
// Payment Status Constants
// ============================================================================

export const PAYMENT_STATUS = {
  /** Payment is awaiting an incoming transaction */
  AWAITING: "awaiting",
  /** A transaction has been seen in the mempool (0-conf) */
  DETECTED: "detected",
  /** The transaction has been included in a block */
  CONFIRMED: "confirmed",
  /** The payment link or invoice has expired without payment */
  EXPIRED: "expired",
  /** The payment failed (e.g., double-spend detected) */
  FAILED: "failed",
} as const;

export type PaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

// ============================================================================
// 0-conf Configuration
// ============================================================================

/** Default threshold in satoshis below which 0-conf is accepted */
export const ZERO_CONF_THRESHOLD_SATOSHIS = 5_000_000n; // 0.05 BCH

/** Number of seconds to wait for a 0-conf before considering it timed out */
export const ZERO_CONF_TIMEOUT_SECONDS = 30;

// ============================================================================
// API Configuration
// ============================================================================

/** Base URL for the BCH Pay API in development */
export const API_BASE_URL_DEV = "http://localhost:3001";

/** Base URL for the BCH Pay API in production */
export const API_BASE_URL_PROD = "https://api.bchpay.app";

/** Current API base URL based on environment */
export const API_BASE_URL = IS_CHIPNET ? API_BASE_URL_DEV : API_BASE_URL_PROD;

/** API version prefix */
export const API_VERSION = "v1";

/** Full API path prefix */
export const API_PREFIX = `/api/${API_VERSION}`;

// ============================================================================
// Web URLs
// ============================================================================

/** Base URL for the web frontend in development */
export const WEB_BASE_URL_DEV = "http://localhost:3000";

/** Base URL for the web frontend in production */
export const WEB_BASE_URL_PROD = "https://bchpay.app";

/** Current web base URL based on environment */
export const WEB_BASE_URL = IS_CHIPNET ? WEB_BASE_URL_DEV : WEB_BASE_URL_PROD;

// ============================================================================
// Block Explorer URLs
// ============================================================================

/** Block explorer base URL for mainnet */
export const EXPLORER_URL_MAINNET = "https://blockchair.com/bitcoin-cash";

/** Block explorer base URL for chipnet */
export const EXPLORER_URL_CHIPNET = "https://chipnet.chaingraph.cash";

/** Current block explorer base URL */
export const EXPLORER_URL = IS_CHIPNET
  ? EXPLORER_URL_CHIPNET
  : EXPLORER_URL_MAINNET;

// ============================================================================
// Rate Limiting
// ============================================================================

/** Maximum API requests per minute for authenticated users */
export const RATE_LIMIT_AUTHENTICATED = 100;

/** Maximum API requests per minute for unauthenticated users */
export const RATE_LIMIT_UNAUTHENTICATED = 30;

/** Maximum auth-related requests per minute (login, challenge, etc.) */
export const RATE_LIMIT_AUTH = 10;

// ============================================================================
// Pagination Defaults
// ============================================================================

/** Default number of items per page */
export const DEFAULT_PAGE_SIZE = 20;

/** Maximum allowed items per page */
export const MAX_PAGE_SIZE = 100;

// ============================================================================
// Payment Link Defaults
// ============================================================================

/** Default slug length for generated payment link slugs */
export const PAYMENT_LINK_SLUG_LENGTH = 12;

/** Default payment link expiration durations in seconds */
export const EXPIRATION_DURATIONS = {
  NONE: null,
  ONE_HOUR: 60 * 60,
  TWENTY_FOUR_HOURS: 60 * 60 * 24,
  SEVEN_DAYS: 60 * 60 * 24 * 7,
  THIRTY_DAYS: 60 * 60 * 24 * 30,
} as const;

// ============================================================================
// Webhook Configuration
// ============================================================================

/** Maximum number of retry attempts for webhook delivery */
export const WEBHOOK_MAX_RETRIES = 3;

/** Base delay in milliseconds for exponential backoff between retries */
export const WEBHOOK_RETRY_BASE_DELAY_MS = 1000;

/** Webhook delivery timeout in milliseconds */
export const WEBHOOK_TIMEOUT_MS = 10_000;
