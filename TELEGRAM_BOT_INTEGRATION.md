# Telegram Bot Integration Guide

This document describes the Telegram bot integration for buy/sell USDT operations.

## Overview

The Telegram bot has been integrated into the main application to handle buy/sell USDT operations directly through the existing payment endpoints. The bot provides a user-friendly Vietnamese interface for cryptocurrency transactions.

## Features Implemented

### 1. Buy USDT Flow (Deposit)
- User initiates buy operation via `/start` command
- Bot prompts for USDT amount
- User enters wallet address (BSC/BEP-20)
- Bot calls `/api/v1/payment/deposit` endpoint
- QR code is generated from the `body.qr_code` field in the response
- QR code image is displayed to user for payment
- User scans QR code to complete VND payment

### 2. Sell USDT Flow (Withdrawal)
- User initiates sell operation via bot menu
- Bot prompts for USDT amount
- Bot calls `/api/v1/payment/withdrawal` endpoint
- Recipient wallet address from `pay_data.address` is displayed
- User sends USDT to the displayed address on BSC network

### 3. Webhook Notifications
- When payment status changes, HSPay sends webhook to `/api/webhooks/payment`
- Webhook controller sends Telegram notification to user's `chat_id`
- Notifications include order ID and status updates (Created, Processing, Completed, Failed, Cancelled)

## Configuration

### Environment Variables

Add the following to your `.env` file:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret_here

# Payment Configuration
CHAIN_ID=56
TOKEN_ADDRESS=0x55d398326f99059fF775485246999027B3197955
CALLBACK_URL=https://unfading-commonplacely-daphne.ngrok-free.dev/api/webhooks/payment
```

### Hardcoded Values (as per requirements)
- **Callback URL**: `https://unfading-commonplacely-daphne.ngrok-free.dev/api/webhooks/payment`
- **Chain ID**: `56` (BSC - BNB Smart Chain)
- **Token Address**: `0x55d398326f99059fF775485246999027B3197955` (USDT on BSC)

## API Endpoints

### Telegram Webhook
- **Endpoint**: `POST /api/telegram/webhook`
- **Description**: Receives updates from Telegram
- **Authentication**: Telegram webhook secret (optional)

### Payment Webhook (Existing)
- **Endpoint**: `POST /api/webhooks/payment`
- **Description**: Receives payment status updates from HSPay
- **Authentication**: ED25519 signature verification

## File Structure

```
src/
├── controllers/
│   ├── telegramController.ts      # Handles Telegram webhook updates
│   └── webhookController.ts       # Updated with Telegram notifications
├── services/
│   ├── telegramService.ts         # Main Telegram bot logic
│   ├── paymentService.ts          # Existing payment service
│   └── webhookService.ts          # Existing webhook service
├── routes/
│   └── telegramRoutes.ts          # Telegram webhook route
├── models/
│   └── types.ts                   # Updated with TelegramConfig
└── config/
    └── app.ts                     # Updated with Telegram config
```

## Bot Commands

- `/start` - Start the bot and show main menu
- Main menu buttons:
  - 💰 Mua USDT (Buy USDT)
  - 💸 Bán USDT (Sell USDT)

## User Flow Examples

### Buy USDT Example
1. User: `/start`
2. Bot: Shows welcome message with menu
3. User: Clicks "💰 Mua USDT"
4. Bot: "Vui lòng nhập số lượng USDT muốn mua (VD: 100):"
5. User: `100`
6. Bot: "Vui lòng nhập địa chỉ ví BSC (BEP-20) để nhận USDT:"
7. User: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
8. Bot: Shows order summary with confirmation buttons
9. User: Clicks "✅ Xác nhận"
10. Bot: Displays QR code for VND payment
11. User: Scans QR code and completes payment
12. Bot: Sends notification when order status changes

### Sell USDT Example
1. User: `/start`
2. Bot: Shows welcome message with menu
3. User: Clicks "💸 Bán USDT"
4. Bot: "Vui lòng nhập số lượng USDT muốn bán (VD: 100):"
5. User: `100`
6. Bot: Shows order summary with confirmation buttons
7. User: Clicks "✅ Xác nhận"
8. Bot: Displays recipient wallet address for USDT transfer
9. User: Sends USDT to the displayed address
10. Bot: Sends notification when order status changes

## QR Code Generation

The bot uses the QuickChart.io API to generate QR codes from VietQR strings:
- API: `https://quickchart.io/qr`
- Parameters: `text`, `size=300`, `margin=2`
- Returns: PNG image

## Order Status Notifications

The bot sends notifications for the following order states:
- **Created** (State 1): Order has been created
- **Processing** (State 2): Order is being processed
- **Completed** (State 3): Order completed successfully
- **Failed** (State 4): Order failed
- **Closed/Cancelled** (State 5): Order was cancelled

## Setup Instructions

### 1. Install Dependencies
```bash
npm install grammy
```

### 2. Configure Environment Variables
Update `.env` file with your Telegram bot token and other configuration.

### 3. Set Up Telegram Webhook
Use the Telegram Bot API to set the webhook URL:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/api/telegram/webhook", "secret_token": "<YOUR_TELEGRAM_WEBHOOK_SECRET>"}'

```

### 4. Build and Start
```bash
npm run build
npm start
```

## Testing

### Test Buy Flow
1. Start a chat with your bot on Telegram
2. Send `/start`
3. Click "💰 Mua USDT"
4. Enter amount: `10`
5. Enter wallet: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
6. Confirm order
7. Verify QR code is displayed

### Test Sell Flow
1. Start a chat with your bot on Telegram
2. Send `/start`
3. Click "💸 Bán USDT"
4. Enter amount: `10`
5. Confirm order
6. Verify recipient address is displayed

### Test Webhook Notifications
1. Create an order through the bot
2. Trigger a webhook event (or wait for real payment)
3. Verify notification is sent to Telegram

## Security Considerations

1. **Bot Token**: Keep `TELEGRAM_BOT_TOKEN` secret
2. **Webhook Secret**: Use `TELEGRAM_WEBHOOK_SECRET` to verify webhook requests
3. **Wallet Validation**: Bot validates wallet addresses (0x + 40 hex characters)
4. **KYC Check**: Payment service checks KYC status before processing orders

## Troubleshooting

### Bot Not Responding
- Check if `TELEGRAM_BOT_TOKEN` is correctly set
- Verify webhook is properly configured
- Check application logs for errors

### QR Code Not Displaying
- Verify `body.qr_code` field exists in deposit response
- Check QuickChart.io API availability
- Review application logs for QR generation errors

### Notifications Not Sent
- Verify `chat_id` is stored in orders table
- Check Telegram service logs
- Ensure bot has permission to send messages to user

## Notes

- The bot uses Vietnamese language for all messages
- All amounts are in USDT
- Network is hardcoded to BSC (Chain ID: 56)
- QR codes are generated using external API (QuickChart.io)
- Webhook notifications are sent asynchronously and won't block webhook processing

