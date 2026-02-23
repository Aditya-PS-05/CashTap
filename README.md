<div align="center">
  <img src="web/public/images/bch_coin.png" alt="CashTap Logo" width="120" />
  <h1>CashTap</h1>
  <p><strong>Bitcoin Cash Payment Rails for the Real World</strong></p>
  <p>Mobile POS, Payment Links, Invoices, CashToken Loyalty & Receipt NFTs — all in one platform.</p>

  <p>
    <img alt="License" src="https://img.shields.io/badge/license-MIT-green.svg" />
    <img alt="Built with" src="https://img.shields.io/badge/built%20with-Bitcoin%20Cash-0AC18E.svg" />
    <img alt="CashTokens" src="https://img.shields.io/badge/CashTokens-enabled-0AC18E.svg" />
    <img alt="Track" src="https://img.shields.io/badge/BCH--1%20Hackcelerator-Applications-blue.svg" />
  </p>
</div>

---

## Overview

CashTap is a full-stack payment platform for Bitcoin Cash. It enables any merchant with a phone to accept BCH payments with instant 0-confirmation settlement, on-chain loyalty tokens, and NFT receipts — all built natively on Bitcoin Cash with no sidechains, bridges, or wrapped tokens.

### The "Wow" Moment

```
1. Merchant opens CashTap mobile app → taps POS tab
2. Types "$5.00" on the numpad → taps "Charge"
3. QR code appears (BIP21 URI — works with ANY BCH wallet)
4. Customer scans with Paytaca / Electron Cash / Bitcoin.com wallet
5. ~1 second later (0-conf!): merchant's phone vibrates
   → Green checkmark + confetti animation
   → Customer receives loyalty tokens + receipt NFT
6. Done. Bitcoin Cash commerce in under 10 seconds.
```

---

## Features

- **Mobile POS** — Numpad-style point-of-sale with QR code generation, haptic feedback, and real-time payment detection
- **Payment Links** — Single-use, multi-use, or recurring payment links with unique slugs
- **Invoices** — Create, send, and track invoices with line items and due dates
- **Web Dashboard** — Analytics, transaction history, charts, and export (CSV/JSON)
- **CashToken Loyalty Tokens** — Issue branded fungible loyalty tokens to customers on every purchase
- **Receipt NFTs** — Mint non-fungible CashToken receipts as on-chain proof of purchase
- **Smart Contracts** — Escrow, split payments (up to 10 recipients), and time-locked savings vaults via CashScript
- **Developer SDK** — Embeddable `<script>` tag and React component for third-party integration
- **Checkout Sessions** — Stripe-like hosted checkout redirect flow
- **Real-Time Updates** — Server-Sent Events (SSE) for live transaction feeds
- **Push Notifications** — Firebase Cloud Messaging for instant payment alerts
- **Webhook Delivery** — HMAC-SHA256 signed webhooks with retry logic
- **0-Conf Instant Payments** — BCH's killer feature: accept payments before block confirmation
- **BCMR Metadata** — Token metadata registered via Bitcoin Cash Metadata Registries standard

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                   │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐    │
│  │   WEB (Next.js)   │  │  MOBILE (Flutter)  │  │  PAYMENT PAGES     │    │
│  │                    │  │                    │  │  (Responsive Web)  │    │
│  │  • Merchant        │  │  • POS Numpad      │  │                    │    │
│  │    Dashboard       │  │  • QR Scanner      │  │  • /pay/:slug      │    │
│  │  • Analytics       │  │  • QR Generator    │  │  • /invoice/:id    │    │
│  │  • Invoice Mgmt    │  │  • Transaction     │  │  • Wallet Connect  │    │
│  │  • Payment Links   │  │    Feed            │  │  • Pay & Receipt   │    │
│  │  • CashToken Mgmt  │  │  • Push Notifs     │  │                    │    │
│  │  • Settings        │  │  • Share Sheet     │  │                    │    │
│  └────────┬───────────┘  └────────┬───────────┘  └────────┬───────────┘    │
└───────────┼──────────────────────┼──────────────────────┼──────────────┘
            │                      │                      │
            ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     SHARED LAYER (TypeScript)                            │
