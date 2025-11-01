# Telegram Bot Setup Guide

This guide will walk you through setting up and testing your Telegram bot integration for USDT buy/sell operations.

## ✅ Step 1: Environment Configuration (COMPLETED)

Your `.env` file has been updated with the following configuration:

```env
TELEGRAM_BOT_TOKEN=8005899166:AAH0HPXDX53HdepT3Li5vznyw70CulsrmhQ
TELEGRAM_WEBHOOK_SECRET=tg_webhook_secret_usdt247_2024
CHAIN_ID=56
TOKEN_ADDRESS=0x55d398326f99059fF775485246999027B3197955
CALLBACK_URL=https://api-tele.usdt247.shop/api/webhooks/payment
```

**Note**: The callback URL has been updated to use your production domain `api-tele.usdt247.shop`.

---

## 📋 Step 2: Prerequisites Check

Before starting, ensure you have:

1. **Node.js v24.7.0** installed (you already have this)
2. **MySQL database** running and accessible
3. **Database migrations** completed
4. **SSL certificate** configured for `api-tele.usdt247.shop` (required for Telegram webhooks)
5. **Port 8001** accessible from the internet

### Verify Prerequisites

```bash
# Check Node.js version
node --version
# Should output: v24.7.0

# Check npm version
npm --version
# Should output: 11.5.1 or similar

# Check if MySQL is running
mysql -u root -p1111 -e "SELECT 1;"

# Check if database exists
mysql -u root -p1111 -e "USE usdt247; SHOW TABLES;"
```

---

## 🔨 Step 3: Build the Application

```bash
# Install dependencies (if not already done)
npm install

# Build the TypeScript code
npm run build
```

**Expected output**: Build should complete without errors.

---

## 🚀 Step 4: Start the Application

### Option A: Production Mode (Recommended)

```bash
# Start the application
npm start
```

### Option B: Development Mode (with auto-reload)

```bash
# Start in development mode
npm run dev
```

**Expected output**:
```
Server listening at http://0.0.0.0:8001
Database connection successful
Telegram bot initialized
```

**Keep this terminal running** - the application needs to be running for the next steps.

---

## 🔗 Step 5: Set Up Telegram Webhook

Open a **new terminal** and run the following command to configure Telegram to send updates to your application:

```bash
curl -X POST "https://api.telegram.org/bot8005899166:AAH0HPXDX53HdepT3Li5vznyw70CulsrmhQ/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api-tele.usdt247.shop/api/telegram/webhook",
    "allowed_updates": ["message", "callback_query"],
    "drop_pending_updates": true
  }'
```

**Expected response**:
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

### Verify Webhook Configuration

```bash
curl "https://api.telegram.org/bot8005899166:AAH0HPXDX53HdepT3Li5vznyw70CulsrmhQ/getWebhookInfo"
```

**Expected response**:
```json
{
  "ok": true,
  "result": {
    "url": "https://api-tele.usdt247.shop/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "allowed_updates": ["message", "callback_query"]
  }
}
```

---

## 🧪 Step 6: Test the Bot

### 6.1 Find Your Bot on Telegram

1. Open Telegram app on your phone or desktop
2. Search for your bot using the bot username (you can find it with this command):

```bash
curl "https://api.telegram.org/bot8005899166:AAH0HPXDX53HdepT3Li5vznyw70CulsrmhQ/getMe"
```

3. Start a chat with your bot

### 6.2 Test Basic Functionality

**Test 1: Start Command**

1. Send `/start` to your bot
2. **Expected**: Bot responds with welcome message and menu buttons:
   - 💰 Mua USDT (Buy USDT)
   - 💸 Bán USDT (Sell USDT)

**Test 2: Menu Navigation**

1. Click "💰 Mua USDT"
2. **Expected**: Bot asks "Vui lòng nhập số lượng USDT muốn mua (VD: 100):"

3. Click "🔙 Quay lại" (if available)
4. **Expected**: Bot returns to main menu

---

## 🛒 Step 7: Test Buy USDT Flow (Complete Transaction)

### Prerequisites for Buy Flow
- User must have KYC completed in the database
- User's `chat_id` must be registered in `tele_users` table

### Step-by-Step Buy Test

**Step 1**: Send `/start` to bot

**Step 2**: Click "💰 Mua USDT"

**Step 3**: Enter amount (e.g., `10`)
- **Expected**: Bot asks for wallet address

**Step 4**: Enter BSC wallet address (e.g., `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`)
- **Expected**: Bot shows order summary with:
  - Amount: 10 USDT
  - Wallet: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
  - Buttons: ✅ Xác nhận | ❌ Hủy

**Step 5**: Click "✅ Xác nhận"
- **Expected**: Bot displays:
  - QR code image (for VietQR payment)
  - Order ID
  - Amount to pay in VND
  - Payment instructions

**Step 6**: Scan QR code with banking app and complete payment

**Step 7**: Wait for webhook notification
- **Expected**: Bot sends notification when order status changes:
  - "Đơn hàng [ORDER_ID] đã được cập nhật: Processing"
  - "Đơn hàng [ORDER_ID] đã được cập nhật: Completed"

---

## 💸 Step 8: Test Sell USDT Flow (Complete Transaction)

### Step-by-Step Sell Test

**Step 1**: Send `/start` to bot

