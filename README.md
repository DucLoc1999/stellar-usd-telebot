# Stellarish — Buy & Sell XLM, USDC

> The friendly face of Stellarish — a Telegram bot that lets anyone buy and sell XLM/USDC with Vietnamese Dong, without ever talking to an API.

`Stellarish` is a Telegram bot (grammY) that acts as the **client side** of the Stellarish platform. Users buy and sell crypto through inline keyboards and guided flows; the bot handles KYC, fees, rates, and order states, while delegating all financial heavy-lifting to the `payment_server` backend.

## 🎯 Philosophy

A Telegram trading flow works when it feels like chatting with a helpful teller, and fails the moment a message gets out of order or a button is tapped twice. So this bot is built around three commitments:

1. **Guide, don't dump** — every action runs through a state machine with validating inputs, confirmation steps, and clear next buttons; double-taps can't create double orders.
2. **React, don't guess** — order state changes come from `payment_server` as signed webhooks, verified, ordered, and delivered to the right chat in the right sequence.
3. **Survive the retry storm** — per-chat notification queues, duplicate-photo guards, and graceful drains keep the bot calm under Telegram retries and out-of-order callbacks.

## 🧱 Architecture

### How a tap becomes a trade

```
Telegram user
   │ taps buy / sell / KYC / wallets / referral
   ▼
grammY bot ──► user state machine ──► services ──► payment_server
   │                                              (quotes, orders, SePay,
   │                                               disbursements)
   ▼
signed order-state events
   ▼
webhookService (verify HMAC)
   ▼
notificationQueueService (per-chat sequential delivery)
   ▼
order status message sent back to the Telegram user
```

### Components

| Component | Role |
|---|---|
| **tele server** | Hosts the Telegram webhook + signed payment webhook endpoints |
| **grammY bot** | Inline keyboard navigation, callback queries, photo/contact handling |
| **user state machine** | Validates multi-step flows (buy, sell, KYC, wallet/bank entry) |
| **paymentService** | Thin client for `payment_server` — rates, fee config, deposits, withdrawals |
| **webhookService** | Verifies `X-Signature` + `X-Timestamp` on payment events |
| **notificationQueueService** | Per-chat queues deliver status updates in chronological order |
| **kycService / fptAiVision** | ID-card OCR (front/back); photos stored on S3 |
| **Stellar (stellar-sdk)** | Trustline checks, Stellar Pay URIs, QR codes, Horizon lookups |
| **MySQL (Knex)** | Mirrored orders, tele users, KYC records, saved banks/wallets, referrals |

## ✨ Key Features

### 1. Telegram-First UX
Inline keyboards and callback queries drive the whole experience — rates, buy, sell, KYC, saved bank accounts, crypto wallets, referral info, and support all live behind a single main menu.

### 2. Guided Multi-Step Flows
A state machine (`waitingFor` + per-user context) walks users through each step: buy amount → wallet address → trustline check → payment; sell amount → full name → account number → bank. Every step validates, and confirmations gate irreversible actions so a mis-tap never double-orders.

### 3. OCR KYC Onboarding
Users share their phone via Telegram contact, then send ID-card photo front/back. FPT AI Vision extracts the fields, images go to S3, and the user's KYC flag flips. Duplicate-photo guard and processing states keep retries safe.

### 4. Live Rates & Fees
Current USDC/VND and XLM/VND rates (buy + sell) are fetched live from `payment_server`; order amounts are validated against the backend's min/max order limits.

### 5. Signed, Sequenced Order Notifications
`payment_server` POSTs order-state events to `/api/webhooks/payment`. The bot verifies the HMAC signature, then enqueues the update into a per-chat queue so messages always arrive in order — even when webhooks do not. Completed states also clean up stale order messages and return the user home.

### 6. Referral Program
`/start` with a referral username registers the referrer, increments their count, and records the relationship in the `referrals` table.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **MySQL** (the bot mirrors orders and users locally)

### Installation

```bash
npm install
cp .env.example .env
```

Fill in the required credentials inside `.env`:

- **Telegram** — `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET`
- **Payment backend** — `API_PAY` (the `payment_server` URL) and `PARTNER_APP_KEY`
- **Webhook verification** — `WEBHOOK_PUBLIC_KEY` (HMAC secret for payment events)
- **Stellar** — `STELLAR_NETWORK` (public | testnet), `TOKEN_ADDRESS`, `TOKEN_CODE`, `CALLBACK_URL`
- **KYC** — `FPT_API_SERVICE_URL` + `FPT_API_SERVICE_KEY`, and S3 (`SECRET_KEY_ID`, `SECRET_ACCESS_KEY`, `REGION`, `BUCKET`)
- **Database** — `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

Migrations run automatically on startup (`onReady` hook), or manually:

```bash
npm run migrate:latest
```

### Run

```bash
npm run dev              # tsx watch, hot reload
npm run build && npm start   # compiled production server
```

Point Telegram's webhook at `https://<host>/api/telegram/webhook` with your `TELEGRAM_WEBHOOK_SECRET`; point `payment_server` callbacks at `https://<host>/api/webhooks/payment`.

