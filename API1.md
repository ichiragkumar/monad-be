# API Testing Guide

Complete guide for testing all backend APIs with curl commands.

## 📋 Prerequisites

1. PostgreSQL database running
2. Node.js 18+ installed
3. Environment variables configured in `.env`
4. Backend server running

## 🚀 Initialization Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Database
```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate
# Name it: "initial_schema"
```

### 3. Start the Server
```bash
# Development mode (with hot reload)
npm run dev

# Or production mode
npm run build
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

### 4. Verify Server is Running
```bash
curl http://localhost:3000/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-29T10:00:00.000Z",
  "environment": "development"
}
```

---

## 🔐 Authentication APIs

### 1. Register a User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "role": "USER"
  }'
```

**Expected Response:**
```json
{
  "user": {
    "id": "clx1234567890abcdef",
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "ensName": null,
    "role": "USER"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Save the token** from the response for subsequent requests:
```bash
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 2. Register a Vendor

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0xFd6F109a1c1AdC68567F0c1066531738b5beD11",
    "role": "VENDOR",
    "businessName": "Test Coffee Shop",
    "description": "A local coffee shop",
    "website": "https://coffeeshop.example.com"
  }'
```

**Expected Response:**
```json
{
  "user": {
    "id": "clx9876543210fedcba",
    "address": "0xFd6F109a1c1AdC68567F0c1066531738b5beD11",
    "ensName": null,
    "role": "VENDOR"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Save vendor token:**
```bash
export VENDOR_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3. Get Current User Profile

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "id": "clx1234567890abcdef",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "ensName": null,
  "role": "USER",
  "vendorProfile": null,
  "createdAt": "2025-11-29T10:00:00.000Z"
}
```

---

## 🎯 Token & Balance APIs

### 4. Get Token Balance

```bash
curl -X GET "http://localhost:3000/api/balance" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "balance": "1000000000000000000000"
}
```

**Get balance for specific address:**
```bash
curl -X GET "http://localhost:3000/api/balance?address=0xFd6F109a1c1AdC68567F0c1066531738b5beD11" \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Get Token Information

```bash
curl -X GET http://localhost:3000/api/token/info
```

**Expected Response:**
```json
{
  "address": "0xf076E53383868809E8edb21c8DF4fE2F5b58daB2",
  "name": "XToken",
  "symbol": "XTOKEN",
  "decimals": 18,
  "totalSupply": "1000000000000000000000000000"
}
```

### 6. Request Tokens from Faucet (Testnet)

```bash
curl -X POST http://localhost:3000/api/topup \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "message": "Faucet request submitted",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "note": "Tokens will be sent to your address shortly"
}
```

### 7. Get Transaction History

```bash
curl -X GET "http://localhost:3000/api/transactions?limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "transactions": [
    {
      "id": "clx1111111111111111",
      "txHash": "0x1234567890abcdef...",
      "fromAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "toAddress": "0xFd6F109a1c1AdC68567F0c1066531738b5beD11",
      "amount": "1000000000000000000",
      "type": "TRANSFER",
      "status": "CONFIRMED",
      "blockNumber": "12345",
      "createdAt": "2025-11-29T10:00:00.000Z",
      "confirmedAt": "2025-11-29T10:00:01.000Z"
    }
  ],
  "count": 1
}
```

### 8. Log Transfer Transaction

```bash
curl -X POST http://localhost:3000/api/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "toAddress": "0xFd6F109a1c1AdC68567F0c1066531738b5beD11",
    "amount": "1000000000000000000",
    "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  }'
```

**Expected Response:**
```json
{
  "message": "Transfer logged",
  "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "status": "CONFIRMED"
}
```

---

## 📅 Event Management APIs

### 9. Create an Event (Vendor Only)

```bash
curl -X POST http://localhost:3000/api/vendor/event \
  -H "Authorization: Bearer $VENDOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hackathon November 2025",
    "description": "Monthly hackathon event",
    "startDate": "2025-12-01T00:00:00Z",
    "endDate": "2025-12-03T23:59:59Z",
    "tokenBudget": "10000000000000000000000"
  }'
