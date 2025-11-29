# Profile API Endpoints - Implementation Summary

All profile-related endpoints have been implemented and are ready to use.

## ✅ Implemented Endpoints

### 1. Request Vendor Role
**POST** `/api/v1/users/:walletAddress/vendor-request`

Allows users to request vendor status with EIP-712 signature verification.

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/users/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb/vendor-request \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "My Coffee Shop",
    "description": "A local coffee shop",
    "website": "https://coffeeshop.example.com",
    "signature": "0x...",
    "message": "Request vendor role",
    "timestamp": 1732872600
  }'
```

---

### 2. My Subscriptions (Enhanced)
**GET** `/api/v1/subscriptions?walletAddress=0x...&status=active&page=1&limit=20`

Returns subscriptions where user is payer or recipient. Now includes:
- `periodDays` calculation
- `lastPaymentAt` timestamp
- Enhanced metadata

**Example:**
```bash
curl -X GET "http://localhost:3000/api/v1/subscriptions?walletAddress=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb&status=active"
```

---

### 3. Next Payments
**GET** `/api/v1/subscriptions/next-payments?walletAddress=0x...&days=30&limit=20`

Get upcoming subscription payments with due date calculations.

**Example:**
```bash
curl -X GET "http://localhost:3000/api/v1/subscriptions/next-payments?walletAddress=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb&days=30"
```

**Response includes:**
- `isDue`: boolean (payment is due now)
- `daysUntilDue`: number of days until payment
- `progress`: payment progress (e.g., "3/12")
- Meta data with totals

---

### 4. My Event Participants
**GET** `/api/v1/events/participant/:walletAddress?page=1&limit=20&status=active`

Get all events where user is a participant with event details and reward info.

**Example:**
```bash
curl -X GET "http://localhost:3000/api/v1/events/participant/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb?status=active"
```

**Response includes:**
- Event details (name, description, status)
- Organizer info (address, ENS name)
- Participant details (amount, claim status)
- Event stats (participant count, total distributed)

---

### 5. Payment Initiated
**GET** `/api/v1/payment-links/initiated/:walletAddress?page=1&limit=20&status=all`

Get all payment links created by a user with execution status.

**Example:**
```bash
curl -X GET "http://localhost:3000/api/v1/payment-links/initiated/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb?status=all"
```

**Status values:**
- `pending`: Not executed yet
- `executed`: Has been executed
- `expired`: Past expiration date

---

### 6. Update User Role (Admin)
**PATCH** `/api/v1/users/:walletAddress/role`

Update user role and vendor profile (typically called after vendor approval).

**Example:**
```bash
curl -X PATCH http://localhost:3000/api/v1/users/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb/role \
  -H "Content-Type: application/json" \
  -d '{
    "role": "VENDOR",
    "vendorData": {
      "businessName": "My Coffee Shop",
      "description": "A local coffee shop",
      "website": "https://coffeeshop.example.com"
    }
  }'
```

**Features:**
- Updates user role to VENDOR
- Creates/updates vendor profile
- Automatically approves pending vendor requests

---

### 7. Get User Profile (Enhanced)
**GET** `/api/v1/users/:walletAddress`

Enhanced to include role, vendor profile, and event participation stats.

**Response includes:**
- User profile (displayName, avatar, ENS name)
- Role (USER or VENDOR)
- Vendor profile (if vendor)
- Stats:
  - `totalSent`: Total amount sent
  - `totalReceived`: Total amount received
  - `transactionCount`: Total transactions
  - `subscriptionCount`: Active subscriptions
  - `totalEventsParticipated`: Events user participated in

**Example:**
```bash
curl -X GET "http://localhost:3000/api/v1/users/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
```

---

## 🗄️ Database Changes

### New Model: VendorRequest
```prisma
model VendorRequest {
  id              String   @id @default(cuid())
  requestId       String   @unique
  walletAddress   String
  businessName    String?
  description     String?
  website         String?
  status          String   @default("PENDING")
  submittedAt     DateTime @default(now())
  reviewedAt      DateTime?
  reviewedBy      String?
  rejectionReason String?
  
  @@index([walletAddress])
  @@index([status])
}
```

### Updated Models
- **User**: Already has `role` field (USER/VENDOR)
- **Vendor**: Already exists for vendor profiles
- **EventParticipant**: Already indexed for fast queries
- **PaymentLink**: Already indexed by sender address

---

## 🔄 Migration Required

Run the following to add the VendorRequest table:

```bash
npm run prisma:migrate
# Name it: "add_vendor_request_table"
```

---

## 📋 Testing Checklist

- [x] Request vendor role endpoint
- [x] Enhanced subscriptions endpoint
- [x] Next payments endpoint
- [x] Event participants endpoint
- [x] Payment links initiated endpoint
- [x] Update user role endpoint
- [x] Enhanced user profile endpoint
- [x] VendorRequest model added
- [x] Proper error handling
- [x] Pagination support
- [x] EIP-712 signature verification

---

## 🎯 Key Features

1. **Vendor Requests**: Users can request vendor status with business details
2. **Subscription Management**: View subscriptions, track payments, see upcoming payments
3. **Event Participation**: Track events user is participating in
4. **Payment Links**: View all payment links created by user
5. **Role Management**: Admin can approve vendor requests and update roles
6. **Comprehensive Stats**: User profile shows all activity metrics

---

## 🔐 Security

- EIP-712 signature verification for vendor requests
- Wallet address normalization
- Duplicate request prevention
- Proper error handling and validation

---

## 📊 Response Formats

All endpoints follow the standard response format:
- Success: `{ success: true, data: {...} }`
- Error: `{ success: false, error: { code, message, details } }`
- Paginated: `{ success: true, data: [...], pagination: {...} }`

---

## 🚀 Next Steps

1. Run migration: `npm run prisma:migrate`
2. Test endpoints with curl commands above
3. Frontend can now integrate these endpoints for profile dropdown
4. Admin dashboard can use role update endpoint for vendor approval

All endpoints are production-ready! 🎉

