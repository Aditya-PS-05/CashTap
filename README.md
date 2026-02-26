<div align="center">
  <img src="web/public/images/bch_coin.png" alt="CashTap Logo" width="120" />
  <h1>CashTap</h1>
  <p><strong>Bitcoin Cash Payment Rails for the Real World</strong></p>
  <p>Mobile POS, Payment Links, Invoices, CashToken Loyalty & Receipt NFTs — all in one platform.</p>
</div>

---

## Overview

CashTap is a full-stack payment platform for Bitcoin Cash. It enables any merchant with a phone to accept BCH payments with instant 0-confirmation settlement, on-chain loyalty tokens, and NFT receipts — all built natively on Bitcoin Cash with no sidechains, bridges, or wrapped tokens.

Users sign up with email and password. A non-custodial BIP39 wallet is auto-created on-device during onboarding — no seed phrases or crypto knowledge needed to get started. Everyone begins as a buyer (scan QR, send BCH), and can upgrade to a merchant from settings.

### How It Works

```
1. Merchant opens CashTap → taps POS tab
2. Types "$5.00" on the numpad → taps "Charge"
3. QR code appears (BIP21 URI — works with ANY BCH wallet)
4. Customer scans with Paytaca / Electron Cash / Bitcoin.com wallet
5. ~1 second later (0-conf!): payment confirmed
6. Done. Bitcoin Cash commerce in under 10 seconds.
```

---

## Features

- **Email/Password Auth** — Simple signup, auto wallet creation, encrypted backup for cross-device recovery
- **Mobile POS** — Numpad-style point-of-sale with QR code generation and real-time payment detection
- **Payment Links** — Single-use, multi-use, or recurring payment links with unique slugs
- **Invoices** — Create, send, and track invoices with line items and due dates
- **Web Dashboard** — Analytics, transaction history, charts, and export (CSV/JSON)
- **Send BCH** — Scan QR or enter address to send BCH from web or mobile
- **CashToken Loyalty Tokens** — Issue branded fungible loyalty tokens to customers on every purchase
- **Receipt NFTs** — Mint non-fungible CashToken receipts as on-chain proof of purchase
- **Smart Contracts** — Escrow, split payments (up to 10 recipients), and time-locked savings vaults via CashScript
- **Developer SDK** — Embeddable `<script>` tag and React component for third-party integration
- **Checkout Sessions** — Stripe-like hosted checkout redirect flow
- **Real-Time Updates** — Server-Sent Events (SSE) for live transaction feeds
- **Push Notifications** — Firebase Cloud Messaging for instant payment alerts
- **Webhook Delivery** — HMAC-SHA256 signed webhooks with retry logic
- **0-Conf Instant Payments** — Accept payments before block confirmation
- **Buyer + Merchant Roles** — Start as a buyer, upgrade to merchant when ready

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | CashScript (BCH native contracts) |
| Tokens | CashTokens (fungible FTs + NFTs, native BCH protocol) |
| BCH Libraries | mainnet-js, libauth, cashscript |
| Web Frontend | Next.js, TypeScript, Tailwind CSS, shadcn/ui |
| Mobile App | Flutter, Dart, go_router, Material 3 |
| Backend | Node.js, Hono, Prisma ORM |
| Database | PostgreSQL (Neon) |
| Token Metadata | BCMR (Bitcoin Cash Metadata Registries) |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| Hosting | Vercel (web), Railway (API), Neon (DB) |

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and **pnpm**
- **Flutter SDK** 3.x (for mobile app)
- **PostgreSQL** (or use Neon for hosted)

### Clone & Install

```bash
git clone <your-repo-url>
cd cashtap
pnpm install
```

### Configure Environment

```bash
cp api/.env.example api/.env
# Edit api/.env:
#   DATABASE_URL=postgresql://...
#   JWT_SECRET=your-secret-here
#   BCH_NETWORK=chipnet
```

### Run Database Migrations

```bash
cd api && npx prisma db push
```

### Start Development Servers

```bash
# API (port 3456)
cd api && pnpm dev

# Web dashboard (port 3000)
cd web && pnpm dev

# Mobile app
cd mobile && flutter run
```

### Chipnet (Testnet)

CashTap uses **chipnet** (BCH testnet) for development. Get test BCH from the [Chipnet Faucet](https://tbch.googol.cash/).

---

## Smart Contracts

Contracts are deployed dynamically per merchant via the API:

| Contract | Description |
|---|---|
| Payment Gateway | Accepts BCH, forwards to merchant address with memo support |
| Escrow | Locks BCH between buyer/seller, with arbiter resolution and timeout |
| Split Payment | Atomic split of funds between 2–10 recipients by percentage |
| Savings Vault | Time-locked BCH using OP_CHECKLOCKTIMEVERIFY |

---

## CashToken Integration

CashTap uses Bitcoin Cash's native CashToken protocol:

**Fungible Loyalty Tokens** — Merchants create branded loyalty tokens. Customers earn tokens on every purchase and redeem them for discounts, all verified on-chain with BCMR metadata.

**Non-Fungible Receipt NFTs** — Each purchase mints an NFT receipt with merchant identifier, amount, timestamp, and memo. Immutable proof of purchase viewable in any CashToken-aware wallet.

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/register` | POST | Register with email + password |
| `/api/auth/login` | POST | Login, get JWT |
| `/api/wallet/register` | POST | Register wallet address |
| `/api/merchants/setup` | POST | Upgrade to merchant |
| `/api/merchants/me` | GET | Get profile |
| `/api/payment-links` | POST | Create payment link |
| `/api/payment-links/:slug` | GET | Get payment link (public) |
| `/api/transactions` | GET | List transactions |
| `/api/transactions` | POST | Record a transaction |
| `/api/transactions/analytics` | GET | Revenue analytics |
| `/api/invoices` | POST | Create invoice |
| `/api/contracts/escrow` | POST | Create escrow contract |
| `/api/contracts/split-payment` | POST | Create split payment |
| `/api/wallet/broadcast` | POST | Broadcast raw transaction |
| `/api/wallet/utxos` | GET | Get UTXOs for address |
| `/api/wallet/balance` | GET | Get address balance |

---

## SDK Integration

Add BCH payments to any website:

```html
<script src="https://cashtap.app/sdk.js"></script>
<script>
  CashTap.button({
    merchant: "bitcoincash:qz...",
    amount: 500,
    memo: "Coffee",
    containerId: "pay-button",
    onSuccess: (tx) => console.log("Paid!", tx.hash),
  });
</script>
```

---

## License

MIT

---

Built for the **BCH-1 Hackcelerator 2026** — Track: Applications.