│            Types, API client, constants, BCH utilities                   │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKEND API (Node.js + Hono)                          │
│                                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │   Auth    │ │ Payments │ │ Invoices │ │ Webhooks │ │    Push       │ │
│  │(Signature │ │   CRUD   │ │   CRUD   │ │ Delivery │ │   Notifs     │ │
│  │ + JWT)    │ │          │ │          │ │          │ │   (FCM)      │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │           BCH Transaction Monitor (Fulcrum/Chaingraph)              │ │
│  │   Watches addresses for incoming payments → updates DB → hooks      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────┐                                                  │
│  │ PostgreSQL (Neon)   │                                                  │
│  │ via Prisma ORM      │                                                  │
│  └────────────────────┘                                                  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      BITCOIN CASH (L1)                                   │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │
│  │ payment-          │  │ escrow            │  │ split-payment    │      │
│  │ gateway.cash      │  │ .cash             │  │ .cash            │      │
│  │ (CashScript)      │  │ (CashScript)      │  │ (CashScript)     │      │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘      │
│  ┌──────────────────┐  ┌──────────────────┐                             │
│  │ CashTokens (FT)   │  │ CashTokens (NFT) │                             │
│  │ • Loyalty tokens   │  │ • Payment receipts│                             │
│  │ • Reward points    │  │ • Merchant badges │                             │
│  └──────────────────┘  └──────────────────┘                             │
│                                                                         │
│  Indexing: Fulcrum (Electrum) • Chaingraph (GraphQL)                    │
│  Wallets: Paytaca • Electron Cash • Cashonize                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | CashScript (BCH native contracts) |
| Tokens | CashTokens (fungible FTs + NFTs, native BCH protocol) |
| BCH Libraries | mainnet-js, @mainnet-cash/contract, libauth, cashscript |
| Web Frontend | Next.js 16, TypeScript, Tailwind CSS, shadcn/ui |
| Mobile App | Flutter, Dart, go_router, Material 3 |
| Backend | Node.js, Hono, Prisma ORM |
| Database | PostgreSQL (Neon) |
| BCH Indexer | Fulcrum (Electrum server), Chaingraph (GraphQL) |
| Token Metadata | BCMR (Bitcoin Cash Metadata Registries) |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| Hosting | Vercel (web), Railway/Fly.io (API), Neon (DB) |

---

## Project Structure

```
cashtap/
├── api/                # Backend API (Node.js + Hono)
│   ├── src/
│   │   ├── routes/     # auth, merchants, payment-links, transactions,
│   │   │               # invoices, contracts, cashtokens, checkout, events
│   │   ├── services/   # wallet, monitor, cashtoken, webhook, push, price
│   │   ├── middleware/  # auth (JWT + API key), rate limiting
│   │   └── lib/        # prisma client
│   └── prisma/         # Database schema & migrations
├── contracts/          # CashScript smart contracts
│   └── contracts/
│       ├── payment-gateway.cash
│       ├── escrow.cash
│       ├── split-payment.cash
│       └── savings-vault.cash
├── web/                # Next.js (merchant dashboard + payment pages)
│   └── app/
│       ├── page.tsx              # Landing page
│       ├── dashboard/            # Analytics, transactions, invoices, etc.
│       ├── pay/[slug]/           # Public payment page
│       ├── invoice/[id]/         # Public invoice page
│       ├── checkout/[sessionId]/ # Hosted checkout
│       ├── docs/                 # API & SDK documentation
│       └── auth/                 # Wallet authentication
├── mobile/             # Flutter app (merchant POS + customer payments)
│   └── lib/
│       ├── screens/    # home, POS, scanner, activity, settings, auth
│       ├── providers/  # state management
│       └── services/   # API client, wallet, notifications
├── sdk/                # Embeddable JS SDK for third-party sites
├── shared/             # Shared types, utils, constants, API client
├── assets/             # 3D assets (.blend files + rendered PNGs)
└── docs/               # Documentation
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and **pnpm** 8+
- **Flutter SDK** 3.x (for mobile app)
- **PostgreSQL** (or use Neon for hosted)
- **Git**

### Clone & Install

```bash
git clone https://github.com/anthropics/cashtap.git
cd cashtap
pnpm install
```

### Configure Environment

```bash
# API
cp api/.env.example api/.env
# Edit api/.env with your database URL and configuration:
#   DATABASE_URL=postgresql://...
#   JWT_SECRET=your-secret-here
#   BCH_NETWORK=chipnet
#   BCH_SEED_PHRASE=your-test-wallet-seed-phrase
```

### Run Database Migrations

```bash
cd api && npx prisma migrate dev
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

