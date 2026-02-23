# BCH Pay — Bitcoin Cash Payment Rails for the Real World
## BCH-1 Hackcelerator — 4-Day Sprint (Feb 22–26, 2026)
## Track: Applications (User-facing apps that activate BCH in the real world)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | CashScript (BCH native contracts) |
| Tokens | CashTokens (fungible FTs + NFTs, native BCH protocol) |
| BCH Libraries | mainnet-js, @mainnet-cash/contract, libauth, cashscript |
| Web Frontend | Next.js 14+, TypeScript, Tailwind CSS, shadcn/ui |
| Mobile App | Flutter, Dart, go_router, Material 3 |
| Mobile Extras | mobile_scanner, flutter_vibrate, firebase_messaging, flutter_secure_storage |
| Backend | Node.js, Hono, Prisma ORM |
| Database | PostgreSQL (Neon or Supabase) |
| BCH Node/Indexer | Fulcrum (Electrum server), Chaingraph (GraphQL indexer) |
| Wallet Integration | Web: mainnet-js WalletConnect / Paytaca Web, Mobile: WalletConnect or deep links |
| Token Metadata | BCMR (Bitcoin Cash Metadata Registries) |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| Email | Resend (invoices, receipts) |
| Hosting | Vercel (web), Railway/Fly.io (API), Neon (DB) |
| CI/CD | GitHub Actions, Flutter Build (APK/IPA) |

---

## Architecture Overview

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

## Day 1: Foundation & Core Infrastructure (Feb 22 — 12 hours)

### Hour 1–3: Project Setup & Architecture

- [x] **Initialize monorepo structure**
  ```
  bch-pay/
  ├── contracts/          # CashScript smart contracts
  ├── web/                # Next.js (merchant dashboard + payment pages)
  ├── mobile/             # Flutter app (merchant POS + customer payments)
  ├── api/                # Backend API (Node.js + Hono)
  ├── landing/            # Marketing/landing page (can be a route in web/)
  ├── sdk/                # Embeddable JS SDK for third-party sites
  ├── shared/             # Shared types, utils, constants, API client
  └── docs/               # Documentation
  ```
- [x] Set up Git repo, basic CI (GitHub Actions — lint + typecheck)
- [x] Set up turborepo for monorepo task orchestration
- [x] **Configure BCH development environment**
  - [x] Install mainnet-js (`@mainnet-cash/mainnet-js`) — primary BCH library
  - [x] Install cashscript (`cashscript`) — smart contract compiler & SDK
  - [x] Install libauth — low-level BCH primitives (address encoding, tx building)
  - [x] Set up BCH testnet (chipnet) wallet with test BCH
  - [x] Configure connection to public Fulcrum electrum server (or self-host via Docker)
  - [x] Verify basic BCH send/receive works on chipnet
- [x] **Set up Next.js 14+ app** (web/)
  - [x] TypeScript, Tailwind CSS, shadcn/ui
  - [x] App Router with layout structure
  - [x] Basic auth context + protected routes shell
- [x] **Set up Flutter app** (mobile/)
  - [x] Initialize with `flutter create` (already created at /mobile)
  - [x] Configure go_router for navigation
  - [x] Set up Material 3 theming
  - [x] Install mobile_scanner, flutter_vibrate, firebase_messaging, flutter_secure_storage
  - [x] Configure Flutter build for APK generation
  - [ ] Verify app runs on physical device / emulator
- [x] **Set up backend API** (api/)
  - [x] Hono framework with TypeScript
  - [x] PostgreSQL + Prisma ORM setup
  - [x] Basic health check endpoint
  - [x] CORS, error handling middleware
  - [x] Environment variables configuration
- [x] **Set up shared package** (shared/)
  - [x] Typed API client (used by both web and mobile)
  - [x] Shared TypeScript types for all entities
  - [x] BCH utility functions (address validation, satoshi conversion, etc.)
  - [x] Shared constants (contract addresses, network config, status enums)

### Hour 3–7: Backend API Core

- [x] **Database schema design & Prisma models**
  ```
  merchants       - id, bch_address, business_name, email, logo_url, api_key_hash,
                    webhook_url, accepted_currencies (BCH/CashTokens), created_at, updated_at
  payment_links   - id, merchant_id, amount_satoshis, currency, memo, type (single/multi),
                    status, slug (unique), expires_at, created_at
  invoices        - id, merchant_id, customer_email, items (json), total_satoshis,
                    status (draft/sent/viewed/paid/overdue), due_date, paid_at, created_at
  transactions    - id, tx_hash, payment_link_id, invoice_id, sender_address,
                    recipient_address, amount_satoshis, confirmations, status, block_height,
                    token_category (nullable for CashToken txs), created_at
  webhooks        - id, merchant_id, event_type, payload (json), status,
                    attempts, last_attempt_at
  api_keys        - id, merchant_id, key_hash, label, permissions (json),
                    last_used_at, active
  devices         - id, merchant_id, device_token, platform (ios/android),
                    active, created_at
  cashtoken_configs - id, merchant_id, token_category, token_name, token_symbol,
                      token_decimals, purpose (loyalty/receipt/reward), active, created_at
  ```
- [x] Run `prisma migrate dev` — verify schema
- [x] **Auth system**
  - [x] BCH wallet-based authentication (sign message with private key → verify on server)
  - [x] `POST /api/auth/challenge` — generate random challenge nonce for address
  - [x] `POST /api/auth/verify` — verify BCH signature against challenge → issue JWT
  - [x] `POST /api/auth/refresh` — refresh JWT (mobile needs longer sessions)
  - [x] JWT middleware for protected routes
  - [x] API key auth middleware for developer API
  - [x] API key generation: `POST /api/merchants/:id/api-keys`
- [x] **Merchant endpoints**
  - [x] `POST /api/merchants` — register merchant (after wallet auth)
  - [x] `GET /api/merchants/:id` — get merchant profile
  - [x] `PUT /api/merchants/:id` — update profile (name, email, logo, webhook URL)
  - [x] `GET /api/merchants/me` — get current merchant (from JWT)