```

**Expected Response:**
```json
{
  "id": "clx2222222222222222",
  "name": "Hackathon November 2025",
  "description": "Monthly hackathon event",
  "status": "DRAFT",
  "organizer": {
    "address": "0xFd6F109a1c1AdC68567F0c1066531738b5beD11",
    "ensName": null
  },
  "tokenBudget": "10000000000000000000000",
  "startDate": "2025-12-01T00:00:00.000Z",
  "endDate": "2025-12-03T23:59:59.000Z",
  "createdAt": "2025-11-29T10:00:00.000Z"
}
```

**Save event ID:**
```bash
export EVENT_ID="clx2222222222222222"
```

### 10. Get Event Details

```bash
curl -X GET "http://localhost:3000/api/event/$EVENT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "id": "clx2222222222222222",
  "name": "Hackathon November 2025",
  "description": "Monthly hackathon event",
  "status": "DRAFT",
  "organizer": {
    "address": "0xFd6F109a1c1AdC68567F0c1066531738b5beD11",
    "ensName": null
  },
  "tokenBudget": "10000000000000000000000",
  "startDate": "2025-12-01T00:00:00.000Z",
  "endDate": "2025-12-03T23:59:59.000Z",
  "whitelistCount": 0,
  "airdropCount": 0,
  "createdAt": "2025-11-29T10:00:00.000Z"
}
```

### 11. Get Vendor Dashboard

```bash
curl -X GET "http://localhost:3000/api/vendor/0xFd6F109a1c1AdC68567F0c1066531738b5beD11/dashboard" \
  -H "Authorization: Bearer $VENDOR_TOKEN"
```

**Expected Response:**
```json
{
  "vendor": {
    "id": "clx9876543210fedcba",
    "businessName": "Test Coffee Shop",
    "description": "A local coffee shop",
    "website": "https://coffeeshop.example.com"
  },
  "tokenBalance": "5000000000000000000000",
  "statistics": {
    "totalEvents": 1,
    "totalAirdrops": 0,
    "totalTokensDistributed": "0"
  },
  "recentEvents": [
    {
      "id": "clx2222222222222222",
      "name": "Hackathon November 2025",
      "status": "DRAFT",
      "whitelistCount": 0,
      "airdropCount": 0,
      "createdAt": "2025-11-29T10:00:00.000Z"
    }
  ]
}
```

### 12. List Vendor Events

```bash
curl -X GET http://localhost:3000/api/vendor/events \
  -H "Authorization: Bearer $VENDOR_TOKEN"
```

**Expected Response:**
```json
{
  "events": [
    {
      "id": "clx2222222222222222",
      "name": "Hackathon November 2025",
      "status": "DRAFT",
      "whitelistCount": 0,
      "airdropCount": 0,
      "createdAt": "2025-11-29T10:00:00.000Z"
    }
  ]
}
```

---

## 📋 Whitelist Management APIs

### 13. Add Addresses to Whitelist (JSON)

```bash
curl -X POST "http://localhost:3000/api/vendor/$EVENT_ID/whitelist" \
  -H "Authorization: Bearer $VENDOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "addresses": [
      "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "0x1234567890123456789012345678901234567890"
    ],
    "amounts": [
      "10000000000000000000",
      "5000000000000000000"
    ]
  }'
```

**Expected Response:**
```json
{
  "message": "Whitelist entries added",
  "added": 2,
  "skipped": 0
}
```

### 14. Upload Whitelist CSV

First, create a CSV file `whitelist.csv`:
```csv
address,amount
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb,10000000000000000000
0x1234567890123456789012345678901234567890,5000000000000000000
```

Then upload it:
```bash
curl -X POST "http://localhost:3000/api/vendor/$EVENT_ID/whitelist/upload" \
  -H "Authorization: Bearer $VENDOR_TOKEN" \
  -F "file=@whitelist.csv"
