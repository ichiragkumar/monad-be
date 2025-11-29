# Monad Micropayments & Loyalty Rewards Backend

Backend API for a Monad-based micropayments and loyalty rewards platform built with Node.js, Express, TypeScript, and Prisma.

## 🚀 Features

- **User & Vendor Management**: Registration, authentication, and role-based access
- **Token Operations**: Balance queries, transfers, faucet integration
- **Event Management**: Create and manage events for token distribution
- **Whitelist Management**: CSV upload or JSON API for participant whitelisting
- **Batch Airdrops**: Efficient token distribution to multiple recipients
- **ENS Integration**: Subdomain registration and resolution
- **Subscription Management**: Recurring payment handling
- **Signed Links**: EIP-712 signed batch transaction links
- **Analytics**: Platform-wide and vendor-specific statistics

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Access to Monad testnet (or mainnet) RPC endpoint
- Smart contracts deployed on Monad network

## 🛠️ Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   # Create .env file and copy the environment variables section from below
   # Copy and paste the entire .env configuration from the "Environment Variables" section
   touch .env
   # Then paste the configuration below into .env
   ```

3. **Set up database:**
   ```bash
   # Generate Prisma client
   npm run prisma:generate
   
   # Run migrations
   npm run prisma:migrate
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

## 📁 Project Structure

```
be/
├── src/
│   ├── config/          # Configuration files
│   ├── lib/             # Shared libraries (Prisma, Ethers)
│   ├── middleware/      # Express middleware
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic services
│   ├── utils/           # Utility functions
│   └── server.ts        # Main server file
├── prisma/
│   └── schema.prisma    # Database schema
└── package.json
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user/vendor
- `GET /api/auth/me` - Get current user profile

### Events
- `POST /api/vendor/event` - Create event
- `GET /api/vendor/:id/dashboard` - Vendor dashboard
- `GET /api/event/:id` - Get event details
- `GET /api/vendor/events` - List vendor events

### Whitelist
- `POST /api/vendor/:id/whitelist` - Add addresses to whitelist
- `POST /api/vendor/:id/whitelist/upload` - Upload CSV whitelist
- `GET /api/vendor/:id/whitelist` - Get whitelist
- `DELETE /api/vendor/:id/whitelist/:entryId` - Remove entry

### Airdrops
- `POST /api/airdrop` - Execute airdrop (custom amounts)
- `POST /api/airdrop/equal` - Execute airdrop (equal amounts)
- `GET /api/airdrop/:id` - Get airdrop details
- `GET /api/airdrop/event/:eventId` - List event airdrops

### ENS
- `POST /api/ens/claim` - Claim ENS subdomain
- `GET /api/ens/resolve/:name` - Resolve ENS name to address
- `GET /api/ens/reverse/:address` - Reverse resolve address to ENS
- `GET /api/ens/status` - Get current user's ENS status

### Tokens
- `GET /api/balance` - Get token balance
- `GET /api/token/info` - Get token contract info
- `POST /api/topup` - Request tokens from faucet
- `POST /api/transfer` - Log transfer transaction
- `GET /api/transactions` - Get transaction history

### Subscriptions
- `POST /api/subscription` - Create subscription
- `POST /api/subscription/:id/pay` - Process payment
- `DELETE /api/subscription/:id` - Cancel subscription
- `GET /api/subscription` - List user subscriptions

### Signed Links
- `POST /api/link/generate` - Generate signed link
- `GET /api/link/:id` - Get link payload
- `POST /api/link/:id/execute` - Execute signed link

### Analytics
- `GET /api/stats` - Platform statistics
- `GET /api/stats/vendor/:id` - Vendor statistics

### Metrics
- `POST /api/v1/metrics` - Send metrics (with deduplication)

## 🔐 Authentication

Most endpoints require JWT authentication via the `Authorization: Bearer <token>` header. Vendor-only endpoints require the user to have the `VENDOR` role.

## 📝 Environment Variables

Copy and paste the following into your `.env` file:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
HOST=0.0.0.0
CORS_ORIGIN=*

# Authentication & Security
JWT_SECRET=jwt_sceret
JWT_EXPIRES_IN=30d
API_KEY_SECRET=iam-api-secret

# Database (PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/monad_micropayments?schema=public"

# Monad Network Configuration
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
MONAD_CHAIN_ID=10143
MONAD_TESTNET_EXPLORER=https://testnet-explorer.monad.xyz
MONAD_GAS_PRICE=1000000000
MONAD_GAS_LIMIT=500000

# Deployed Contract Addresses (Monad Testnet)
TOKEN_CONTRACT_ADDRESS=0xf076E53383868809E8edb21c8DF4fE2F5b58daB2
REWARD_DISTRIBUTOR_ADDRESS=0xB477629258566cB79CE0033DA883737953cA7E8c
REWARD_LINK_EXECUTOR_ADDRESS=0x8C4d6757aBbe89A451488D78219F574CD518c949
SUBSCRIPTION_SCHEDULER_ADDRESS=0xE119fC309692Fa06f81Fe324b63df6Af32fd394D


ENS_SUBDOMAIN_REGISTRAR_ADDRESS=
VENDOR_REGISTRY_ADDRESS=
FAUCET_CONTRACT_ADDRESS=

# Backend Wallet (for contract interactions - relayer)
BACKEND_WALLET_PRIVATE_KEY=your-backend-wallet-private-key-here
BACKEND_WALLET_ADDRESS=0xFd6F109a1c1AdC68567F0c1066531738b5beD11

# ENS Configuration
ENS_PARENT_DOMAIN=ourapp.eth
ENS_REGISTRY_ADDRESS=0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e
ENS_RESOLVER_ADDRESS=

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_STRICT_WINDOW_MS=60000
RATE_LIMIT_STRICT_MAX=10

# File Upload
MAX_FILE_SIZE=5242880
ALLOWED_MIME_TYPES=text/csv,application/json
CSV_MAX_ROWS=10000

# Subscriptions
SUBSCRIPTION_DEFAULT_PERIOD=30
SUBSCRIPTION_AUTO_PROCESS=false
SUBSCRIPTION_PROCESS_SCHEDULE=0 0 * * *

# Logging
LOG_LEVEL=debug
LOG_FORMAT=json
ENABLE_REQUEST_LOGGING=true

# Feature Flags
FAUCET_ENABLED=true
ENS_ENABLED=false
SUBSCRIPTIONS_ENABLED=true
SIGNED_LINKS_ENABLED=true

# Transactions
TX_CONFIRMATION_TIMEOUT=300
TX_REQUIRED_CONFIRMATIONS=1
TX_MAX_RETRIES=3
TX_RETRY_DELAY=5000

# Airdrops
AIRDROP_MAX_RECIPIENTS=500
AIRDROP_BATCH_DELAY=1000

# Database Pool
DB_POOL_MIN=2
DB_POOL_MAX=10

# Body Parser
BODY_PARSER_LIMIT=10mb
```