- [x] **Payment link endpoints**
  - [x] `POST /api/payment-links` — create payment link
    - Fields: amount (sats), currency (BCH or CashToken category), memo, type (single/multi), expires_at
    - Auto-generate unique slug (nanoid)
    - Generate BCH payment URI (BIP21): `bitcoincash:<address>?amount=<bch>&message=<memo>`
  - [x] `GET /api/payment-links/:slug` — get payment link (public, no auth)
  - [x] `GET /api/payment-links` — list merchant's payment links (authed)
  - [x] `PUT /api/payment-links/:id` — update payment link
  - [x] `DELETE /api/payment-links/:id` — deactivate payment link
- [x] **Transaction endpoints**
  - [x] `GET /api/transactions` — list merchant's transactions (with pagination, filters)
  - [x] `GET /api/transactions/:id` — get transaction details
  - [x] `GET /api/transactions/stats` — summary stats (total revenue, count, averages)
- [x] **Invoice endpoints**
  - [x] `POST /api/invoices` — create invoice
    - Fields: customer_email, items[], due_date, notes
    - Auto-calculate total from line items
  - [x] `GET /api/invoices/:id` — get invoice (public for payment page)
  - [x] `GET /api/invoices` — list merchant's invoices (authed)
  - [x] `PUT /api/invoices/:id` — update invoice (draft only)
  - [x] `POST /api/invoices/:id/send` — send invoice email to customer
  - [x] `POST /api/invoices/:id/remind` — send payment reminder
- [x] **Device registration (push notifications)**
  - [x] `POST /api/devices/register` — register FCM device token
  - [x] `DELETE /api/devices/:id` — unregister device

### Hour 7–10: BCH Blockchain Integration (Critical Path)

- [x] **BCH wallet service** (using mainnet-js)
  - [x] Generate HD wallet for each merchant (or import existing)
  - [x] Derive unique payment addresses per transaction (BIP44 derivation)
  - [x] Address generation: `bitcoincash:` format (CashAddr)
  - [x] Balance checking: query Fulcrum electrum for address balance
  - [x] Transaction building: create & broadcast BCH transactions
  - [x] Support for both BCH and CashToken transfers
- [x] **Payment address derivation strategy**
  - [x] Each payment link gets a unique derived address (prevents payment collision)
  - [x] Map: payment_link_slug → derived BCH address (stored in DB)
  - [x] Monitor derived address for incoming transactions
- [x] **BCH transaction monitor service**
  - [x] Connect to Fulcrum electrum server via WebSocket (ElectrumX protocol)
  - [x] Subscribe to address notifications: `blockchain.address.subscribe`
  - [x] On new transaction detected:
    1. Fetch full transaction details
    2. Verify amount matches expected payment
    3. Create/update transaction record in DB
    4. Trigger webhook to merchant
    5. Trigger push notification to merchant's mobile app
  - [x] Track confirmation count (0-conf for speed, 1+ for settlement)
  - [x] Handle mempool (unconfirmed) transactions — show as "pending"
  - [x] Handle confirmed transactions — update status to "confirmed"
  - [x] **0-conf instant payments** — BCH's killer feature for POS
    - [x] Accept 0-conf for small amounts (configurable threshold, e.g., <$50)
    - [ ] Check for double-spend proofs (DSProof protocol)
    - [x] Show "instant" confirmation on POS for 0-conf with no DSProof detected
- [x] **CashToken integration** (creative use of CashTokens — bonus points!)
  - [x] **Merchant loyalty tokens (fungible CashToken)**
    - [x] Merchant can create a branded loyalty token (FT)
    - [x] Auto-issue loyalty tokens to customers on each purchase
    - [x] Configurable reward rate (e.g., 1 token per 1000 sats spent)
    - [x] Customers can redeem loyalty tokens for discounts
  - [x] **Payment receipt NFTs (non-fungible CashToken)**
    - [x] Mint an NFT receipt for each transaction (on-chain proof of purchase)
    - [x] NFT commitment contains: merchant, amount, timestamp, memo
    - [x] Customer receives the NFT in their wallet automatically
    - [x] Useful for warranties, returns, proof-of-purchase
  - [x] **BCMR metadata registration**
    - [x] Register token metadata (name, symbol, icon) via BCMR standard
    - [x] So tokens display nicely in wallets like Paytaca/Cashonize
- [x] **Webhook delivery service**
  - [x] Queue-based webhook delivery with retries (3 attempts, exponential backoff)
  - [x] HMAC-SHA256 webhook signature for verification
  - [x] Event types: `payment.received`, `payment.confirmed`, `payment.expired`, `invoice.paid`
  - [x] `POST /api/webhooks/test` — send test webhook to merchant's URL
- [x] **Push notification service**
  - [x] Integrate Firebase Cloud Messaging (FCM)
  - [x] Send push on: payment received (0-conf instant!), payment confirmed, invoice paid
  - [x] Notification payload includes: amount, sender (truncated address), memo

### Hour 10–12: CashScript Smart Contracts

- [x] **Payment Gateway Contract** (`contracts/payment-gateway.cash`)
  - [x] Accept BCH payments with a unique payment identifier (OP_RETURN data)
  - [x] Forward funds to merchant address automatically
  - [x] Support payment with memo/reference embedded in transaction
  - [x] Verify minimum payment amount
- [x] **Escrow Contract** (`contracts/escrow.cash`)
  - [x] Lock BCH in escrow between buyer and seller
  - [x] Release to seller on buyer confirmation (multi-sig like)
  - [x] Refund to buyer on timeout (using OP_CHECKLOCKTIMEVERIFY)
  - [x] Arbiter resolution for disputes (optional third key)
  - [x] Useful for: marketplace payments, service payments, high-value goods
- [x] **Split Payment Contract** (`contracts/split-payment.cash`)
  - [x] Accept single payment input
  - [x] Split output to N recipients by percentage (up to 10 recipients)
  - [x] Atomic: all splits in one transaction
  - [x] Use cases: team payouts, revenue sharing, tip splitting, affiliate commissions
- [x] **Time-Locked Savings Contract** (`contracts/savings-vault.cash`)
  - [x] Lock BCH until a specified block height or timestamp
  - [x] Merchant can set aside a portion of revenue automatically
  - [x] Uses OP_CHECKLOCKTIMEVERIFY for trustless time-locking
  - [x] Withdraw only after lock period expires
