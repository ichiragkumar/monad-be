# Backend Migration Notes

## Overview

The backend has been completely refactored to match the new API specification v1. All endpoints now use `/api/v1/` prefix and follow the standardized response format.

## Major Changes

### 1. API Versioning
- All endpoints now use `/api/v1/` prefix
- Old routes (`/api/auth`, `/api/events`, etc.) have been removed
- New routes are organized under `/api/v1/`

### 2. Response Format
- All responses now use standardized format:
  ```json
  {
    "success": true,
    "data": { ... },
    "pagination": { ... } // for paginated endpoints
  }
  ```
- Error responses:
  ```json
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE",
      "message": "Error message",
      "details": { ... }
    }
  }
  ```

### 3. Database Schema Updates

#### New Models:
- `BatchTransaction` - Separate model for batch operations
- `Reward` - Separate model for reward distributions
- `EventParticipant` - Separate model for event participants
- `PaymentLink` - Updated structure with nonce and expiry

#### Updated Models:
- `User` - Added `displayName`, `avatar`, `lastSeenAt`
- `Transaction` - Added `syncStatus`, changed `amount` to String, added `blockTimestamp`
- `Subscription` - Added `onChainId`, changed to use `interval` (seconds), `nextPaymentTime` (unix), `status` enum
- `Event` - Changed to use `vendorAddress` directly, added `participantCount`, `totalDistributed`

#### Removed Models:
- `WhitelistEntry` (replaced by `EventParticipant`)
- `Airdrop` (replaced by `Reward` and `BatchTransaction`)
- `SignedLink` (replaced by `PaymentLink`)

### 4. Authentication
- Changed from JWT token-based to EIP-712 signature verification
- `POST /api/v1/users` - Now requires wallet signature for authentication
- Removed old `/api/auth/register` and `/api/auth/me` endpoints

### 5. New Endpoints

#### Users
- `POST /api/v1/users` - Create/get user with signature
- `GET /api/v1/users/:walletAddress` - Get user profile with stats

#### Transactions
- `GET /api/v1/transactions` - Get paginated transaction history
- `POST /api/v1/transactions` - Create transaction record
- `PATCH /api/v1/transactions/:txHash` - Update transaction status
- `GET /api/v1/transactions/:txHash` - Get transaction by hash
- `GET /api/v1/transactions/recent` - Get recent transactions with sync status

#### Batch Transactions
- `POST /api/v1/batch-transactions` - Create batch transaction
- `GET /api/v1/batch-transactions` - Get user's batch transactions
- `GET /api/v1/batch-transactions/:batchId` - Get batch details

#### Rewards
- `POST /api/v1/rewards` - Create reward distribution
- `GET /api/v1/rewards/event/:eventId` - Get rewards by event

#### Subscriptions
- `POST /api/v1/subscriptions` - Create subscription with onChainId
- `GET /api/v1/subscriptions` - Get user subscriptions
- `PATCH /api/v1/subscriptions/:subscriptionId` - Update subscription status
- `POST /api/v1/subscriptions/:subscriptionId/payments` - Record payment

#### Payment Links
- `POST /api/v1/payment-links` - Generate payment link
- `GET /api/v1/payment-links/:paymentLinkId` - Get link details
- `POST /api/v1/payment-links/:paymentLinkId/execute` - Record execution

#### Events
- `POST /api/v1/events` - Create event
- `GET /api/v1/events` - Get vendor events
- `PATCH /api/v1/events/:eventId` - Update event
- `DELETE /api/v1/events/:eventId` - Delete event
- `POST /api/v1/events/:eventId/participants` - Add participants
- `GET /api/v1/events/:eventId/participants` - Get participants

#### Sync Status
- `GET /api/v1/sync/status` - Get sync status for wallet

### 6. Background Jobs

#### Transaction Sync
- Runs every 30 seconds
- Syncs pending transactions with blockchain
- Updates transaction status and block data
- Updates sync status

#### Subscription Payment Check
- Runs every 5 minutes
- Checks for due subscription payments
- Verifies payments on-chain

### 7. Removed Endpoints

The following old endpoints have been removed:
- `/api/auth/register`
- `/api/auth/me`
- `/api/vendor/event`
- `/api/vendor/:id/dashboard`
- `/api/vendor/:id/whitelist`
- `/api/airdrop`
- `/api/ens/*`
- `/api/balance`
- `/api/token/info`
- `/api/topup`
- `/api/subscription` (old format)
- `/api/link/*` (old format)
- `/api/stats`

## Migration Steps

1. **Run Prisma migrations:**
   ```bash
   npm run prisma:migrate
   # Name it: "migrate_to_v1_api"
   ```

2. **Update frontend:**
   - Update all API calls to use `/api/v1/` prefix
   - Update authentication to use EIP-712 signature
   - Update response handling to use new format

3. **Update environment variables:**
   - No new environment variables required
   - Existing variables still work

4. **Test all endpoints:**
   - Use the new API1.md testing guide
   - Verify all endpoints work correctly

## Breaking Changes

1. **Authentication:** Changed from JWT to EIP-712 signature
2. **Response format:** All responses now wrapped in `{success, data}` format
3. **Amounts:** Now stored as decimal strings instead of BigInt
4. **Transaction types:** Changed enum values
5. **Sync status:** New field on all transactions
6. **API paths:** All paths changed to `/api/v1/*`

## Notes

- Old routes are completely removed - ensure frontend is updated
- Database migration will create new tables and may need data migration for existing records
- Background jobs start automatically when server starts
- Transaction syncing is automatic and doesn't require manual intervention