### Connect to Chipnet

CashTap uses **chipnet** (BCH testnet) for development. Get test BCH from:
- [Chipnet Faucet](https://tbch.googol.cash/)
- [Chipnet Explorer](https://chipnet.chaingraph.cash/)

---

## CashScript Smart Contracts

Contracts are deployed dynamically per merchant via the API. Available contract types:

| Contract | File | Description |
|---|---|---|
| Payment Gateway | `payment-gateway.cash` | Accepts BCH, forwards to merchant address with memo support |
| Escrow | `escrow.cash` | Locks BCH between buyer/seller, with arbiter resolution and timeout |
| Split Payment | `split-payment.cash` | Atomic split of funds between 2 recipients by percentage |
| Savings Vault | `savings-vault.cash` | Time-locked BCH using OP_CHECKLOCKTIMEVERIFY |

---

## CashToken Integration

CashTap uses Bitcoin Cash's native CashToken protocol (May 2023 upgrade):

### Fungible Loyalty Tokens
- Merchants create branded loyalty tokens (e.g., "CoffeeShop Rewards")
- Customers earn tokens automatically on every purchase
- Redeem tokens for discounts — all verified on-chain
- BCMR metadata registration for wallet display

### Non-Fungible Receipt NFTs
- Each purchase mints an NFT receipt with commitment data:
  - Merchant identifier, amount, timestamp, memo
- Immutable proof of purchase on the blockchain
- Viewable in any CashToken-aware wallet (Paytaca, Cashonize)

---

## API Documentation

Full API reference available at [`/docs/api`](docs/API.md) in the web app.

**Quick reference:**

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/auth/challenge` | POST | - | Get auth challenge nonce |
| `/api/auth/verify` | POST | - | Verify signature, get JWT |
| `/api/merchants` | POST | - | Register merchant |
| `/api/merchants/me` | GET | JWT | Get current merchant profile |
| `/api/payment-links` | POST | JWT/Key | Create payment link |
| `/api/payment-links/:slug` | GET | - | Get payment link (public) |
| `/api/transactions` | GET | JWT/Key | List transactions |
| `/api/transactions/analytics` | GET | JWT/Key | Revenue analytics |
| `/api/invoices` | POST | JWT/Key | Create invoice |
| `/api/checkout/sessions` | POST | JWT/Key | Create checkout session |
| `/api/cashtokens/loyalty/create` | POST | JWT | Create loyalty token |
| `/api/cashtokens/receipts/mint` | POST | JWT | Mint receipt NFT |
| `/api/contracts/escrow` | POST | JWT | Create escrow contract |
| `/api/contracts/split-payment` | POST | JWT | Create split payment |
| `/api/events` | GET | Token | SSE real-time event stream |

See [docs/API.md](docs/API.md) for complete request/response examples.

---

## SDK Integration

Add BCH payments to any website:

```html
<script src="https://cashtap.app/sdk.js"></script>
<script>
  CashTap.button({
    merchant: "bitcoincash:qz...",
    amount: 500,  // cents USD
    memo: "Coffee",
    containerId: "pay-button",
    onSuccess: (tx) => console.log("Paid!", tx.hash),
  });
</script>
```

React component:

```jsx
import { CashTapButton } from '@cashtap/react';

<CashTapButton amount={500} memo="Coffee" onSuccess={handleSuccess} />
```

---

## Downloads

- **Web Dashboard** — [Live Demo](#)
- **Android APK** — [Download](#)
- **API Docs** — [`/docs/api`](docs/API.md)
- **SDK Guide** — [`/docs/sdk`](#)

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Team

Built for the **BCH-1 Hackcelerator 2026** (Feb 22-26) — Track: Applications.

> "We're building the Square for Bitcoin Cash."

---

<div align="center">
  <p>Powered by Bitcoin Cash</p>
  <img src="web/public/images/bch_coin.png" alt="BCH" width="48" />
</div>