- [x] **Contract tests**
  - [x] Unit tests for each contract using cashscript test utilities
  - [x] Test on chipnet (BCH testnet)
  - [x] Verify all spending paths work correctly
  - [x] Test edge cases: insufficient funds, expired timelocks, wrong keys
- [x] Deploy contracts to chipnet, verify interactions work end-to-end

---

## Day 2: Mobile App & Web Dashboard (Feb 23 — 12 hours)

### Hour 1–4: Mobile App — Core Screens

- [x] **App navigation structure** (go_router)
  ```
  lib/
  ├── screens/
  │   ├── tabs/
  │   │   ├── home_screen.dart        — Home (dashboard summary)
  │   │   ├── pos_screen.dart         — POS (point-of-sale / charge)
  │   │   ├── scan_screen.dart        — QR Scanner (scan to pay / receive)
  │   │   ├── activity_screen.dart    — Activity (transaction feed)
  │   │   └── settings_screen.dart    — Settings (profile, wallet, notifications)
  │   ├── auth/
  │   │   ├── connect_screen.dart     — Connect BCH wallet
  │   │   └── onboard_screen.dart     — Business profile setup
  │   └── payment/
  │       └── payment_screen.dart     — Payment confirmation screen (customer-facing)
  ```
- [x] **Onboarding / Auth flow**
  - [x] Welcome screen with app value proposition
  - [x] "Connect Wallet" — options:
    - [x] Generate new BCH wallet (mainnet-js) — store encrypted seed in flutter_secure_storage
    - [x] Import existing wallet via seed phrase
    - [x] Connect external wallet (Paytaca deep link / WalletConnect)
  - [ ] Sign challenge message to authenticate with backend
  - [x] Business profile setup: name, email, logo (camera/gallery picker)
  - [x] Persist JWT in flutter_secure_storage
- [x] **Home tab — Mobile Dashboard**
  - [x] Today's revenue (BCH + USD equivalent)
  - [x] Transaction count today
  - [x] Pending payments count
  - [x] Mini bar chart: last 7 days revenue (fl_chart)
  - [x] Recent transactions list (last 5, tap to see all)
  - [x] Quick action FAB: "Charge", "Payment Link", "Invoice"
  - [x] Pull to refresh
  - [x] Empty state with onboarding prompt
- [x] **POS tab — Point of Sale (THE FLAGSHIP FEATURE)**
  - [x] **Numeric keypad** (custom, clean, large touch targets — like Square/SumUp)
    - [x] Large amount display at top: "$0.00" or "0.00000000 BCH"
    - [x] Currency toggle button: USD / BCH (use live BCH/USD rate)
    - [x] Numpad: 0-9, decimal point, backspace
    - [x] Haptic feedback on every keypress (flutter_vibrate / HapticFeedback)
  - [x] Add memo/description field (optional, collapsed by default)
  - [x] **"Charge" button** — large, prominent, green
    - [x] Generates a unique payment address (derived from merchant HD wallet)
    - [x] Creates payment link record in backend
    - [x] Generates QR code containing BIP21 payment URI:
      `bitcoincash:<address>?amount=<bch>&message=<memo>`
    - [x] Also generates a web payment URL: `https://bchpay.app/pay/<slug>`
  - [x] **QR Code display screen** (after tapping "Charge")
    - [x] Large QR code (BIP21 URI) — scannable by ANY BCH wallet
    - [x] Amount displayed below QR: "$5.00 (0.0125 BCH)"
    - [x] "Share" button — share QR image or payment link via native share sheet
    - [x] "Copy Link" button
    - [x] Timer/countdown if payment has expiration
    - [x] **Real-time payment status indicator:**
      - [x] "Waiting for payment..." (pulsing animation)
      - [x] "Payment detected!" (0-conf) → vibration + haptic + sound
      - [x] "Payment confirmed!" (1+ conf) → confetti animation
    - [x] Poll backend or WebSocket for payment status updates
    - [x] **On payment received:**
      - [x] Strong haptic feedback (HapticFeedback.heavyImpact)
      - [x] Green checkmark animation (custom AnimationController with bounce)
      - [x] Confetti burst animation
      - [x] Sound effect (SystemSound + haptic pattern)
      - [x] Display: "Received $5.00 from bitcoincash:qz...xyz"
      - [x] "New Charge" button to start over
      - [x] "Share Receipt" button
  - [x] **This is the demo showstopper** — the entire pitch revolves around this screen
- [x] **QR Scanner tab**
  - [x] Camera-based QR scanner (mobile_scanner)
  - [x] Scan BIP21 URI → parse address + amount → pre-fill send screen
  - [x] Scan another BCH Pay QR → open payment in-app
  - [x] Scan raw BCH address → navigate to send screen
  - [x] Flashlight toggle
  - [x] Gallery import for QR from screenshots
  - [x] Haptic feedback on successful scan
- [x] **Activity tab — Transaction Feed**
  - [x] Transaction list (newest first)
  - [x] Each item shows: amount (BCH + USD), sender address (truncated), status icon, timestamp
  - [x] Status badges: "Instant" (0-conf), "Confirmed" (1+), "Pending", "Failed"
  - [x] Filter chips: All, Today, This Week, This Month
  - [x] Filter by status: All, Completed, Pending
  - [x] Tap transaction → detail screen:
    - [x] Full tx hash (tap to copy)
    - [x] Link to BCH block explorer (blockchair.com/bitcoin-cash)
    - [x] Sender/recipient addresses
    - [x] Amount in BCH + USD at time of transaction
    - [x] Confirmation count
    - [x] Memo/description
    - [x] Loyalty tokens issued (if applicable)
    - [x] Receipt NFT details (if applicable)
  - [x] Pull to refresh
  - [x] Infinite scroll pagination

### Hour 4–6: Mobile App — Settings & Polish