**Step 2**: Click "💸 Bán USDT"

**Step 3**: Enter amount (e.g., `10`)
- **Expected**: Bot shows order summary with:
  - Amount: 10 USDT
  - Buttons: ✅ Xác nhận | ❌ Hủy

**Step 4**: Click "✅ Xác nhận"
- **Expected**: Bot displays:
  - Recipient wallet address (BSC/BEP-20)
  - Network: BSC (BNB Smart Chain)
  - Token: USDT (BEP-20)
  - Instructions to send USDT

**Step 5**: Send USDT to the displayed address using your wallet

**Step 6**: Wait for webhook notification
- **Expected**: Bot sends notification when order status changes

---

## 🔍 Step 9: Monitor and Debug

### Check Application Logs

```bash
# If running with npm start, logs will appear in the terminal
# Look for:
# - "Received Telegram webhook update"
# - "Processing buy/sell request"
# - "Order created successfully"
# - "Telegram notification sent"
```

### Check Database

```bash
# Connect to MySQL
mysql -u root -p1111 usdt247

# Check recent orders
SELECT id, chat_id, order_type, amount, state, created_at 
FROM orders 
ORDER BY created_at DESC 
LIMIT 5;

# Check tele_users
SELECT * FROM tele_users;
```

### Common Issues and Solutions

#### Issue 1: Bot Not Responding
**Symptoms**: No response when sending `/start`

**Solutions**:
1. Check if application is running: `curl http://localhost:8001/health`
2. Verify webhook is set: Run the getWebhookInfo command from Step 5
3. Check application logs for errors
4. Ensure SSL certificate is valid for `api-tele.usdt247.shop`

#### Issue 2: "User not found" Error
**Symptoms**: Bot responds with error about user not found

**Solutions**:
1. Register user in database:
```sql
INSERT INTO tele_users (chat_id, username, first_name, is_kyc, created_at, updated_at)
VALUES (YOUR_CHAT_ID, 'your_username', 'Your Name', 1, NOW(), NOW());
```

2. Find your chat_id by checking application logs when you send `/start`

#### Issue 3: QR Code Not Displaying
**Symptoms**: Order created but no QR code shown

**Solutions**:
1. Check if `body.qr_code` exists in order response
2. Verify QuickChart.io API is accessible: `curl https://quickchart.io/qr?text=test`
3. Check application logs for QR generation errors

#### Issue 4: Webhook Notifications Not Received
**Symptoms**: Order created but no status updates

**Solutions**:
1. Verify webhook endpoint is accessible: `curl https://api-tele.usdt247.shop/api/webhooks/payment`
2. Check `WEBHOOK_PUBLIC_KEY` is correctly set in `.env`
3. Verify `chat_id` is stored in orders table
4. Check application logs for webhook processing errors

---

## 📊 Step 10: Verify Complete Setup

Run this checklist to ensure everything is working:

- [ ] Application starts without errors
- [ ] Telegram webhook is configured (getWebhookInfo returns correct URL)
- [ ] Bot responds to `/start` command
- [ ] Main menu buttons are displayed
- [ ] Buy flow: Can enter amount and wallet address
- [ ] Buy flow: QR code is displayed after confirmation
- [ ] Sell flow: Can enter amount
- [ ] Sell flow: Recipient address is displayed after confirmation
- [ ] Webhook notifications are received when order status changes
- [ ] Orders are saved to database with correct `chat_id`

---

## 🎯 Quick Reference Commands

### Start Application
```bash
npm start
```

### Set Telegram Webhook
```bash
curl -X POST "https://api.telegram.org/bot8005899166:AAH0HPXDX53HdepT3Li5vznyw70CulsrmhQ/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://api-tele.usdt247.shop/api/telegram/webhook"}'
```

### Check Webhook Status
```bash
curl "https://api.telegram.org/bot8005899166:AAH0HPXDX53HdepT3Li5vznyw70CulsrmhQ/getWebhookInfo"
```

### Delete Webhook (if needed)
```bash
curl -X POST "https://api.telegram.org/bot8005899166:AAH0HPXDX53HdepT3Li5vznyw70CulsrmhQ/deleteWebhook"
```

### Get Bot Info
```bash
curl "https://api.telegram.org/bot8005899166:AAH0HPXDX53HdepT3Li5vznyw70CulsrmhQ/getMe"
```

---

## 🔐 Security Notes

1. **Never commit `.env` file** to version control
2. **Keep bot token secret** - it's like a password
3. **Use HTTPS only** - Telegram requires SSL for webhooks
4. **Validate webhook signature** - already implemented in the code
5. **Implement rate limiting** - consider adding rate limits for production

---

## 📞 Support

If you encounter issues:

1. Check application logs
2. Review `TELEGRAM_BOT_INTEGRATION.md` for detailed documentation
3. Verify all environment variables are correctly set
4. Ensure database migrations are up to date
5. Test webhook endpoint accessibility from external network

---

## ✨ Next Steps After Setup

Once the bot is working:

1. **Test with real transactions** (small amounts first)
2. **Monitor webhook delivery** and response times
3. **Set up monitoring/alerting** for production
4. **Configure backup webhook URL** (optional)
5. **Implement user feedback collection**
6. **Add analytics tracking** for user interactions

Good luck! 🚀