### Contract Addresses Reference

| Contract | Address | Status |
|----------|---------|--------|
| XToken | `0xf076E53383868809E8edb21c8DF4fE2F5b58daB2` | ✅ Deployed |
| AirdropHelper | `0xB477629258566cB79CE0033DA883737953cA7E8c` | ✅ Deployed |
| RewardLinkExecutor | `0x8C4d6757aBbe89A451488D78219F574CD518c949` | ✅ Deployed |
| SubscriptionScheduler | `0xE119fC309692Fa06f81Fe324b63df6Af32fd394D` | ✅ Deployed |
| ENSSubdomainRegistrar | - | ⚠️ Not available on Monad Testnet |

**Important Notes:**
- Replace `your-super-secret-jwt-key-change-in-production` with a secure random string
- Replace `your-api-key-secret-for-internal-operations` with a secure random string
- Update `DATABASE_URL` with your PostgreSQL connection string
- Set `BACKEND_WALLET_PRIVATE_KEY` to your backend wallet private key (keep this secure!)
- ENS subdomain registration is disabled (`ENS_ENABLED=false`) as ENS is not available on Monad Testnet yet

## 🧪 Development

```bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run buildc

# Run production build
npm start

# Database tools
npm run prisma:studio    # Open Prisma Studio
npm run prisma:migrate   # Create new migration
npm run prisma:deploy    # Deploy migrations to production
```

## 📊 Database Schema

The Prisma schema includes models for:
- Users & Vendors
- Events
- Whitelist Entries
- Transactions
- Airdrops
- Subscriptions
- Signed Links

See `prisma/schema.prisma` for full schema definition.

## 🔗 Smart Contract Integration

The backend interacts with deployed smart contracts via Ethers.js:
- **XToken** (`0xf076E53383868809E8edb21c8DF4fE2F5b58daB2`): ERC-20 token contract
- **AirdropHelper** (`0xB477629258566cB79CE0033DA883737953cA7E8c`): Batch airdrop functionality
- **RewardLinkExecutor** (`0x8C4d6757aBbe89A451488D78219F574CD518c949`): EIP-712 signed link execution
- **SubscriptionScheduler** (`0xE119fC309692Fa06f81Fe324b63df6Af32fd394D`): Automated subscription payments
- **ENSSubdomainRegistrar**: ENS subdomain minting (not yet available on Monad Testnet)

Contract addresses are pre-configured in the environment variables section above for Monad Testnet.

## ⚠️ Security Notes

- Never commit `.env` file or private keys
- Use strong JWT secrets in production
- Implement additional rate limiting if needed
- Validate all user inputs
- Use HTTPS in production

## 📄 License

MIT