- [x] **Settings tab**
  - [x] Merchant profile view/edit (name, logo, email)
  - [x] Connected wallet info: address (tap to copy), balance
  - [x] **Accepted payments config:**
    - [x] BCH toggle (always on)
    - [x] CashToken acceptance toggle
    - [x] Minimum payment amount
    - [x] 0-conf acceptance toggle + threshold slider
  - [x] **Loyalty tokens config:**
    - [x] Enable/disable loyalty token issuance
    - [x] Token name, symbol, reward rate
    - [x] Create new loyalty token (mints CashToken)
  - [x] **Notification preferences:**
    - [x] Push on payment received (on/off)
    - [x] Push on payment confirmed (on/off)
    - [x] Push on invoice paid (on/off)
    - [x] Large payment alert threshold
  - [x] Webhook URL configuration
  - [x] API key management (view, create, revoke)
  - [x] Export transactions (CSV)
  - [x] Dark/light theme toggle
  - [x] About: app version, support link, BCH-1 hackathon credit
- [x] **Push notification handling (Firebase Cloud Messaging)**
  - [x] Register for push notifications on app launch (firebase_messaging)
  - [x] Handle notification tap → navigate to relevant transaction
  - [x] Notification types:
    - [x] "Payment received: 0.05 BCH ($5.00) from qz...xyz"
    - [x] "Invoice #1234 paid: 0.1 BCH ($10.00)"
    - [x] "Large payment: 1.5 BCH ($150.00) received"
- [x] **Offline handling**
  - [x] Offline banner when no connectivity
  - [x] Queue POS charges locally, sync when back online
  - [x] Cache recent transactions for offline viewing
- [x] **Mobile UX polish**
  - [x] Haptic feedback on all interactive elements
  - [x] Smooth screen transitions (Flutter animations / Hero widgets)
  - [x] Loading skeletons for all data screens
  - [x] Empty states with illustrations
  - [x] Error states with retry buttons
  - [x] Pull-to-refresh on all list screens

### Hour 6–10: Web Dashboard

- [x] **Wallet connection (web)**
  - [x] Connect via Paytaca browser extension (if available)
  - [x] OR: Import wallet via seed phrase (encrypted in localStorage)
  - [x] OR: Generate new wallet in-browser (mainnet-js)
  - [x] Sign challenge → authenticate → JWT stored in httpOnly cookie
- [x] **Onboarding flow**
  - [x] Connect wallet → sign message → create merchant profile
  - [x] Business name, email, logo upload
  - [x] Dashboard tour for first-time users (react-joyride or custom)
- [x] **Dashboard home** (`/dashboard`)
  - [x] Stats cards: Total Revenue (BCH + USD), Transaction Count, Pending Payments, Avg Payment Size
  - [x] Revenue chart (daily/weekly/monthly toggle) — recharts or chart.js
  - [x] Recent transactions list (last 10)
  - [x] Quick actions: "Create Payment Link", "Create Invoice", "View All Transactions"
  - [x] Live BCH/USD price ticker in header
- [x] **Payment Links page** (`/dashboard/payment-links`)
  - [x] "Create Payment Link" button → modal/drawer:
    - [x] Amount (BCH or USD — auto-convert)
    - [x] Memo/description
    - [x] Type: single-use / multi-use
    - [x] Expiration: none / 1 hour / 24 hours / 7 days / custom
    - [x] Enable loyalty token reward for this link
    - [x] Enable receipt NFT for this link
  - [x] Payment links table:
    - [x] Columns: Name/Memo, Amount, Type, Status, Created, Total Collected, Actions
    - [x] Actions: Copy Link, Download QR, Share, Deactivate
  - [x] Click link → detail view with QR code, payment URL, collection stats
- [x] **Transactions page** (`/dashboard/transactions`)
  - [x] Filterable, sortable data table (tanstack-table)
  - [x] Columns: Date, Amount (BCH), Amount (USD), From, Status, Tx Hash, Type
  - [x] Filters: date range, status, min/max amount, payment link
  - [x] Click row → transaction detail slide-over:
    - [x] Full tx hash (link to block explorer)
    - [x] Sender/recipient
    - [x] Confirmation count
    - [x] Loyalty tokens issued
    - [x] Receipt NFT link
  - [x] Export as CSV button
  - [x] Export as JSON button
- [x] **Invoices page** (`/dashboard/invoices`)
  - [x] "Create Invoice" button → full-page form:
    - [x] Customer email
    - [x] Line items: description, quantity, unit price (add/remove rows)
    - [x] Auto-calculate subtotal, tax (optional %), total
    - [x] Due date picker
    - [x] Notes/terms textarea
    - [x] "Save as Draft" / "Send Invoice" buttons
  - [x] Invoice list table:
    - [x] Columns: Invoice #, Customer, Amount, Status, Due Date, Actions
    - [x] Status badges: Draft, Sent, Viewed, Paid, Overdue
    - [x] Actions: View, Edit (draft only), Send, Send Reminder, Delete
  - [x] Click invoice → detail view with full invoice rendering
- [x] **Payment page** (`/pay/:slug`) — PUBLIC, responsive
  - [x] Clean, minimal design — no login required to view
  - [x] Show: merchant name + logo, amount, memo
  - [x] Large QR code (BIP21 URI — works with any BCH wallet)
  - [x] "Pay with BCH Wallet" button (deep link to wallet apps)
  - [x] Manual: display BCH address + amount to copy
  - [x] Real-time payment status (polling):
    - [x] "Awaiting payment..."
    - [x] "Payment detected! Confirming..."
    - [x] "Payment confirmed! Thank you."
  - [x] Success screen with receipt details
  - [x] Mobile-responsive (most payments happen on phones)
- [x] **Invoice payment page** (`/invoice/:id`) — PUBLIC
  - [x] Professional invoice layout (printable)
  - [x] Line items, totals, due date, merchant info
  - [x] "Pay Now" button → shows QR code + BCH address
  - [x] Payment status tracking
  - [x] Download as PDF button (react-pdf or html2canvas)
- [x] **Settings page** (`/dashboard/settings`)
  - [x] Profile: business name, email, logo
  - [x] Wallet: connected address, balance
  - [x] Webhook URL configuration + test button
  - [x] API keys: list, create, revoke
  - [x] CashToken loyalty config: create token, set reward rate
  - [x] Notification preferences
  - [x] Danger zone: delete account

