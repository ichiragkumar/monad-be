# Subscriptions Feature - Complete Guide

## 🎯 What Are Subscriptions?

Subscriptions enable **automated recurring payments** on the Monad blockchain. Think of it like a Netflix subscription, but using tokens on-chain. Users can set up automatic payments that execute at regular intervals (daily, weekly, monthly, etc.) without manual intervention.

---

## 💡 Real-World Use Cases

### 1. **Content Creator Subscriptions**
- User subscribes to a newsletter for **$2/month**
- Every month, tokens automatically transfer from subscriber to creator
- No need to manually send payment each month

### 2. **Premium Access Subscriptions**
- Subscribe to a premium Discord server for **5 tokens/month**
- Access granted automatically as long as subscription is active
- Payments execute every month on the same date

### 3. **Micro-Subscriptions**
- Subscribe to a podcast for **$0.50/week**
- Weekly payments are automated
- Very low fees on Monad make this practical (vs Ethereum where fees would be prohibitive)

### 4. **SaaS Service Subscriptions**
- Monthly software subscription for **10 tokens/month**
- Automatic billing on the 1st of each month
- Transparent on-chain payment history

---

## 🔄 How It Works

### Step-by-Step Flow

1. **Subscription Creation**
   - User creates subscription on-chain via smart contract
   - Backend receives notification and creates database record
   - Subscription is now **ACTIVE**

2. **Payment Schedule**
   - System tracks `nextPaymentTime` (Unix timestamp)
   - Background job checks every 5 minutes for due payments
   - When `nextPaymentTime <= now`, payment is due

3. **Payment Execution**
   - Smart contract automatically transfers tokens from payer to recipient
   - Backend records payment in database
   - Updates `nextPaymentTime` to next billing cycle
   - Increments `paidCount`

4. **Ongoing Cycle**
   - Process repeats at each interval
   - Continues until:
     - Subscription is cancelled
     - `totalPayments` limit is reached (if set)
     - Payer runs out of funds

---

## 📊 What Happens When You Create a Subscription

### Backend Actions

1. **Database Record Created**
   ```json
   {
     "subscriptionId": "uuid",
     "onChainId": "123", // ID from smart contract
     "payer": "0x...", // Who pays
     "recipient": "0x...", // Who receives
     "amount": "100.0", // Tokens per period
     "interval": 2592000, // 30 days in seconds
     "nextPaymentTime": 1234567890, // Unix timestamp
     "status": "active"
   }
   ```

2. **Transaction Recorded**
   - Creates a transaction record marking subscription creation
   - Links to the subscription for tracking

