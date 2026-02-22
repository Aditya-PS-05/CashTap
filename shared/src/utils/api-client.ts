import { API_PREFIX, DEFAULT_PAGE_SIZE } from "../constants/index.js";
import type {
  // Auth
  ChallengeRequest,
  ChallengeResponse,
  VerifyRequest,
  VerifyResponse,
  RefreshRequest,
  RefreshResponse,
  // Merchant
  CreateMerchantRequest,
  UpdateMerchantRequest,
  MerchantResponse,
  // Payment Links
  CreatePaymentLinkRequest,
  UpdatePaymentLinkRequest,
  PaymentLinkResponse,
  PaymentLinkListResponse,
  PublicPaymentLinkResponse,
  // Invoices
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  InvoiceResponse,
  InvoiceListResponse,
  // Transactions
  TransactionFilters,
  TransactionResponse,
  TransactionListResponse,
  TransactionStats,
  // API Keys
  CreateApiKeyRequest,
  ApiKeyCreatedResponse,
  ApiKeyListResponse,
  // Devices
  RegisterDeviceRequest,
  DeviceResponse,
  // CashToken Config
  CreateCashTokenConfigRequest,
  CashTokenConfigResponse,
  CashTokenConfigListResponse,
  // Webhooks
  TestWebhookRequest,
  WebhookTestResponse,
  WebhookListResponse,
  // Shared
  ApiError,
  PaginationParams,
} from "../types/index.js";

// ============================================================================
// Error
// ============================================================================

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: Record<string, unknown> | undefined;

  constructor(status: number, body: ApiError) {
    super(body.error.message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = body.error.code;
    this.details = body.error.details;
  }
}

// ============================================================================
// Client
// ============================================================================

export interface ApiClientOptions {
  /** Base URL of the BCH Pay API (e.g. "http://localhost:3001") */
  baseUrl: string;
  /** JWT access token for authenticated requests */
  accessToken?: string;
  /** API key for developer API access (sent as x-api-key header) */
  apiKey?: string;
  /** Custom fetch implementation (useful for testing or SSR) */
  fetch?: typeof globalThis.fetch;
}

export class ApiClient {
  private readonly baseUrl: string;
  private accessToken: string | undefined;
  private apiKey: string | undefined;
  private readonly _fetch: typeof globalThis.fetch;