### Hour 10–12: Integration Testing & Deployment (Staging)

- [ ] Test full flow on chipnet:
  1. Register merchant (mobile)
  2. Create POS charge (mobile)
  3. Pay from a separate chipnet wallet
  4. Verify payment detected + push notification
  5. Check web dashboard reflects new transaction
- [ ] Test payment link flow:
  1. Create payment link (web)
  2. Open payment page in browser
  3. Pay from wallet
  4. Verify webhook fires
- [ ] Test invoice flow:
  1. Create invoice (web)
  2. Open invoice page
  3. Pay invoice
  4. Verify status updates
- [ ] Deploy API to Railway/Fly.io (staging) — Dockerfile, fly.toml, railway.json ready; needs `flyctl auth login`
- [x] Deploy web to Vercel (staging)
- [x] Build Flutter debug APK for mobile testing
- [x] Fix any critical bugs found during testing

---

## Day 3: Advanced Features & CashToken Magic (Feb 24 — 12 hours)

### Hour 1–3: CashToken Deep Integration (Hackathon Differentiator)

- [x] **Merchant loyalty token system (fungible CashTokens)**
  - [x] "Create Loyalty Token" flow in settings:
    - [x] Token name (e.g., "CoffeeShop Rewards")
    - [x] Token symbol (e.g., "COFFEE")
    - [x] Reward rate: X tokens per Y satoshis spent
    - [x] Genesis transaction: mint initial supply of fungible CashToken
    - [x] Register BCMR metadata (name, symbol, icon URL, description)
  - [x] Auto-issue loyalty tokens on every purchase:
    - [x] After payment confirmed, build a tx that sends loyalty tokens to customer address
    - [x] Include in the same block if possible, or as a follow-up tx
    - [x] Log token issuance in transaction record
  - [x] **Loyalty redemption:**
    - [x] Customer presents loyalty tokens at POS
    - [x] Merchant scans customer's token QR or enters address
    - [x] System calculates discount based on token balance
    - [x] Burn tokens on redemption (send back to merchant for re-issuance or destroy)
  - [x] Display loyalty stats in dashboard: total issued, redeemed, outstanding