```

**Expected Response:**
```json
{
  "message": "Whitelist uploaded",
  "added": 2,
  "skipped": 0,
  "total": 2
}
```

### 15. Get Whitelist

```bash
curl -X GET "http://localhost:3000/api/vendor/$EVENT_ID/whitelist" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "eventId": "clx2222222222222222",
  "count": 2,
  "entries": [
    {
      "id": "clx3333333333333333",
      "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "ensName": null,
      "amount": "10000000000000000000",
      "claimed": false,
      "createdAt": "2025-11-29T10:00:00.000Z"
    },
    {
      "id": "clx4444444444444444",
      "address": "0x1234567890123456789012345678901234567890",
      "ensName": null,
      "amount": "5000000000000000000",
      "claimed": false,
      "createdAt": "2025-11-29T10:00:00.000Z"
    }
  ]
}
```

**Save entry ID:**
```bash
export ENTRY_ID="clx3333333333333333"
```

### 16. Remove Whitelist Entry

```bash
curl -X DELETE "http://localhost:3000/api/vendor/$EVENT_ID/whitelist/$ENTRY_ID" \
  -H "Authorization: Bearer $VENDOR_TOKEN"
```

**Expected Response:**
```json
{
  "message": "Whitelist entry removed"
}
```

---

## 🎁 Airdrop APIs

### 17. Execute Airdrop (Custom Amounts)

```bash
curl -X POST http://localhost:3000/api/airdrop \
  -H "Authorization: Bearer $VENDOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "'$EVENT_ID'",
    "recipients": [
      "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "0x1234567890123456789012345678901234567890"
    ],
    "amounts": [
      "10000000000000000000",
      "5000000000000000000"
    ]
  }'
```

**Expected Response:**
```json
{
  "message": "Airdrop initiated",
  "txHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "recipientCount": 2,
  "status": "PENDING"
}
```

**Save airdrop tx hash:**
```bash
export AIRDROP_TX="0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
```

### 18. Execute Airdrop (Equal Amounts)

```bash
curl -X POST http://localhost:3000/api/airdrop/equal \
  -H "Authorization: Bearer $VENDOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "'$EVENT_ID'",
    "recipients": [
      "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "0x1234567890123456789012345678901234567890"
    ],
    "amount": "10000000000000000000"
  }'
```

**Expected Response:**
```json
{
  "message": "Airdrop initiated",
  "txHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "recipientCount": 2,
  "amountPerRecipient": "10000000000000000000",
  "totalAmount": "20000000000000000000",
  "status": "PENDING"
}
```

### 19. Get Airdrop Details

**Save airdrop ID first (from event airdrops list):**
```bash
export AIRDROP_ID="clx5555555555555555"
```

```bash
curl -X GET "http://localhost:3000/api/airdrop/$AIRDROP_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "id": "clx5555555555555555",
  "event": {
    "id": "clx2222222222222222",
    "name": "Hackathon November 2025"
  },
  "vendorAddress": "0xFd6F109a1c1AdC68567F0c1066531738b5beD11",
  "recipientCount": 2,
  "totalAmount": "15000000000000000000",
  "txHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "status": "CONFIRMED",
  "errorMessage": null,
  "createdAt": "2025-11-29T10:00:00.000Z",
  "completedAt": "2025-11-29T10:00:01.000Z"
}
```

### 20. Get Event Airdrops

```bash
curl -X GET "http://localhost:3000/api/airdrop/event/$EVENT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "eventId": "clx2222222222222222",
  "count": 1,
  "airdrops": [
    {
      "id": "clx5555555555555555",
      "recipientCount": 2,
      "totalAmount": "15000000000000000000",
      "txHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "status": "CONFIRMED",
      "createdAt": "2025-11-29T10:00:00.000Z"
    }
  ]
}
```

---

## 🌐 ENS APIs

### 21. Claim ENS Subdomain

```bash
curl -X POST http://localhost:3000/api/ens/claim \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "alice"
  }'