3. **Users Created** (if they don't exist)
   - Automatically creates user records for payer and recipient
   - Ensures both parties are in the system

---

## 🔧 Subscription Lifecycle

### Statuses

- **ACTIVE**: Subscription is active and will process payments
- **PAUSED**: Temporarily paused (payments won't execute)
- **CANCELLED**: Subscription terminated (no more payments)

### Key Fields

| Field | Description | Example |
|-------|-------------|---------|
| `amount` | Tokens paid per period | "100.0" |
| `interval` | Time between payments (seconds) | 2592000 (30 days) |
| `nextPaymentTime` | When next payment is due (Unix timestamp) | 1732872600 |
| `totalPayments` | Max payments (0 = unlimited) | 12 |
| `paidCount` | Number of payments already made | 3 |

---

## 🔄 Automatic Payment Processing

### Background Job

The system runs a background job every **5 minutes** that:

1. Finds all active subscriptions where `nextPaymentTime <= now`
2. Checks if payment was executed on-chain
3. Records the payment in the database
4. Updates `nextPaymentTime` for the next cycle
5. Creates transaction records

### Payment Record

Each payment creates:
- **SubscriptionPayment record**: Links payment to subscription
- **Transaction record**: Shows up in transaction history
- **Metadata**: Includes subscription ID and payment number

---

## 📱 What You Can Do

### As a Subscriber (Payer)

✅ **View Your Subscriptions**
```bash
GET /api/v1/subscriptions?walletAddress=0x...
```

✅ **See Payment History**
- Every payment is recorded with transaction hash
- View when payments were made
- Track total amount paid

✅ **Cancel Subscription**
```bash
PATCH /api/v1/subscriptions/:id
{
  "status": "cancelled"
}
```

### As a Vendor/Content Creator (Recipient)

✅ **See All Subscriptions to You**
```bash
GET /api/v1/subscriptions?walletAddress=0x...&type=active
```

✅ **Track Revenue**
- See all active subscribers
- View payment history
- Calculate total subscription revenue

✅ **Pause/Resume Subscriptions**
- Pause if you need to stop service temporarily
- Resume when ready

---

## 💰 Payment Flow Example

### Scenario: Monthly Newsletter Subscription

**Day 1 - Subscription Created**
- User subscribes for **10 tokens/month**
- `nextPaymentTime` = Jan 1, 2025 00:00
- Status: **ACTIVE**

**Jan 1, 2025 - First Payment**
- Background job detects payment is due
- Smart contract transfers 10 tokens from user to creator
- `paidCount` = 1
- `nextPaymentTime` = Feb 1, 2025 00:00
- Payment record created

**Feb 1, 2025 - Second Payment**
- Background job detects payment is due
- Smart contract transfers 10 tokens
- `paidCount` = 2
- `nextPaymentTime` = Mar 1, 2025 00:00

**Continues monthly until cancelled or limit reached**

---

## 🎛️ Subscription Types

### 1. Unlimited Subscriptions
```json
{
  "totalPayments": 0  // 0 means unlimited
}
```
- Continues indefinitely until cancelled
- Perfect for ongoing services

### 2. Limited Subscriptions
```json
{
  "totalPayments": 12  // Stops after 12 payments
}
```
- Automatically stops after X payments
- Perfect for yearly memberships or prepaid plans

### 3. Flexible Intervals
- **Daily**: `interval: 86400` (1 day)
- **Weekly**: `interval: 604800` (7 days)
- **Monthly**: `interval: 2592000` (30 days)
- **Custom**: Any interval in seconds

---

## 📈 Benefits of On-Chain Subscriptions

### 1. **Transparency**
- All payments are visible on blockchain
- No hidden fees or surprises
- Complete payment history

### 2. **Low Fees** (on Monad)
- Traditional payment processors: $0.30 + 3% fee
- Monad: ~$0.0001 per transaction
- Makes micro-subscriptions ($0.50/week) viable

### 3. **No Chargebacks**
- Blockchain payments are final
- Vendors don't risk payment reversals

### 4. **Programmable**
- Smart contracts handle automation
- Can add complex logic (trial periods, discounts, etc.)

### 5. **Global**
- Works for anyone with a wallet
- No geographic restrictions
- No bank account required

---

## 🔐 Security & Trust

### For Subscribers
- **Control**: You control when to cancel
- **Transparency**: All payments are visible on-chain
- **No Auto-Debit Surprises**: You can always see what's being charged

### For Vendors
- **Reliable Payments**: Automated execution via smart contract
- **Reduced Fraud**: Blockchain payments are irreversible
- **Lower Costs**: No payment processor fees

---

## 🚨 Important Notes

1. **Payment Execution**
   - Payments execute automatically via smart contract
   - Backend tracks and records payments
   - If smart contract fails (insufficient balance), payment is marked as failed

2. **Dedicated Subscription Contract**
   - Uses `SubscriptionScheduler` smart contract (deployed at `0xE119fC309692Fa06f81Fe324b63df6Af32fd394D`)
   - Handles automated payment execution
   - More efficient than manual recurring transfers

3. **On-Chain vs Off-Chain**
   - Subscription is created **on-chain** (smart contract)
   - Backend **tracks** the subscription (database)
   - Payments execute **on-chain** (blockchain)

4. **Cancellation**
   - User cancels on-chain via smart contract
   - Backend updates status when notified
   - No more payments execute after cancellation

---

## 📊 Example API Responses

### Get Subscriptions
```json
{
  "success": true,
  "data": {
    "subscriptions": [
      {
        "subscriptionId": "uuid",
        "onChainId": "123",
        "payer": "0x...",
        "recipient": "0x...",
        "amount": "100.0",
        "interval": "2592000",
        "nextPaymentTime": "1732872600",
        "totalPayments": 12,
        "paidCount": 3,
        "status": "active",
        "createdAt": "2025-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5
    }
  }
}
```

### Payment Recorded
```json
{
  "success": true,
  "data": {
    "paymentId": "uuid",
    "txHash": "0x...",
    "amount": "100.0",
    "paymentNumber": 4,
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

---

## 🎯 Summary

**Subscriptions enable automated, recurring micropayments on Monad blockchain:**

✅ **Automatic**: Payments execute automatically at scheduled intervals  
✅ **Low Cost**: Monad's low fees make micro-subscriptions viable  
✅ **Transparent**: All payments are on-chain and visible  
✅ **Flexible**: Support unlimited or limited subscriptions  
✅ **Global**: Works for anyone with a crypto wallet  
✅ **Trustless**: Smart contracts handle execution automatically  

**Perfect for:**
- Content creators (newsletters, premium content)
- SaaS services (monthly subscriptions)
- Community access (Discord, premium groups)
- Micro-services (weekly/daily small payments)

---

## 🚀 Next Steps

1. **Create subscription** via smart contract on frontend
2. **Backend tracks it** automatically via API
3. **Payments execute** automatically via smart contract
4. **Backend records** each payment in database
5. **View history** via API endpoints

**The subscription feature automates the entire payment cycle, making recurring revenue streams easy for creators and vendors!** 🎉