- [x] **Payment receipt NFTs (non-fungible CashTokens)**
  - [x] On each payment, optionally mint an NFT receipt
  - [x] NFT commitment data (on-chain, in the CashToken's commitment field):
    - [x] Merchant identifier
    - [x] Amount paid (satoshis)
    - [x] Timestamp
    - [x] Payment reference / memo
  - [x] Send NFT to customer's address in the payment confirmation tx
  - [x] Customer can view their receipt NFTs in any CashToken-aware wallet
  - [x] Useful for: proof of purchase, warranty claims, returns, collectibles
  - [x] Receipt NFT viewer page on web: `/receipt/:tokenId`
- [x] **CashToken analytics in dashboard**
  - [x] Total loyalty tokens issued
  - [x] Top loyalty token holders (anonymized addresses)
  - [x] Redemption rate
  - [x] Receipt NFTs minted count

### Hour 3–5: Split Payments & Advanced Payment Features

- [x] **Split payment feature**
  - [x] "Create Split Payment" form (web + mobile):
    - [x] Total amount
    - [x] Recipients: BCH address + percentage (or fixed amount)
    - [x] Add up to 10 recipients
    - [x] Preview: show each recipient's share
  - [x] Build CashScript transaction that atomically splits payment:
    - [x] Single input → N outputs (one per recipient)
    - [x] All-or-nothing execution
  - [x] Use cases shown in UI: team payouts, revenue sharing, tips, affiliate commissions
  - [x] Split payment link: customer pays once, funds split automatically
- [x] **Escrow payments**
  - [x] "Create Escrow Payment" flow:
    - [x] Buyer sends BCH to escrow CashScript contract
    - [x] Funds locked until buyer confirms receipt of goods/service
    - [x] Automatic release after timeout (configurable: 7/14/30 days)
    - [x] Dispute resolution: optional arbiter key
  - [x] Escrow status tracking in dashboard
  - [x] "Release Funds" / "Request Refund" buttons
- [x] **Recurring payment links**
  - [x] Payment link with "recurring" flag
  - [x] Merchant creates a subscription-style link
  - [x] Track multiple payments against the same link
  - [x] Dashboard shows: total collected, payment count, last payment date
  - [x] Note: BCH doesn't support auto-debit, so this is voluntary recurring (customer pays each time)
- [x] **Multi-currency display**
  - [x] All amounts shown in both BCH and USD
  - [x] Live BCH/USD rate from CoinGecko or similar API
  - [x] Rate refresh every 60 seconds
  - [x] Historical rate stored with each transaction (USD value at time of payment)
  - [x] Settings: primary display currency (BCH or USD)

### Hour 5–7: Developer API & Embeddable SDK

- [x] **Public REST API** (authenticated via API key)
  - [x] All existing endpoints accessible via API key (x-api-key header)
  - [x] Rate limiting: 100 req/min per API key
  - [x] API versioning: `/api/v1/...`
  - [x] Comprehensive error responses with codes
  - [x] **API documentation page** (`/docs/api`):
    - [x] Interactive API reference (Swagger UI or custom)
    - [x] Code examples in cURL, JavaScript, Python
    - [x] Authentication guide
    - [x] Webhook integration guide
    - [x] CashToken API reference
- [x] **Embeddable payment button SDK** (sdk/)
  - [x] Lightweight JS bundle: `<script src="https://bchpay.app/sdk.js">`
  - [x] Simple API:
    ```js
    BCHPay.button({
      merchant: "bitcoincash:qz...",
      amount: 500,  // in cents USD, auto-converted to BCH
      memo: "Coffee",
      containerId: "pay-button",
      onSuccess: (tx) => console.log("Paid!", tx),
      onError: (err) => console.log("Failed", err),
    })
    ```
  - [x] Renders a styled "Pay with BCH" button
  - [x] On click → opens modal with QR code + payment status
  - [x] Customizable: button text, colors, size
  - [x] React component version: `<BCHPayButton amount={500} memo="Coffee" />`
  - [x] Checkout session redirect flow (like Stripe Checkout):
    - [x] `POST /api/v1/checkout/sessions` → returns checkout URL
    - [x] Redirect customer to hosted checkout page
    - [x] On completion → redirect to merchant's success_url
- [x] **SDK demo page** (`/docs/sdk`)
  - [x] Live, working "Pay with BCH" button
  - [x] Code snippets for integration
  - [x] Step-by-step guide

### Hour 7–9: Analytics & Reporting

- [x] **Merchant analytics (web dashboard)** (`/dashboard/analytics`)
  - [x] **Revenue chart**: line/bar chart, daily/weekly/monthly, BCH + USD
  - [x] **Payment volume**: transaction count over time
  - [x] **Average payment size**: trend over time
  - [x] **Top payment links**: which links generate most revenue
  - [x] **Payment method breakdown**: direct BCH vs. payment link vs. invoice vs. POS
  - [x] **CashToken stats**: loyalty tokens issued, redeemed, receipt NFTs minted
  - [x] **Customer insights** (anonymized): unique addresses, repeat customers
  - [x] Date range picker for all charts
- [x] **Mobile analytics (simplified)** — add to Home tab
  - [x] Revenue cards: today, this week, this month, all-time
  - [x] Simple bar chart: last 7 days
  - [x] Payment count badge
  - [x] Swipe between time periods
- [x] **Export & reporting**
  - [x] CSV export with columns: date, amount_bch, amount_usd, from, to, tx_hash, memo, status
  - [x] JSON export for developer use
  - [ ] Monthly summary email (stretch)
- [x] **Real-time updates**
  - [x] SSE connection for live transaction feed (web)
  - [x] Polling fallback for mobile (every 5 seconds when on POS screen)
  - [x] In-app notification feed (bell icon in header)
  - [x] Notification count badge

### Hour 9–12: Polish & Edge Cases

- [x] **Error handling everywhere**
  - [x] API: consistent error response format `{ error, code }` with standardized error codes
  - [x] Web: toast notifications for errors (sonner)
  - [x] Mobile: alert dialogs for critical errors, toasts for minor ones
  - [x] Retry logic for failed API calls (web apiFetch with exponential backoff)
  - [x] Graceful degradation when BCH node is unreachable
- [x] **Security hardening**
  - [x] Input validation on all API endpoints (zod schemas)
  - [x] SQL injection prevention (Prisma parameterized queries)
  - [x] XSS prevention (React auto-escaping + security headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
  - [x] Rate limiting on auth endpoints (stricter: 10 req/min)
  - [x] CORS configuration (only allow known origins)
  - [x] Webhook signature verification documentation for merchants
  - [x] Mobile: encrypted storage for wallet keys (flutter_secure_storage)
  - [x] Web: no private keys in localStorage (only in memory or encrypted)
  - [x] CashScript contract review: verify no unauthorized spending paths
- [x] **Performance**
  - [x] API response caching (in-memory) for analytics (60s TTL)
  - [x] Database query optimization (Prisma indexes)
  - [x] Lazy loading for dashboard charts
  - [x] Image optimization for merchant logos (next/image)
  - [x] Mobile: ListView.builder virtualization for transaction lists
- [ ] **Cross-platform testing**
  - [ ] Web: Chrome, Firefox, Safari
  - [ ] Mobile: test on Android physical device + iOS simulator
  - [ ] Payment page: test on multiple mobile browsers
  - [ ] QR code scanning: test with different BCH wallets (Paytaca, Electron Cash, Bitcoin.com)

---

## Day 4: Demo, Submission & Social Momentum (Feb 25–26 — 12+ hours)

### Hour 1–3: Production Deployment

- [ ] **Deploy CashScript contracts to BCH mainnet** (or keep on chipnet for demo safety)
- [ ] **Deploy backend API to production**
  - [ ] Railway or Fly.io
  - [ ] Production PostgreSQL (Neon)
  - [ ] Environment variables set
  - [ ] Sentry error tracking
  - [ ] Health check monitoring
- [ ] **Deploy web frontend to Vercel**
  - [ ] Custom domain if available (bchpay.app or similar)
  - [ ] SSL configured
  - [ ] Environment variables set
  - [ ] OG meta tags for social sharing
- [ ] **Build mobile APK**
  - [ ] `flutter build apk --release`
  - [ ] Test APK on physical device
  - [ ] Host APK download on landing page or GitHub releases
  - [ ] Host APK for easy download by judges
- [ ] **Smoke test all critical paths on production**
  - [ ] Register merchant → create POS charge → pay → verify
  - [ ] Create payment link → share → pay → verify
  - [ ] Create invoice → send → pay → verify
  - [ ] CashToken loyalty token issuance → verify in wallet
  - [ ] Receipt NFT minting → verify in wallet
  - [ ] Webhook delivery → verify
  - [ ] Push notification → verify on phone
- [ ] **Seed demo data**
  - [ ] Create demo merchant account with realistic business name/logo
  - [ ] Pre-populate with 20-30 sample transactions
  - [ ] Create sample payment links and invoices
  - [ ] Dashboard looks full and impressive for screenshots/demo

### Hour 3–5: Landing Page

- [ ] **Landing page** (can be `/` route in web app or separate)
  - [ ] Hero section:
    - [ ] Headline: "Accept Bitcoin Cash in Seconds"
    - [ ] Subheadline: "Mobile POS, Payment Links, Invoices, and CashToken Loyalty — all in one app"
    - [ ] Hero image: side-by-side mockup of mobile POS + web dashboard
    - [ ] CTA button: "Get Started" → links to web dashboard
    - [ ] Secondary CTA: "Download App" → APK download
  - [ ] **Demo GIF/Video section:**
    - [ ] Animated GIF showing the POS charge → QR → payment → confirmation flow
    - [ ] Caption: "From charge to confirmed in under 30 seconds"
  - [ ] **Features section** (3-4 cards):
    - [ ] Mobile POS: "Charge customers with your phone"
    - [ ] Payment Links: "Share a link, get paid in BCH"
    - [ ] CashToken Loyalty: "Reward customers with on-chain loyalty tokens"
    - [ ] Receipt NFTs: "On-chain proof of every purchase"
  - [ ] **How it works** (3 steps):
    1. "Download the app & connect your BCH wallet"
    2. "Enter the amount and show the QR code"
    3. "Customer scans, pays, done — instant confirmation"
  - [ ] **CashToken section** (highlighted — bonus points):
    - [ ] Explain loyalty tokens and receipt NFTs
    - [ ] Show how it uses BCH's native token protocol
  - [ ] **For Developers section:**
    - [ ] Code snippet showing SDK integration
    - [ ] "Integrate BCH payments in 5 lines of code"
    - [ ] Link to API docs
  - [ ] **Download section:**
    - [ ] Android APK download button
    - [ ] Flutter APK download
    - [ ] Web dashboard link
    - [ ] GitHub repo link
  - [ ] **Footer:**
    - [ ] Built for BCH-1 Hackcelerator
    - [ ] GitHub, Twitter links

### Hour 5–8: Demo Video & Pitch

- [ ] **Demo video** (< 5 minutes) — structure:
  - [ ] **Problem** (30s):
    - [ ] Crypto payments are still complex — QR codes that don't work, slow confirmations, no mobile POS for BCH
    - [ ] Merchants need something as easy as Square but for Bitcoin Cash
    - [ ] BCH has 0-conf instant payments but no app leverages this for real commerce
  - [ ] **Solution** (30s):
    - [ ] BCH Pay — a full payment platform for Bitcoin Cash
    - [ ] Mobile POS + Web Dashboard + Payment Links + Invoices
    - [ ] First app to combine CashTokens for loyalty rewards and receipt NFTs
    - [ ] Built entirely on BCH — no L2, no bridges, no wrapped tokens
  - [ ] **Live Demo** (2.5 min):
    - [ ] **Mobile POS flow** (the hero moment):
      1. Open app → tap POS tab
      2. Type "$5.00" on numpad
      3. Tap "Charge" → QR code appears
      4. Customer scans with their BCH wallet
      5. Customer sends payment
      6. Merchant's phone vibrates → "Payment received!" → confetti
      7. Show: customer received loyalty tokens + receipt NFT in their wallet
    - [ ] **Web dashboard:**
      1. Transaction appears in real-time feed
      2. Show analytics charts
      3. Create a payment link → copy → share
      4. Create an invoice → send to customer
    - [ ] **CashToken loyalty:**
      1. Show loyalty token in customer's wallet
      2. Show receipt NFT with purchase details
      3. "On-chain loyalty and receipts — a BCH first"
    - [ ] **Developer API:**
      1. Quick cURL command creating a payment link
      2. Show embedded payment button on a test page
    - [ ] **Split payment:**
      1. Create $30 split to 3 addresses
      2. Show atomic transaction on explorer
  - [ ] **Tech Architecture** (30s):
    - [ ] Architecture diagram: Mobile → API → BCH chain
    - [ ] CashScript contracts, CashTokens, mainnet-js
    - [ ] 0-conf instant payments with DSProof protection
    - [ ] BCMR for token metadata
  - [ ] **Impact & Vision** (30s):
    - [ ] Every merchant with a phone can accept BCH
    - [ ] CashToken loyalty creates merchant/customer stickiness
    - [ ] Receipt NFTs bring real utility to NFTs
    - [ ] Roadmap: Apple Pay/Google Pay integration, multi-language, marketplace
    - [ ] "We're building the Square for Bitcoin Cash"
- [ ] **Recording setup**
  - [ ] OBS or ScreenStudio for screen recording
  - [ ] Physical device screen mirror for mobile capture (scrcpy for Android)
  - [ ] Prepare demo accounts with pre-seeded data
  - [ ] Script the walkthrough — practice once before recording
  - [ ] Record 2-3 takes, pick best
  - [ ] Light editing: trim dead air, add captions for key moments
  - [ ] Export 1080p MP4, upload to YouTube (unlisted) + keep local copy
- [ ] **Pitch deck** (optional, if time allows — Google Slides / Figma)
  - [ ] 8-10 slides covering Problem → Solution → Demo → Tech → Impact → Team
  - [ ] Use for demo day presentation

### Hour 8–10: GitHub & Documentation

- [ ] **GitHub repo polish**
  - [ ] **README.md** — comprehensive:
    - [ ] Project logo/banner
    - [ ] One-line description: "BCH Pay — Bitcoin Cash Payment Rails for the Real World"
    - [ ] Badges: build status, license
    - [ ] Screenshots: web dashboard + mobile app (4-6 screenshots)
    - [ ] GIF of POS payment flow (the money shot)
    - [ ] **Features list** with CashToken integration highlighted
    - [ ] **Architecture diagram** (from this doc)
    - [ ] **Tech stack table**
    - [ ] **Getting started** (local development):
      - [ ] Prerequisites (Node.js, pnpm, Flutter SDK)
      - [ ] Clone, install, configure env
      - [ ] Run API, web, mobile
      - [ ] Connect to chipnet for testing
    - [ ] **CashScript contract addresses** (chipnet/mainnet)
    - [ ] **Live links**: web demo, APK download, API docs
    - [ ] **API documentation** link
    - [ ] **License**: MIT
    - [ ] **Team info**
    - [ ] **Built for BCH-1 Hackcelerator** badge/note
  - [ ] Clean commit history (squash messy commits if needed)
  - [ ] Ensure no secrets in repo (.env in .gitignore)
  - [ ] LICENSE file (MIT)
  - [ ] Add screenshots/ directory with annotated screenshots
- [ ] **API documentation**
  - [ ] Swagger/OpenAPI spec or simple markdown docs
  - [ ] All endpoints listed with request/response examples
  - [ ] Authentication guide (wallet signing + API keys)
  - [ ] Webhook integration guide
  - [ ] CashToken API endpoints

### Hour 10–12: Submission & Social Momentum

- [ ] **DoraHacks BUIDL submission**
  - [ ] Project name: "BCH Pay"
  - [ ] Tagline: "Bitcoin Cash Payment Rails — Mobile POS, Payment Links, Invoices & CashToken Loyalty"
  - [ ] Track: Applications
  - [ ] Description: comprehensive but scannable (use the six judging criteria as headers)
  - [ ] Upload demo video
  - [ ] Link GitHub repo
  - [ ] Link live web demo
  - [ ] Link APK download
  - [ ] Link API docs
  - [ ] Team members
  - [ ] Technical approach section — emphasize CashScript, CashTokens, BCMR, 0-conf
  - [ ] Post-sprint development plan:
    - [ ] Apple Pay / Google Pay NFC integration
    - [ ] Multi-language support
    - [ ] Merchant marketplace / directory
    - [ ] Fiat on/off-ramp integration
    - [ ] Point-of-sale hardware integration
    - [ ] BCH ↔ stablecoin DEX integration when available
- [ ] **Social media posts (3 required by hackathon rules)**
  - [ ] **Post 1** (Twitter/X): Project announcement
    - [ ] "Building @BCH_Pay for #BCH1Hackathon — Mobile POS for Bitcoin Cash merchants. Accept BCH with just your phone. CashToken loyalty rewards built-in. 🏗️"
    - [ ] Include screenshot of mobile POS
    - [ ] Tag @BCH_1_Official, #BitcoinCash, #CashTokens
  - [ ] **Post 2** (Twitter/X): Technical deep dive
    - [ ] "How BCH Pay uses CashTokens for merchant loyalty & receipt NFTs — a thread 🧵"
    - [ ] Thread explaining CashToken loyalty tokens + receipt NFTs
    - [ ] Include architecture diagram
    - [ ] Tag @BCH_1_Official
  - [ ] **Post 3** (Twitter/X): Demo video
    - [ ] "Watch BCH Pay in action: Merchant charges $5 → Customer scans QR → Payment confirmed in seconds. With CashToken loyalty rewards. Built for #BCH1Hackathon"
    - [ ] Attach 30-60 second clip of the POS flow
    - [ ] Tag @BCH_1_Official, #BitcoinCash, #BCH
  - [ ] **Bonus posts:**
    - [ ] Post on Telegram (@bch_1_official channel)
    - [ ] Reddit r/bitcoincash post
    - [ ] Share in BCH developer communities
- [ ] **Final checklist before submission deadline (Feb 26)**
  - [ ] All links work: web demo, APK, GitHub, API docs, video
  - [ ] Demo video plays correctly
  - [ ] Web app loads without errors
  - [ ] Mobile app installs and runs
  - [ ] At least 3 social media posts published
  - [ ] DoraHacks submission form complete
  - [ ] Weekly check-in completed (if required)
  - [ ] Post-sprint development plan included

---

## Judging Criteria Alignment

| Criteria | How BCH Pay Scores |
|---|---|
| **Execution** | Full-stack: 4 CashScript contracts + backend API + web dashboard + mobile app + SDK. Working demo on mainnet/chipnet. |
| **Clarity** | Dead simple pitch: "Square for Bitcoin Cash." POS demo is instantly understandable. |
| **Impact** | Enables real-world BCH commerce. Every merchant with a phone can accept Bitcoin Cash. Loyalty tokens create ecosystem stickiness. |
| **Originality** | First BCH app combining: mobile POS + CashToken loyalty + receipt NFTs + payment links + invoices + developer SDK. Novel use of CashTokens for real commerce. |
| **Social Momentum** | POS demo is extremely shareable. 15-second video clip = instant social proof. CashToken angle is novel and tweetable. |
| **Follow-through** | Clear roadmap: NFC payments, fiat ramps, merchant marketplace, hardware POS. Revenue model: transaction fees on premium features. |
| **Bonus: CashTokens** | Deep CashToken integration: fungible loyalty tokens + NFT receipts + BCMR metadata. Not just using CashTokens — building real utility. |

---

## Demo Script — The "Wow" Moment

```
1. Merchant opens BCH Pay mobile app → taps POS tab
2. Types "$5.00" on the numpad → taps "Charge"
3. QR code appears on screen (BIP21 URI — works with ANY BCH wallet)
4. Customer scans QR with Paytaca / Electron Cash / Bitcoin.com wallet
5. Customer taps "Send" in their wallet
6. ~1 second later (0-conf!): merchant's phone vibrates
   → Push notification: "Payment received: $5.00 BCH"
   → POS screen: green checkmark + confetti animation
   → Haptic feedback burst
7. Customer checks their wallet:
   → Received 5 "CoffeeShop Rewards" loyalty tokens (CashToken FT)
   → Received 1 receipt NFT with purchase details (CashToken NFT)
8. Switch to web dashboard → transaction appears in real-time feed
   → Analytics update live
9. Done. Bitcoin Cash commerce in under 10 seconds.
   (Thanks to BCH's 0-conf instant payments — no L2, no bridges, no waiting.)
```

---

## Priority Tiers (If Running Low on Time)

### P0 — Must Ship (Core demo flow)
- [x] Mobile POS (numpad → QR → payment detection → confirmation)
- [x] Backend API (auth, payment links, transactions)
- [ ] BCH transaction monitoring (Fulcrum/electrum)
- [x] Web payment page (/pay/:slug)
- [x] Basic web dashboard (stats + transactions)
- [ ] Demo video
- [ ] GitHub README
- [ ] DoraHacks submission

### P1 — Should Ship (Strong entry)
- [x] CashToken loyalty tokens
- [x] CashToken receipt NFTs
- [x] Invoice system
- [x] Mobile activity tab
- [x] Split payments (contract written)
- [x] Push notifications
- [ ] 3 social media posts
- [x] Landing page

### P2 — Nice to Have (Winning entry)
- [x] Escrow contract
- [x] Developer SDK (embeddable button)
- [x] Analytics dashboard with charts
- [x] Recurring payment links
- [x] API documentation (Swagger)
- [x] CSV export
- [x] Time-locked savings vault contract
- [x] Webhook delivery system with retries

### P3 — Stretch Goals
- [x] Mobile dark mode
- [ ] Multi-language (English + Spanish)
- [ ] Merchant directory / discovery page
- [ ] Customer-facing mobile app (not just merchant)
- [ ] QR code customization with merchant branding