```

**Expected Response:**
```json
{
  "message": "ENS subdomain claimed successfully",
  "ensName": "alice.ourapp.eth",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

**Note:** This will fail if ENS is not enabled on Monad Testnet (see feature flags in .env).

### 22. Get ENS Status

```bash
curl -X GET http://localhost:3000/api/ens/status \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "ensName": "alice.ourapp.eth",
  "hasENS": true
}
```

### 23. Resolve ENS Name to Address

```bash
curl -X GET "http://localhost:3000/api/ens/resolve/alice.ourapp.eth"
```

**Expected Response:**
```json
{
  "name": "alice.ourapp.eth",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

### 24. Reverse Resolve Address to ENS

```bash
curl -X GET "http://localhost:3000/api/ens/reverse/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
```

**Expected Response:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "ensName": "alice.ourapp.eth"
}
```

---

## 💳 Subscription APIs

### 25. Create Subscription

```bash
curl -X POST http://localhost:3000/api/subscription \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorAddress": "0xFd6F109a1c1AdC68567F0c1066531738b5beD11",
    "planName": "Premium Newsletter",
    "amountPerPeriod": "5000000000000000000",
    "periodDays": 30
  }'
```

**Expected Response:**
```json
{
  "id": "clx6666666666666666",
  "planName": "Premium Newsletter",
  "vendorAddress": "0xFd6F109a1c1AdC68567F0c1066531738b5beD11",
  "amountPerPeriod": "5000000000000000000",
  "periodDays": 30,
  "nextBillingDate": "2025-12-29T10:00:00.000Z",
  "isActive": true
}
```

**Save subscription ID:**
```bash
export SUBSCRIPTION_ID="clx6666666666666666"
```

### 26. Process Subscription Payment

```bash
curl -X POST "http://localhost:3000/api/subscription/$SUBSCRIPTION_ID/pay" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "message": "Payment processed",
  "txHash": "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
  "subscriptionId": "clx6666666666666666"
}
```

### 27. Get User Subscriptions

```bash
curl -X GET http://localhost:3000/api/subscription \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "subscriptions": [
    {
      "id": "clx6666666666666666",
      "vendorAddress": "0xFd6F109a1c1AdC68567F0c1066531738b5beD11",
      "planName": "Premium Newsletter",
      "amountPerPeriod": "5000000000000000000",
      "periodDays": 30,
      "isActive": true,
      "nextBillingDate": "2025-12-29T10:00:00.000Z",
      "totalPaid": "5000000000000000000",
      "createdAt": "2025-11-29T10:00:00.000Z",
      "recentPayments": [
        {
          "id": "clx7777777777777777",
          "amount": "5000000000000000000",
          "status": "CONFIRMED",
          "periodStart": "2025-11-29T10:00:00.000Z",
          "periodEnd": "2025-12-29T10:00:00.000Z",
          "txHash": "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
          "confirmedAt": "2025-11-29T10:00:01.000Z"
        }
      ]
    }
  ]
}
```

### 28. Cancel Subscription

```bash
curl -X DELETE "http://localhost:3000/api/subscription/$SUBSCRIPTION_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "message": "Subscription cancelled",
  "subscriptionId": "clx6666666666666666"
}
```

---

## 🔗 Signed Link APIs

### 29. Generate Signed Link

```bash
curl -X POST http://localhost:3000/api/link/generate \
  -H "Authorization: Bearer $VENDOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": [
      {
        "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "amount": "1000000000000000000"
      },
      {
        "address": "0x1234567890123456789012345678901234567890",
        "amount": "2000000000000000000"
      }
    ],
    "expiresAt": "2025-12-31T23:59:59Z"
  }'
```

**Expected Response:**
```json
{
  "linkId": "abc123def456",
  "payload": {
    "recipients": [
      {
        "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "amount": "1000000000000000000"
      },
      {
        "address": "0x1234567890123456789012345678901234567890",
        "amount": "2000000000000000000"
      }
    ],
    "nonce": "1732872600000-xyz789",
    "expiresAt": "2025-12-31T23:59:59Z"
  },
  "signature": "0x1234567890abcdef...",
  "expiresAt": "2025-12-31T23:59:59Z",
  "message": "Signed link generated"
}
```

**Save link ID:**
```bash
export LINK_ID="abc123def456"
```

### 30. Get Signed Link

```bash
curl -X GET "http://localhost:3000/api/link/$LINK_ID"
```

**Expected Response:**
```json
{
  "linkId": "abc123def456",
  "payload": {
    "recipients": [
      {
        "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "amount": "1000000000000000000"
      },
      {
        "address": "0x1234567890123456789012345678901234567890",
        "amount": "2000000000000000000"
      }
    ],
    "nonce": "1732872600000-xyz789",
    "expiresAt": "2025-12-31T23:59:59Z"
  },
  "signature": "0x1234567890abcdef...",
  "recipients": [
    {
      "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "amount": "1000000000000000000"
    },
    {
      "address": "0x1234567890123456789012345678901234567890",
      "amount": "2000000000000000000"
    }
  ],
  "totalAmount": "3000000000000000000",
  "expiresAt": "2025-12-31T23:59:59Z",
  "creatorAddress": "0xFd6F109a1c1AdC68567F0c1066531738b5beD11"
}
```

### 31. Execute Signed Link

```bash
curl -X POST "http://localhost:3000/api/link/$LINK_ID/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "signature": "0x9876543210fedcba..."
  }'
```

**Expected Response:**
```json
{
  "message": "Link executed successfully",
  "linkId": "abc123def456",
  "txHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "recipientCount": 2,
  "totalAmount": "3000000000000000000"
}
```

---

## 📊 Metrics API

### 34. Send Metrics

```bash
curl -X POST http://localhost:3000/api/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": [
      {
        "metric_name": "perf_web_vitals_inp_needs-improvement",
        "page_path": null,
        "value": 1,
        "tags": {
          "authed": "false",
          "platform": "web",
          "is_low_end_device": true,
          "is_low_end_experience": true,
          "page_key": "",
          "save_data": false,
          "service_worker": "supported",
          "is_perf_metric": true,
          "project_name": "base_account_sdk",
          "version_name": "1.0.0"
        },
        "type": "count"
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "processed": 1,
    "stored": 1,
    "skipped": 0
  }
}
```

**Test Duplicate (within 1 hour):**
```bash
# Call same metric again - should be skipped
curl -X POST http://localhost:3000/api/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": [
      {
        "metric_name": "perf_web_vitals_inp_needs-improvement",
        "page_path": null,
        "value": 1,
        "tags": {
          "authed": "false",
          "platform": "web"
        },
        "type": "count"
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "processed": 1,
    "stored": 0,
    "skipped": 1
  }
}
```

**Multiple Metrics:**
```bash
curl -X POST http://localhost:3000/api/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": [
      {
        "metric_name": "metric1",
        "value": 1,
        "tags": {"test": "value1"},
        "type": "count"
      },
      {
        "metric_name": "metric2",
        "value": 2,
        "tags": {"test": "value2"},
        "type": "count"
      },
      {
        "metric_name": "metric1",
        "value": 1,
        "tags": {"test": "value1"},
        "type": "count"
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "processed": 3,
    "stored": 2,
    "skipped": 1
  }
}
```

**Note:** 
- Metrics are checked in database first (within 1 hour window)
- Only new metrics are stored and sent to external API
- External API errors don't fail the request (metrics still stored)

---

## 📊 Analytics APIs

### 32. Get Platform Statistics

```bash
curl -X GET "http://localhost:3000/api/stats?days=30" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "period": {
    "days": 30,
    "startDate": "2025-10-30T10:00:00.000Z",
    "endDate": "2025-11-29T10:00:00.000Z"
  },
  "users": {
    "total": 100,
    "vendors": 10,
    "newUsers": 25
  },
  "transactions": {
    "total": 500,
    "volume": "50000000000000000000000",
    "byType": [
      {
        "type": "TRANSFER",
        "count": 300,
        "volume": "30000000000000000000000"
      },
      {
        "type": "AIRDROP",
        "count": 150,
        "volume": "15000000000000000000000"
      },
      {
        "type": "SUBSCRIPTION",
        "count": 50,
        "volume": "5000000000000000000000"
      }
    ],
    "daily": [
      {
        "date": "2025-11-23",
        "count": 10
      },
      {
        "date": "2025-11-24",
        "count": 15
      },
      {
        "date": "2025-11-25",
        "count": 20
      },
      {
        "date": "2025-11-26",
        "count": 18
      },
      {
        "date": "2025-11-27",
        "count": 22
      },
      {
        "date": "2025-11-28",
        "count": 25
      },
      {
        "date": "2025-11-29",
        "count": 30
      }
    ]
  },
  "events": {
    "total": 50,
    "active": 5
  },
  "airdrops": {
    "total": 100,
    "totalVolume": "100000000000000000000000",
    "totalRecipients": 5000
  }
}
```

### 33. Get Vendor Statistics

```bash
curl -X GET "http://localhost:3000/api/stats/vendor/0xFd6F109a1c1AdC68567F0c1066531738b5beD11" \
  -H "Authorization: Bearer $VENDOR_TOKEN"
```

**Expected Response:**
```json
{
  "vendor": {
    "address": "0xFd6F109a1c1AdC68567F0c1066531738b5beD11",
    "businessName": "Test Coffee Shop"
  },
  "events": {
    "total": 10,
    "active": 2
  },
  "airdrops": {
    "total": 25,
    "totalVolume": "50000000000000000000000",
    "totalRecipients": 500,
    "recent": [
      {
        "id": "clx5555555555555555",
        "event": {
          "id": "clx2222222222222222",
          "name": "Hackathon November 2025"
        },
        "recipientCount": 2,
        "totalAmount": "15000000000000000000",
        "status": "CONFIRMED",
        "createdAt": "2025-11-29T10:00:00.000Z"
      }
    ]
  }
}
```

---

## 🔧 Testing Tips

### Set Environment Variables for Easy Testing

```bash
# Set these at the start of your testing session
export BASE_URL="http://localhost:3000"
export TOKEN="your-user-token-here"
export VENDOR_TOKEN="your-vendor-token-here"
export EVENT_ID="your-event-id-here"
export SUBSCRIPTION_ID="your-subscription-id-here"
```

Then use in curl commands:
```bash
curl -X GET "$BASE_URL/api/auth/me" -H "Authorization: Bearer $TOKEN"
```

### Common Error Responses

**401 Unauthorized:**
```json
{
  "error": "Authentication required"
}
```

**403 Forbidden:**
```json
{
  "error": "Vendor access required"
}
```

**404 Not Found:**
```json
{
  "error": "Not found",
  "message": "Route GET /api/invalid not found"
}
```

**400 Bad Request:**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": ["address"],
      "message": "Invalid Ethereum address"
    }
  ]
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error",
  "message": "Something went wrong"
}
```

---

## 🎯 Complete Testing Flow Example

Here's a complete flow to test the entire system:

```bash
# 1. Check server health
curl http://localhost:3000/health

