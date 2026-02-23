# CashTap API Reference

Base URL: `https://your-api-domain.com/api/v1`

All endpoints are also available without the `/v1` prefix for backward compatibility.

---

## Table of Contents

- [Authentication](#authentication)
- [Merchants](#merchants)
- [Payment Links](#payment-links)
- [Transactions](#transactions)
- [Invoices](#invoices)
- [Checkout Sessions](#checkout-sessions)
- [Smart Contracts](#smart-contracts)
- [CashTokens](#cashtokens)
- [Devices (Push Notifications)](#devices)
- [Real-Time Events (SSE)](#real-time-events)
- [Price](#price)
- [Webhooks](#webhooks)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

---

## Authentication

CashTap uses wallet-based authentication. Merchants sign a challenge message with their BCH private key to prove ownership of their address.

### Two auth methods:

1. **JWT Bearer Token** — For web/mobile sessions
2. **API Key** — For server-to-server integration (`x-api-key` header)

---

### POST /auth/challenge

Generate a random challenge nonce for a BCH address.

**Request:**
```bash
curl -X POST https://api.cashtap.app/api/v1/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{"address": "bitcoincash:qz..."}'
```

**Response (200):**
```json
{
  "nonce": "a1b2c3d4e5f6...",
  "message": "Sign this message to authenticate with CashTap:\n\nNonce: a1b2c3...\nAddress: bitcoincash:qz...\nTimestamp: 2026-02-23T...",
  "expires_in": 300
}
```

---

### POST /auth/verify

Verify the signed challenge and receive JWT tokens.

**Request:**
```bash
curl -X POST https://api.cashtap.app/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "address": "bitcoincash:qz...",
    "signature": "signed-message-hex",
    "nonce": "a1b2c3d4e5f6..."
  }'
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "merchant": {
    "id": "clx...",
    "bch_address": "bitcoincash:qz...",
    "business_name": "Merchant abc123"
  }
}
```

---

### POST /auth/refresh

Refresh an expired access token.

**Request:**
```bash
curl -X POST https://api.cashtap.app/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "eyJhbGciOi..."}'
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

---

## Merchants

### POST /merchants

Register a new merchant.

**Request:**
```bash
curl -X POST https://api.cashtap.app/api/v1/merchants \
  -H "Content-Type: application/json" \
  -d '{
    "bch_address": "bitcoincash:qz...",
    "business_name": "Coffee Shop",
    "email": "merchant@example.com",
    "webhook_url": "https://example.com/webhooks/cashtap"
  }'
```

**Response (201):**
```json
{
  "merchant": {
    "id": "clx...",
    "bch_address": "bitcoincash:qz...",
    "business_name": "Coffee Shop",
    "email": "merchant@example.com",
    "logo_url": null,
    "webhook_url": "https://example.com/webhooks/cashtap",
    "created_at": "2026-02-23T..."
  },
  "api_key": "cashtap_a1b2c3d4..."
}
```

> **Note:** The `api_key` is only returned once at creation. Store it securely.

---

### GET /merchants/me

Get the authenticated merchant's profile.

**Headers:** `Authorization: Bearer <token>` or `x-api-key: <key>`

**Response (200):**
```json
{
  "merchant": {
    "id": "clx...",
    "bch_address": "bitcoincash:qz...",
    "business_name": "Coffee Shop",
    "email": "merchant@example.com",
    "logo_url": null,
    "webhook_url": "https://example.com/webhooks",
    "display_currency": "BCH",
    "created_at": "2026-02-23T...",
    "updated_at": "2026-02-23T...",
    "_count": {
      "payment_links": 5,
      "invoices": 12,
      "transactions": 47
    }
  }
}
```

---

### GET /merchants/:id

Public endpoint. Get a merchant's public profile.

**Response (200):**
```json
{
  "merchant": {
    "id": "clx...",
    "bch_address": "bitcoincash:qz...",
    "business_name": "Coffee Shop",
    "logo_url": null,
    "created_at": "2026-02-23T...",
    "_count": { "payment_links": 3 }
  }
}
```

---

### PUT /merchants/me

Update the authenticated merchant's profile.

**Request:**
```bash
curl -X PUT https://api.cashtap.app/api/v1/merchants/me \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "business_name": "Updated Coffee Shop",
    "email": "new@example.com",
    "display_currency": "USD"
  }'
```

**Fields:** `business_name`, `email`, `logo_url`, `webhook_url`, `display_currency` (BCH|USD)

---

## Payment Links

### POST /payment-links

Create a new payment link.

**Auth required:** JWT or API key

**Request:**
```bash
curl -X POST https://api.cashtap.app/api/v1/payment-links \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount_satoshis": 500000,
    "currency": "BCH",
    "memo": "Coffee order #42",
    "type": "SINGLE",
    "expires_at": "2026-02-24T00:00:00Z"
  }'
```

**Parameters:**

| Field | Type | Required | Description |
|---|---|---|---|
| `amount_satoshis` | integer | Yes | Amount in satoshis (1 BCH = 100,000,000 sats) |
| `currency` | string | No | Default: "BCH" |
| `memo` | string | No | Payment description (max 500 chars) |
| `type` | string | No | `SINGLE`, `MULTI`, or `RECURRING` (default: SINGLE) |
| `recurring_interval` | string | No | Required for RECURRING: `daily`, `weekly`, `monthly`, `yearly` |
| `expires_at` | ISO datetime | No | Expiration time |

**Response (201):**
```json
{
  "payment_link": {
    "id": "clx...",
    "merchant_id": "clx...",
    "amount_satoshis": "500000",
    "currency": "BCH",
    "memo": "Coffee order #42",
    "type": "SINGLE",
    "slug": "a1b2c3d4e5f6",
    "payment_address": "bitcoincash:qz...",
    "status": "ACTIVE",
    "created_at": "2026-02-23T..."
  },
  "pay_url": "https://cashtap.app/pay/a1b2c3d4e5f6"
}
```

---

### GET /payment-links/:slug

Public endpoint. Get payment link by slug (for payment pages).

**Response (200):**
```json
{
  "payment_link": {
    "id": "clx...",
    "amount_satoshis": "500000",
    "currency": "BCH",
    "memo": "Coffee order #42",
    "type": "SINGLE",
    "slug": "a1b2c3d4e5f6",
    "payment_address": "bitcoincash:qz...",
    "status": "ACTIVE",
    "merchant": {
      "id": "clx...",
      "business_name": "Coffee Shop",
      "bch_address": "bitcoincash:qz...",
      "logo_url": null
    }
  }
}
```

---

### GET /payment-links

List the merchant's payment links (paginated).

**Query parameters:** `page` (default 1), `limit` (default 20, max 100), `status` (ACTIVE|INACTIVE|EXPIRED), `type` (SINGLE|MULTI|RECURRING)

**Response (200):**
```json
{
  "payment_links": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "total_pages": 1
  }
}
```

---

### GET /payment-links/:id/stats

Get collection stats for a payment link.

**Response (200):**
```json
{
  "stats": {
    "payment_link_id": "clx...",
    "type": "MULTI",
    "total_collected_satoshis": "5000000",
    "total_collected_bch": "0.05000000",
    "total_collected_usd": "15.00",
    "payment_count": 10,
    "recurring_count": 0,
    "last_paid_at": "2026-02-23T..."
  },
  "transactions": [...]
}
```

---

### PUT /payment-links/:id

Update a payment link. **Auth required.**

**Fields:** `amount_satoshis`, `currency`, `memo`, `type`, `recurring_interval`, `status`, `expires_at`

---

### DELETE /payment-links/:id

Deactivate (soft-delete) a payment link. **Auth required.**

---

## Transactions

### GET /transactions

List transactions (paginated, filterable).

**Auth required:** JWT or API key

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `page` | int | Page number (default: 1) |
| `limit` | int | Items per page (default: 20, max: 100) |
| `status` | string | Filter: PENDING, CONFIRMED, FAILED |
| `payment_link_id` | string | Filter by payment link |
| `invoice_id` | string | Filter by invoice |
| `from` | ISO datetime | Start date |
| `to` | ISO datetime | End date |

**Response (200):**
```json
{
  "transactions": [
    {
      "id": "clx...",
      "tx_hash": "abc123...",
      "amount_satoshis": "500000",
      "sender_address": "bitcoincash:qp...",
      "recipient_address": "bitcoincash:qz...",
      "status": "CONFIRMED",
      "confirmations": 3,
      "usd_rate_at_time": 300.50,
      "created_at": "2026-02-23T...",
      "payment_link": { "id": "...", "slug": "...", "memo": "..." },
      "invoice": null
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 47, "total_pages": 3 }
}
```

---

### GET /transactions/:id

Get full transaction details.

---

### GET /transactions/stats

Summary statistics.

**Response (200):**
```json
{
  "stats": {
    "confirmed": { "count": 42, "total_satoshis": "25000000" },
    "pending": { "count": 2, "total_satoshis": "1000000" },
    "failed_count": 1
  },
  "recent_transactions": [...]
}
```

---

### GET /transactions/analytics

Revenue analytics with daily breakdown, top payment links, payment method distribution, and customer insights.

**Query parameters:** `range` (7d|30d|90d), `from`, `to`

**Response (200):**
```json
{
  "daily": [
    { "date": "2026-02-23", "total_satoshis": "5000000", "tx_count": 12, "total_usd": 15.00 }
  ],
  "summary": {
    "total_revenue_satoshis": "25000000",
    "total_revenue_usd": 75.00,
    "total_transactions": 42,
    "avg_payment_satoshis": "595238",
    "avg_payment_usd": 1.79
  },
  "top_payment_links": [...],
  "payment_methods": { "payment_link": 30, "invoice": 8, "direct": 4 },
  "customers": { "unique_count": 25, "repeat_count": 8 }
}
```

---

## Invoices

### POST /invoices

Create a new invoice. **Auth required.**

**Request:**
```bash
curl -X POST https://api.cashtap.app/api/v1/invoices \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "customer@example.com",
    "items": [
      { "description": "Espresso", "quantity": 2, "unit_price_satoshis": 150000 },
      { "description": "Croissant", "quantity": 1, "unit_price_satoshis": 200000 }
    ],
    "total_satoshis": 500000,
    "due_date": "2026-03-01T00:00:00Z"
  }'
```

**Response (201):**
```json
{
  "invoice": {
    "id": "clx...",
    "merchant_id": "clx...",
    "customer_email": "customer@example.com",
    "items": [...],
    "total_satoshis": "500000",
    "status": "DRAFT",
    "due_date": "2026-03-01T00:00:00Z",
    "created_at": "2026-02-23T..."
  }
}
```

---

### GET /invoices/:id

Public endpoint. Get invoice details (auto-marks SENT invoices as VIEWED).

---

### GET /invoices

List merchant's invoices. **Auth required.**

**Query parameters:** `page`, `limit`, `status` (DRAFT|SENT|VIEWED|PAID|OVERDUE)

---

### PUT /invoices/:id

Update an invoice (DRAFT or SENT status only). **Auth required.**

---

### POST /invoices/:id/send

Mark invoice as SENT. **Auth required.**

---

### POST /invoices/:id/remind

Send payment reminder (triggers webhook + push notification). **Auth required.**

---

## Checkout Sessions

Stripe-like hosted checkout flow.

### POST /checkout/sessions

Create a checkout session. **Auth required (JWT or API key).**

**Request:**
```bash
curl -X POST https://api.cashtap.app/api/v1/checkout/sessions \
  -H "x-api-key: cashtap_a1b2c3..." \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500,
    "currency": "USD",
    "memo": "Order #1234",
    "success_url": "https://mysite.com/success",
    "cancel_url": "https://mysite.com/cancel"
  }'
```

**Parameters:**

| Field | Type | Required | Description |
|---|---|---|---|
| `amount` | number | Yes | Amount in cents USD |
| `currency` | string | No | Default: "USD" |
| `memo` | string | No | Payment description |
| `success_url` | URL | Yes | Redirect after successful payment |
| `cancel_url` | URL | Yes | Redirect if customer cancels |

**Response (201):**
```json
{
  "session_id": "clx...",
  "checkout_url": "https://cashtap.app/checkout/clx...",
  "payment_link": {
    "id": "clx...",
    "slug": "a1b2c3d4e5f6",
    "amount_satoshis": "166667",
    "payment_address": "bitcoincash:qz..."
  },
  "expires_at": "2026-02-23T01:00:00Z"
}
```

Redirect the customer to `checkout_url`. They'll be redirected to `success_url` after payment.

---

### GET /checkout/:sessionId

Get checkout session status (public).

---

### POST /checkout/:sessionId/cancel

Cancel an open checkout session.

---

## Smart Contracts

### GET /contracts

List contract instances. **Auth required.**

**Query parameters:** `page`, `limit`, `type` (ESCROW|SPLIT_PAYMENT|SAVINGS_VAULT), `status`

---

### GET /contracts/types

List available contract types with their ABIs.

---

### POST /contracts/escrow

Create an escrow contract.

**Request:**
```bash
curl -X POST https://api.cashtap.app/api/v1/contracts/escrow \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "buyer_pkh": "a1b2c3...40hex",
    "seller_pkh": "d4e5f6...40hex",
    "arbiter_pkh": "g7h8i9...40hex",
    "timeout": 850000
  }'
```

**Parameters:** All `_pkh` fields are 40-character hex strings (20-byte public key hashes). `timeout` is a block height or Unix timestamp.

**Response (201):**
```json
{
  "contract": {
    "id": "clx...",
    "type": "ESCROW",
    "address": "bitcoincash:pz...",
    "token_address": "bitcoincash:rz...",
    "constructor_args": { "buyer_pkh": "...", "seller_pkh": "...", "arbiter_pkh": "...", "timeout": 850000 },
    "status": "ACTIVE",
    "created_at": "2026-02-23T..."
  }
}
```

---

### POST /contracts/split-payment

Create a 2-recipient split payment contract.

**Request:**
```json
{
  "recipient1_pkh": "a1b2c3...40hex",
  "recipient2_pkh": "d4e5f6...40hex",
  "split1_percent": 70,
  "split2_percent": 30
}
```

> Percentages must add up to 100.

---

### POST /contracts/split-payment-multi

Create a multi-recipient split payment (2-10 recipients).

**Request:**
```json
{
  "recipients": [
    { "pkh": "a1b2c3...40hex", "percent": 50, "label": "Owner" },
    { "pkh": "d4e5f6...40hex", "percent": 30, "label": "Partner" },
    { "pkh": "g7h8i9...40hex", "percent": 20, "label": "Staff" }
  ]
}
```

---

### POST /contracts/split-payment/preview

Preview split distribution before creating.

**Request:**
```json
{
  "recipients": [
    { "percent": 70, "label": "Owner" },
    { "percent": 30, "label": "Staff" }
  ],
  "total_satoshis": 1000000
}
```

**Response (200):**
```json
{
  "total_satoshis": 1000000,
  "estimated_fee": 400,
  "distributable_satoshis": 999600,
  "usd_rate": 300.50,
  "shares": [
    { "percent": 70, "satoshis": 699720, "bch": "0.00699720", "usd": "2.10" },
    { "percent": 30, "satoshis": 299880, "bch": "0.00299880", "usd": "0.90" }
  ]
}
```

---

### POST /contracts/savings-vault

Create a time-locked savings vault.

**Request:**
```json
{
  "owner_pkh": "a1b2c3...40hex",
  "locktime": 1740000000
}
```

---

### Contract Actions

| Endpoint | Method | Description |
|---|---|---|
| `/contracts/:id/status` | PATCH | Update contract status (enforced transitions) |
| `/contracts/:id/release` | POST | Release escrow funds to seller |
| `/contracts/:id/refund` | POST | Refund escrow to buyer |
| `/contracts/:id/resolve` | POST | Resolve disputed escrow |

**Status transitions:**
- ACTIVE -> FUNDED, COMPLETED, EXPIRED
- FUNDED -> RELEASED, REFUNDED, DISPUTED, COMPLETED, EXPIRED
- DISPUTED -> RELEASED, REFUNDED, COMPLETED

---

## CashTokens

### POST /cashtokens/loyalty/create

Create a merchant loyalty token (fungible CashToken). **Auth required.**

**Request:**
```json
{
  "name": "CoffeeShop Rewards",
  "symbol": "COFFEE",
  "decimals": 0
}
```

**Response (201):**
```json
{
  "loyalty_token": {
    "token_category": "abc123...",
    "tx_hash": "def456...",
    "name": "CoffeeShop Rewards",
    "symbol": "COFFEE",
    "decimals": 0
  }
}
```

---

### POST /cashtokens/loyalty/issue

Issue loyalty tokens to a customer.

**Request:**
```json
{
  "customer_address": "bitcoincash:qz...",
  "amount_sats": 500000
}
```

---

### POST /cashtokens/loyalty/redeem

Redeem loyalty tokens from a customer.

**Request:**
```json
{
  "customer_address": "bitcoincash:qz...",
  "amount": 100,
  "description": "Discount redemption"
}
```

---

### GET /cashtokens/loyalty/stats

Get loyalty token and receipt NFT statistics. **Auth required.**

---

### POST /cashtokens/receipts/enable

Enable receipt NFT minting. **Auth required.**

---

### POST /cashtokens/receipts/mint

Mint a receipt NFT.

**Request:**
```json
{
  "customer_address": "bitcoincash:qz...",
  "tx_hash": "abc123...",
  "amount_sats": 500000,
  "memo": "Purchase at Coffee Shop"
}
```

**Response (201):**
```json
{
  "receipt": {
    "id": "clx...",
    "nft_category": "abc123...",
    "commitment": "hex-encoded-data",
    "tx_hash": "def456..."
  }
}
```

---

### GET /cashtokens/receipts/:id

Public endpoint. Get receipt NFT details.

---

### GET /cashtokens/analytics

Full CashToken analytics: stats, recent issuances, recent receipts, top holders, redemption rate.

---

### GET /cashtokens/bcmr/:category

Public endpoint. Serve BCMR metadata JSON for a token category.

---

## Devices

Push notification device management.

### POST /devices

Register a device for push notifications. **Auth required.**

**Request:**
```json
{
  "device_token": "firebase-device-token",
  "platform": "ANDROID"
}
```

---

### GET /devices

List registered devices. **Auth required.**

---

### DELETE /devices/:id

Deactivate a device. **Auth required.**

---

### POST /devices/test

Send a test push notification. **Auth required.**

---

## Real-Time Events

### GET /events?token=\<jwt\>

Server-Sent Events (SSE) stream for real-time updates.

**Connection:**
```javascript
const es = new EventSource('/api/v1/events?token=' + accessToken);

es.addEventListener('connected', (e) => {
  console.log('Connected:', JSON.parse(e.data));
});

es.addEventListener('payment.received', (e) => {
  const payment = JSON.parse(e.data);
  console.log('Payment received:', payment);
});

es.addEventListener('heartbeat', (e) => {
  // 30-second keepalive
});
```

**Event types:**
- `connected` — Initial connection confirmation
- `payment.received` — New payment detected (0-conf)
- `payment.confirmed` — Payment confirmed (1+ blocks)
- `invoice.paid` — Invoice marked as paid
- `contract.released` — Escrow funds released
- `heartbeat` — 30-second keepalive

---

## Price

### GET /price

Get current BCH/USD price. No auth required.

---

## Webhooks

CashTap delivers webhooks to your configured `webhook_url` for payment events.

### Webhook Format

```json
{
  "event": "payment.received",
  "data": {
    "tx_hash": "abc123...",
    "amount_satoshis": "500000",
    "sender_address": "bitcoincash:qp...",
    "payment_link_id": "clx...",
    "confirmations": 0
  },
  "timestamp": "2026-02-23T12:00:00Z"
}
```

### Webhook Events

| Event | Description |
|---|---|
| `payment.received` | Payment detected (0-conf) |
| `payment.confirmed` | Payment confirmed (1+ confirmations) |
| `payment.expired` | Payment link expired without payment |
| `invoice.paid` | Invoice fully paid |
| `invoice.reminder` | Payment reminder sent |
| `contract.released` | Escrow funds released |
| `contract.refunded` | Escrow refunded |
| `contract.resolved` | Dispute resolved |

### Signature Verification

Each webhook includes an `x-webhook-signature` header with an HMAC-SHA256 signature:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

### Retry Policy

Failed webhook deliveries are retried up to 3 times with exponential backoff (1min, 5min, 15min).

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### HTTP Status Codes

| Code | Description |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / validation error |
| 401 | Unauthorized (missing or invalid auth) |
| 404 | Resource not found |
| 409 | Conflict (duplicate resource) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 503 | Service unavailable (e.g., price feed down) |

### Validation Errors

```json
{
  "error": "Validation failed",
  "details": {
    "fieldErrors": {
      "amount_satoshis": ["Amount must be a positive integer (satoshis)"]
    },
    "formErrors": []
  }
}
```

---

## Rate Limiting

| Scope | Limit |
|---|---|
| General API | 100 requests/minute per API key |
| Auth endpoints | 10 requests/minute per IP |

Rate limit headers:
- `X-RateLimit-Limit`: Max requests in window
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Window reset time (Unix timestamp)

When rate limited, you receive a `429` response:
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMITED"
}
```
