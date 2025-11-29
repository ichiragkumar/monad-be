import * as dotenv from "dotenv";

dotenv.config();

export const config = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || "3000"),
    nodeEnv: process.env.NODE_ENV || "development",
    host: process.env.HOST || "0.0.0.0",
    corsOrigin: process.env.CORS_ORIGIN || "*",
    bodyParserLimit: process.env.BODY_PARSER_LIMIT || "10mb",
  },

  // Authentication & Security
  auth: {
    jwtSecret: process.env.JWT_SECRET || "change-me-in-production",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "30d",
    apiKeySecret: process.env.API_KEY_SECRET || "change-me-in-production",
  },

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL || "",
    // Connection pool settings
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || "2"),
      max: parseInt(process.env.DB_POOL_MAX || "10"),
    },
  },

  // Monad Network Configuration
  monad: {
    rpcUrl: process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
    chainId: parseInt(process.env.MONAD_CHAIN_ID || "10143"),
    explorer: process.env.MONAD_TESTNET_EXPLORER || "https://testnet-explorer.monad.xyz",
    // Gas settings
    gasPrice: process.env.MONAD_GAS_PRICE || "1000000000", // 1 gwei
    gasLimit: process.env.MONAD_GAS_LIMIT || "500000",
  },

  // Smart Contract Addresses
  contracts: {
    token: process.env.TOKEN_CONTRACT_ADDRESS || "",
    rewardDistributor: process.env.REWARD_DISTRIBUTOR_ADDRESS || "",
    rewardLinkExecutor: process.env.REWARD_LINK_EXECUTOR_ADDRESS || "",
    subscriptionScheduler: process.env.SUBSCRIPTION_SCHEDULER_ADDRESS || "",
    vendorRegistry: process.env.VENDOR_REGISTRY_ADDRESS || "",
    ensSubdomainRegistrar: process.env.ENS_SUBDOMAIN_REGISTRAR_ADDRESS || "",
    faucet: process.env.FAUCET_CONTRACT_ADDRESS || "",
  },

  // Backend Wallet Configuration
  wallet: {
    privateKey: process.env.BACKEND_WALLET_PRIVATE_KEY || "",
    address: process.env.BACKEND_WALLET_ADDRESS || "",
  },

  // ENS Configuration
  ens: {
    parentDomain: process.env.ENS_PARENT_DOMAIN || "ourapp.eth",
    registryAddress: process.env.ENS_REGISTRY_ADDRESS || "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
    resolverAddress: process.env.ENS_RESOLVER_ADDRESS || "",
    // Subdomain settings
    defaultSubdomainLength: parseInt(process.env.ENS_SUBDOMAIN_LENGTH || "8"),
  },

  // Rate Limiting Configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
    // Separate rate limits for specific endpoints
    strict: {
      windowMs: parseInt(process.env.RATE_LIMIT_STRICT_WINDOW_MS || "60000"), // 1 minute
      maxRequests: parseInt(process.env.RATE_LIMIT_STRICT_MAX || "10"),
    },
  },

  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "5242880"), // 5MB in bytes
    allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES || "text/csv,application/json").split(","),
    csvMaxRows: parseInt(process.env.CSV_MAX_ROWS || "10000"),
  },

  // Subscription Configuration
  subscription: {
    // Default billing period in days
    defaultPeriodDays: parseInt(process.env.SUBSCRIPTION_DEFAULT_PERIOD || "30"),
    // Auto-process enabled (for cron jobs)
    autoProcess: process.env.SUBSCRIPTION_AUTO_PROCESS === "true",
    // Processing schedule (cron format)
    processSchedule: process.env.SUBSCRIPTION_PROCESS_SCHEDULE || "0 0 * * *", // Daily at midnight
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "error" : "debug"),
    format: process.env.LOG_FORMAT || "json",
    enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== "false",
  },

  // Feature Flags
  features: {
    faucetEnabled: process.env.FAUCET_ENABLED !== "false",
    ensEnabled: process.env.ENS_ENABLED !== "false",
    subscriptionsEnabled: process.env.SUBSCRIPTIONS_ENABLED !== "false",
    signedLinksEnabled: process.env.SIGNED_LINKS_ENABLED !== "false",
  },

  // Transaction Configuration
  transactions: {
    // Confirmation timeout in seconds
    confirmationTimeout: parseInt(process.env.TX_CONFIRMATION_TIMEOUT || "300"), // 5 minutes
    // Number of block confirmations required
    requiredConfirmations: parseInt(process.env.TX_REQUIRED_CONFIRMATIONS || "1"),
    // Retry settings
    maxRetries: parseInt(process.env.TX_MAX_RETRIES || "3"),
    retryDelay: parseInt(process.env.TX_RETRY_DELAY || "5000"), // 5 seconds
  },

  // Airdrop Configuration
  airdrop: {
    // Maximum recipients per batch
    maxRecipientsPerBatch: parseInt(process.env.AIRDROP_MAX_RECIPIENTS || "500"),
    // Batch delay between transactions (ms)
    batchDelay: parseInt(process.env.AIRDROP_BATCH_DELAY || "1000"),
  },

  // Metrics Configuration
  metrics: {
    dedupWindowHours: parseInt(process.env.METRICS_DEDUP_WINDOW_HOURS || "1"),
    externalApiUrl: process.env.METRICS_EXTERNAL_API_URL || "https://cca-lite.coinbase.com/metrics",
    externalApiEnabled: process.env.METRICS_EXTERNAL_API_ENABLED !== "false",
  },
};

// Validation for required environment variables
const validateConfig = () => {
  const errors: string[] = [];

  // Database is always required
  if (!config.database.url) {
    errors.push("DATABASE_URL is required");
  }

  // Production-specific validations
  if (config.server.nodeEnv === "production") {
    if (!config.wallet.privateKey) {
      errors.push("BACKEND_WALLET_PRIVATE_KEY is required in production");
    }

    if (config.auth.jwtSecret === "change-me-in-production") {
      errors.push("JWT_SECRET must be changed from default value in production");
    }

    if (config.auth.apiKeySecret === "change-me-in-production") {
      errors.push("API_KEY_SECRET must be changed from default value in production");
    }

    if (config.server.corsOrigin === "*") {
      console.warn("⚠️  WARNING: CORS_ORIGIN is set to '*' in production. Consider restricting to specific origins.");
    }
  }

  // Contract validations (warn if missing in production)
  if (config.server.nodeEnv === "production") {
    const requiredContracts = [
      { key: "token", name: "TOKEN_CONTRACT_ADDRESS" },
      { key: "rewardDistributor", name: "REWARD_DISTRIBUTOR_ADDRESS" },
    ];

    requiredContracts.forEach(({ key, name }) => {
      if (!config.contracts[key as keyof typeof config.contracts]) {
        errors.push(`${name} is required in production`);
      }
    });
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join("\n")}`);
  }
};

// Run validation
validateConfig();

// Export individual config sections for easier access
export const {
  server,
  auth,
  database,
  monad,
  contracts,
  wallet,
  ens,
  rateLimit,
  upload,
  subscription,
  logging,
  features,
  transactions,
  airdrop,
  metrics,
} = config;