# 2. Register a user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", "role": "USER"}' \
  | jq -r '.token' > user_token.txt

# 3. Register a vendor
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"address": "0xFd6F109a1c1AdC68567F0c1066531738b5beD11", "role": "VENDOR", "businessName": "Test Shop"}' \
  | jq -r '.token' > vendor_token.txt

# 4. Get token balance
curl -X GET "http://localhost:3000/api/balance" \
  -H "Authorization: Bearer $(cat user_token.txt)"

# 5. Create an event (as vendor)
EVENT_ID=$(curl -X POST http://localhost:3000/api/vendor/event \
  -H "Authorization: Bearer $(cat vendor_token.txt)" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Event", "description": "Test"}' \
  | jq -r '.id')

# 6. Add whitelist
curl -X POST "http://localhost:3000/api/vendor/$EVENT_ID/whitelist" \
  -H "Authorization: Bearer $(cat vendor_token.txt)" \
  -H "Content-Type: application/json" \
  -d '{"addresses": ["0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"]}'

# 7. Execute airdrop
curl -X POST http://localhost:3000/api/airdrop/equal \
  -H "Authorization: Bearer $(cat vendor_token.txt)" \
  -H "Content-Type: application/json" \
  -d "{\"eventId\": \"$EVENT_ID\", \"recipients\": [\"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb\"], \"amount\": \"1000000000000000000\"}"

# 8. Check balance again
curl -X GET "http://localhost:3000/api/balance" \
  -H "Authorization: Bearer $(cat user_token.txt)"
```

---

## 📝 Notes

- All amounts are in wei (1 token = 10^18 wei)
- All timestamps are in ISO 8601 format
- Token expires after 30 days by default
- Some endpoints require vendor role (check the API docs)
- ENS features may not work on Monad Testnet (check feature flags)
- Transaction hashes are required for transfer logging (get from blockchain)