  constructor(options: ApiClientOptions) {
    // Strip trailing slash
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.accessToken = options.accessToken;
    this.apiKey = options.apiKey;
    this._fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  // ---------- Token management ----------

  /** Update the JWT access token (e.g. after refresh) */
  setAccessToken(token: string | undefined): void {
    this.accessToken = token;
  }

  /** Update the API key */
  setApiKey(key: string | undefined): void {
    this.apiKey = key;
  }

  // ---------- Internal helpers ----------

  private buildUrl(path: string, query?: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}${API_PREFIX}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, value);
        }
      }
    }
    return url.toString();
  }

  private buildHeaders(hasBody: boolean): Record<string, string> {
    const headers: Record<string, string> = {};

    if (hasBody) {
      headers["Content-Type"] = "application/json";
    }

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }

    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      query?: Record<string, string>;
    }
  ): Promise<T> {
    const url = this.buildUrl(path, options?.query);
    const hasBody = options?.body !== undefined;

    const response = await this._fetch(url, {
      method,
      headers: this.buildHeaders(hasBody),
      body: hasBody ? JSON.stringify(options!.body) : undefined,
    });

    // 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");

    if (!response.ok) {
      if (isJson) {
        const errorBody = (await response.json()) as ApiError;
        throw new ApiClientError(response.status, errorBody);
      }
      throw new ApiClientError(response.status, {
        error: {
          code: "UNKNOWN_ERROR",
          message: `HTTP ${response.status}: ${response.statusText}`,
        },
      });
    }

    if (isJson) {
      return (await response.json()) as T;
    }

    return undefined as T;
  }

  private get<T>(path: string, query?: Record<string, string>): Promise<T> {
    return this.request<T>("GET", path, { query });
  }

  private post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, { body });
  }

  private put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, { body });
  }

  private delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  // ---------- Pagination helper ----------

  private paginationQuery(
    params?: PaginationParams
  ): Record<string, string> {
    const page = params?.page ?? 1;
    const per_page = params?.per_page ?? DEFAULT_PAGE_SIZE;
    return {
      page: page.toString(),
      per_page: per_page.toString(),
    };
  }

  // ========================================================================
  // Auth
  // ========================================================================

  /** Request a challenge nonce for wallet-based authentication */
  async authChallenge(data: ChallengeRequest): Promise<ChallengeResponse> {
    return this.post<ChallengeResponse>("/auth/challenge", data);
  }

  /** Verify a signed challenge to obtain JWT tokens */
  async authVerify(data: VerifyRequest): Promise<VerifyResponse> {
    const result = await this.post<VerifyResponse>("/auth/verify", data);
    // Automatically store the access token for subsequent requests
    this.accessToken = result.access_token;
    return result;
  }

  /** Refresh an expired access token */
  async authRefresh(data: RefreshRequest): Promise<RefreshResponse> {
    const result = await this.post<RefreshResponse>("/auth/refresh", data);
    this.accessToken = result.access_token;
    return result;
  }

  // ========================================================================
  // Merchants
  // ========================================================================

  /** Register a new merchant */
  async createMerchant(
    data: CreateMerchantRequest
  ): Promise<MerchantResponse> {
    return this.post<MerchantResponse>("/merchants", data);
  }

  /** Get the currently authenticated merchant's profile */
  async getMe(): Promise<MerchantResponse> {
    return this.get<MerchantResponse>("/merchants/me");
  }

  /** Get a merchant by ID */
  async getMerchant(id: string): Promise<MerchantResponse> {
    return this.get<MerchantResponse>(`/merchants/${id}`);
  }

  /** Update a merchant's profile */
  async updateMerchant(
    id: string,
    data: UpdateMerchantRequest
  ): Promise<MerchantResponse> {
    return this.put<MerchantResponse>(`/merchants/${id}`, data);
  }

  // ========================================================================
  // Payment Links
  // ========================================================================

  /** Create a new payment link */
  async createPaymentLink(
    data: CreatePaymentLinkRequest
  ): Promise<PaymentLinkResponse> {
    return this.post<PaymentLinkResponse>("/payment-links", data);
  }

  /** List the authenticated merchant's payment links */
  async listPaymentLinks(
    pagination?: PaginationParams
  ): Promise<PaymentLinkListResponse> {
    return this.get<PaymentLinkListResponse>(
      "/payment-links",
      this.paginationQuery(pagination)
    );
  }

  /** Get a payment link by slug (public, no auth required) */
  async getPaymentLinkBySlug(
    slug: string
  ): Promise<PublicPaymentLinkResponse> {
    return this.get<PublicPaymentLinkResponse>(`/payment-links/${slug}`);
  }

  /** Update a payment link */
  async updatePaymentLink(
    id: string,
    data: UpdatePaymentLinkRequest
  ): Promise<PaymentLinkResponse> {
    return this.put<PaymentLinkResponse>(`/payment-links/${id}`, data);
  }

  /** Deactivate (soft-delete) a payment link */
  async deletePaymentLink(id: string): Promise<void> {
    return this.delete(`/payment-links/${id}`);
  }

  // ========================================================================
  // Invoices
  // ========================================================================

  /** Create a new invoice */
  async createInvoice(
    data: CreateInvoiceRequest
  ): Promise<InvoiceResponse> {
    return this.post<InvoiceResponse>("/invoices", data);
  }

  /** List the authenticated merchant's invoices */
  async listInvoices(
    pagination?: PaginationParams
  ): Promise<InvoiceListResponse> {
    return this.get<InvoiceListResponse>(
      "/invoices",
      this.paginationQuery(pagination)
    );
  }

  /** Get an invoice by ID (public for payment page) */
  async getInvoice(id: string): Promise<InvoiceResponse> {
    return this.get<InvoiceResponse>(`/invoices/${id}`);
  }

  /** Update a draft invoice */
  async updateInvoice(
    id: string,
    data: UpdateInvoiceRequest
  ): Promise<InvoiceResponse> {
    return this.put<InvoiceResponse>(`/invoices/${id}`, data);
  }

  /** Send an invoice email to the customer */
  async sendInvoice(id: string): Promise<void> {
    return this.post(`/invoices/${id}/send`);
  }

  /** Send a payment reminder for an invoice */
  async remindInvoice(id: string): Promise<void> {
    return this.post(`/invoices/${id}/remind`);
  }

  // ========================================================================
  // Transactions
  // ========================================================================

  /** List the authenticated merchant's transactions */
  async listTransactions(
    filters?: TransactionFilters,
    pagination?: PaginationParams
  ): Promise<TransactionListResponse> {
    const query: Record<string, string> = {
      ...this.paginationQuery(pagination),
    };

    if (filters) {
      if (filters.status) query.status = filters.status;
      if (filters.payment_link_id)
        query.payment_link_id = filters.payment_link_id;
      if (filters.invoice_id) query.invoice_id = filters.invoice_id;
      if (filters.from_date) query.from_date = filters.from_date;
      if (filters.to_date) query.to_date = filters.to_date;
      if (filters.min_amount) query.min_amount = filters.min_amount;
      if (filters.max_amount) query.max_amount = filters.max_amount;
    }

    return this.get<TransactionListResponse>("/transactions", query);
  }

  /** Get a single transaction by ID */
  async getTransaction(id: string): Promise<TransactionResponse> {
    return this.get<TransactionResponse>(`/transactions/${id}`);
  }

  /** Get aggregated transaction statistics */
  async getTransactionStats(): Promise<TransactionStats> {
    return this.get<TransactionStats>("/transactions/stats");
  }

  // ========================================================================
  // API Keys
  // ========================================================================

  /** Create a new API key for the authenticated merchant */
  async createApiKey(
    data: CreateApiKeyRequest
  ): Promise<ApiKeyCreatedResponse> {
    return this.post<ApiKeyCreatedResponse>("/api-keys", data);
  }

  /** List all API keys for the authenticated merchant */
  async listApiKeys(): Promise<ApiKeyListResponse> {
    return this.get<ApiKeyListResponse>("/api-keys");
  }

  /** Revoke (deactivate) an API key */
  async revokeApiKey(id: string): Promise<void> {
    return this.delete(`/api-keys/${id}`);
  }

  // ========================================================================
  // Devices (Push Notifications)
  // ========================================================================

  /** Register a device for push notifications */
  async registerDevice(
    data: RegisterDeviceRequest
  ): Promise<DeviceResponse> {
    return this.post<DeviceResponse>("/devices/register", data);
  }

  /** Unregister a device */
  async unregisterDevice(id: string): Promise<void> {
    return this.delete(`/devices/${id}`);
  }

  // ========================================================================
  // CashToken Configuration
  // ========================================================================

  /** Create a new CashToken configuration (loyalty, receipt, reward) */
  async createCashTokenConfig(
    data: CreateCashTokenConfigRequest
  ): Promise<CashTokenConfigResponse> {
    return this.post<CashTokenConfigResponse>("/cashtoken-configs", data);
  }

  /** List all CashToken configurations for the authenticated merchant */
  async listCashTokenConfigs(): Promise<CashTokenConfigListResponse> {
    return this.get<CashTokenConfigListResponse>("/cashtoken-configs");
  }

  /** Get a CashToken configuration by ID */
  async getCashTokenConfig(id: string): Promise<CashTokenConfigResponse> {
    return this.get<CashTokenConfigResponse>(`/cashtoken-configs/${id}`);
  }

  // ========================================================================
  // Webhooks
  // ========================================================================

  /** List webhook delivery attempts for the authenticated merchant */
  async listWebhooks(
    pagination?: PaginationParams
  ): Promise<WebhookListResponse> {
    return this.get<WebhookListResponse>(
      "/webhooks",
      this.paginationQuery(pagination)
    );
  }

  /** Send a test webhook to the specified URL */
  async testWebhook(
    data: TestWebhookRequest
  ): Promise<WebhookTestResponse> {
    return this.post<WebhookTestResponse>("/webhooks/test", data);
  }
}