## 💵 Usage / Data Flows

### Buy XLM/USDC (VND → XLM/USDC)

```
User taps "Mua"
   → enter VND amount (validated against min/max)
   → enter Stellar wallet address
   → trustline check on Horizon — QR/web steps offered if missing
   → confirm → paymentService creates deposit order on payment_server
   → show bank transfer (SePay) / gateway payment with unique payment_code
   → payment_server confirms fiat → ORDER state webhook arrives
   → bot updates the order message → COMPLETED → back to main menu
```

### Sell XLM/USDC (XLM/USDC → VND)

```
User taps "Bán"
   → enter amount
   → pick/capture bank details (full name, account number, bank)
   → show Stellar pay URI/QR to deposit XLM/USDC from the user's wallet
   → payment_server sees the incoming token → ORDER state webhook arrives
   → bot shows completed payout summary (net VND, bank account) → main menu
```

## 📡 Endpoints Overview

| Endpoint | Purpose | Auth |
|---|---|---|
| `POST /api/telegram/webhook` | Telegram update stream | `TELEGRAM_WEBHOOK_SECRET` |
| `POST /api/webhooks/payment` | Order-state events from `payment_server` | `X-Timestamp` + `X-Signature` (HMAC) |
| `GET /health` | Liveness probe | — |
| `GET /docs` | Swagger UI | — |

## 🧭 Order Lifecycle

Order states mirror `payment_server` (delivered via webhook):

| State | Code | Meaning |
|---|---|---|
| CREATED | 1 | Awaiting payment |
| PROCESSING | 2 | Payment confirmed, processing |
| COMPLETED | 3 | Finished successfully |
| FAILED | 4 | Failed |
| CANCELLED | 5 | Cancelled / expired |

```
CREATED → PROCESSING → COMPLETED
CREATED → PROCESSING → FAILED
CREATED → CANCELLED   (skipped when the user cancelled it locally)
```

## 🔐 Security

| Surface | Measure |
|---|---|
| Telegram updates | `TELEGRAM_WEBHOOK_SECRET` secret-token check (grammY) |
| Payment webhooks | HMAC-SHA256 over raw body with `X-Timestamp` + `X-Signature` |
| Merchant keys | Held on the server; only `payment_server` sees the `Partner-App-Key` on outbound calls |
| User & payment REST routes | **Intentionally disabled** — the Telegram bot is the only client (see `src/app.ts`) |

## 🐳 Docker

Multi-stage `Dockerfile` (builder → production) plus `docker-compose.yml`:

```bash
docker compose up -d --build
```

- Healthy check at `/health`, logs persisted to `./logs`
- Migrations run in-process on startup
- Secrets injected via `.env`

## 📁 Project Structure

```
src/
├── server.ts               # Entry point + graceful shutdown
├── app.ts                  # Fastify factory, routes, migrations on startup
├── config/                 # App, logger (pino), database (Knex)
├── controllers/            # Webhook + Telegram update handlers
├── routes/                 # Fastify route definitions
├── middleware/             # Global error handling
├── models/                 # Types + bank catalog
├── migrations/             # Knex schema migrations
└── services/
    ├── paymentService.ts   # payment_server client (rates, deposits, withdrawals)
    ├── webhookService.ts   # HMAC verification + event processing
    ├── notificationQueueService.ts # Sequential per-chat delivery
    ├── kycService.ts / fptAiVisionService.ts / s3Service.ts
    ├── referralService.ts / teleUserService.ts / paymentInformationService.ts
    └── telegram/           # grammY bot — handlers, state, keyboards, messages
        ├── handlers/       # menu, buy, sell, kyc, delete, payment, router
        ├── user-state.ts   # State machine
        ├── trustline.ts    # Stellar trustline help
        └── order-tracking.ts  # Order message slots + timers
```

## 🤝 Contributing

Contributions welcome!

1. Fork the repo
2. Create your feature branch
3. Commit and push
4. Open a pull request

## 📄 License

MIT License — see [LICENSE](LICENSE). © 2026 Orbit Labs
