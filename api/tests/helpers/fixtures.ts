/**
 * Factory functions for test data matching Prisma models.
 */

export function merchantFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "cltest000000000000001",
    bch_address: "bchtest:qr95sy3j9xwd2ap32xkykttr4cvcu7as5yg42lrhk3",
    business_name: "Test Merchant",
    email: "test@example.com",
    logo_url: null,
    webhook_url: null,
    api_key_hash: null,
    created_at: new Date("2025-01-01"),
    updated_at: new Date("2025-01-01"),
    ...overrides,
  };
}

export function paymentLinkFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "cllink00000000000001",
    merchant_id: "cltest000000000000001",
    amount_satoshis: BigInt(50000),
    currency: "BCH",
    memo: "Test payment",
    type: "SINGLE",
    status: "ACTIVE",
    slug: "abc123xyz456",
    payment_address: "bchtest:qptest0000000000000000000000000000000000000",
    derivation_index: 0,
    expires_at: null,
    created_at: new Date("2025-01-01"),
    ...overrides,
  };
}

export function invoiceFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "clinv00000000000001",
    merchant_id: "cltest000000000000001",
    customer_email: "customer@example.com",
    items: [{ description: "Widget", quantity: 1, unit_price_satoshis: 50000 }],
    total_satoshis: BigInt(50000),
    status: "DRAFT",
    due_date: null,
    paid_at: null,
    created_at: new Date("2025-01-01"),
    ...overrides,
  };
}

export function transactionFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "cltx0000000000000001",
    tx_hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    payment_link_id: "cllink00000000000001",
    invoice_id: null,
    merchant_id: "cltest000000000000001",
    sender_address: "bchtest:qzsender00000000000000000000000000000000000",
    recipient_address: "bchtest:qptest0000000000000000000000000000000000000",
    amount_satoshis: BigInt(50000),
    confirmations: 1,
    status: "CONFIRMED",
    block_height: 100000,
    token_category: null,
    created_at: new Date("2025-01-01"),
    ...overrides,
  };
}

export function webhookFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "clwh0000000000000001",
    merchant_id: "cltest000000000000001",
    event_type: "payment.confirmed",
    payload: { test: true },
    status: "PENDING",
    attempts: 0,
    last_attempt_at: null,
    ...overrides,
  };
}

export function deviceFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "cldev0000000000000001",
    merchant_id: "cltest000000000000001",
    device_token: "fcm-token-test-12345",
    platform: "ANDROID" as const,
    active: true,
    created_at: new Date("2025-01-01"),
    ...overrides,
  };
}

export function contractInstanceFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "clcon0000000000000001",
    merchant_id: "cltest000000000000001",
    contract_type: "ESCROW",
    contract_address: "bchtest:pcontract00000000000000000000000000000000000",
    token_address: "bchtest:zcontract00000000000000000000000000000000000",
    constructor_args: {
      buyer_pkh: "0".repeat(40),
      seller_pkh: "1".repeat(40),
      arbiter_pkh: "2".repeat(40),
      timeout: 999999,
    },
    status: "ACTIVE",
    created_at: new Date("2025-01-01"),
    ...overrides,
  };
}

export function cashtokenConfigFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "clct0000000000000001",
    merchant_id: "cltest000000000000001",
    token_category: "a".repeat(64),
    token_name: "Test Loyalty Token",
    token_symbol: "TLT",
    token_decimals: 0,
    purpose: "LOYALTY",
    active: true,
    created_at: new Date("2025-01-01"),
    ...overrides,
  };
}

export function tokenIssuanceFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "clti0000000000000001",
    config_id: "clct0000000000000001",
    merchant_id: "cltest000000000000001",
    customer_address: "bchtest:qzcustomer000000000000000000000000000000000",
    amount: BigInt(50),
    tx_hash: "loyalty_test123",
    created_at: new Date("2025-01-01"),
    ...overrides,
  };
}

export function receiptNFTFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "clrn0000000000000001",
    config_id: "clct0000000000000001",
    merchant_id: "cltest000000000000001",
    customer_address: "bchtest:qzcustomer000000000000000000000000000000000",
    nft_category: "b".repeat(64),
    commitment: "0".repeat(40),
    tx_hash: "abc123",
    mint_tx_hash: "nft_test123",
    amount_satoshis: BigInt(50000),
    memo: "Test payment",
    created_at: new Date("2025-01-01"),
    merchant: {
      id: "cltest000000000000001",
      business_name: "Test Merchant",
      logo_url: null,
    },
    ...overrides,
  };
}
