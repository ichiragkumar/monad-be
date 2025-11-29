# Quick Setup Guide

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database running
- Monad testnet access (for contract interactions)

## Initial Setup Steps

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration:
   # - DATABASE_URL (PostgreSQL connection string)
   # - MONAD_RPC_URL (Monad network RPC endpoint)
   # - Contract addresses (after deploying contracts)
   # - BACKEND_WALLET_PRIVATE_KEY (wallet for signing transactions)
   # - JWT_SECRET (generate a secure random string)
   ```

3. **Set up Database:**
   ```bash
   # Generate Prisma Client
   npm run prisma:generate
   
   # Create initial migration
   npm run prisma:migrate
   # Name it: "initial_schema"
   ```

4. **Start Development Server:**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000`

## Testing the API

1. **Health Check:**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Register a User:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "address": "0xYourAddressHere",
       "role": "USER"
     }'
   ```

## Database Schema

The Prisma schema includes:
- Users & Vendors
- Events
- Whitelist Entries
- Transactions
- Airdrops
- Subscriptions
- Signed Links

Run `npm run prisma:studio` to view and edit data in a visual interface.

## Environment Variables Checklist

- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `MONAD_RPC_URL` - Monad network RPC endpoint
- [ ] `MONAD_CHAIN_ID` - Chain ID (10143 for testnet)
- [ ] `TOKEN_CONTRACT_ADDRESS` - Deployed ERC-20 token address
- [ ] `REWARD_DISTRIBUTOR_ADDRESS` - Airdrop contract address
- [ ] `VENDOR_REGISTRY_ADDRESS` - Vendor registry contract address
- [ ] `ENS_SUBDOMAIN_REGISTRAR_ADDRESS` - ENS registrar contract address
- [ ] `BACKEND_WALLET_PRIVATE_KEY` - Private key for backend wallet
- [ ] `BACKEND_WALLET_ADDRESS` - Address of backend wallet
- [ ] `JWT_SECRET` - Secret for signing JWTs
- [ ] `ENS_PARENT_DOMAIN` - Your ENS parent domain (e.g., "ourapp.eth")

## Next Steps

1. Deploy smart contracts to Monad testnet
2. Update contract addresses in `.env`
3. Fund backend wallet with testnet tokens
4. Test API endpoints
5. Integrate with frontend

## Troubleshooting

- **Type errors**: Run `npm install` to ensure all dependencies are installed
- **Database errors**: Verify PostgreSQL is running and DATABASE_URL is correct
- **Contract errors**: Ensure contract addresses are set and backend wallet has permissions
- **Port already in use**: Change `PORT` in `.env` or kill the process using port 3000

