import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "@/config/env";
import { errorHandler, notFoundHandler } from "@/middleware/error.middleware";
import { initializeBackgroundJobs } from "@/services/cron.service";

// V1 API Routes
import usersRoutes from "@/routes/v1/users.routes";
import transactionsRoutes from "@/routes/v1/transactions.routes";
import batchTransactionsRoutes from "@/routes/v1/batch-transactions.routes";
import rewardsRoutes from "@/routes/v1/rewards.routes";
import subscriptionsRoutes from "@/routes/v1/subscriptions.routes";
import paymentLinksRoutes from "@/routes/v1/payment-links.routes";
import eventsRoutes from "@/routes/v1/events.routes";
import syncRoutes from "@/routes/v1/sync.routes";
import metricsRoutes from "@/routes/v1/metrics.routes";

const app: Express = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.server.corsOrigin,
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", limiter);

// Body parsing
app.use(express.json({ limit: config.server.bodyParserLimit }));
app.use(express.urlencoded({ extended: true, limit: config.server.bodyParserLimit }));

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: config.server.nodeEnv,
  });
});

// V1 API routes
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/transactions", transactionsRoutes);
app.use("/api/v1/batch-transactions", batchTransactionsRoutes);
app.use("/api/v1/rewards", rewardsRoutes);
app.use("/api/v1/subscriptions", subscriptionsRoutes);
app.use("/api/v1/payment-links", paymentLinksRoutes);
app.use("/api/v1/events", eventsRoutes);
app.use("/api/v1/sync", syncRoutes);
app.use("/api/v1/metrics", metricsRoutes);

// Error handling (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = config.server.port;
const HOST = config.server.host;

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`📊 Environment: ${config.server.nodeEnv}`);
  console.log(`🔗 API: http://${HOST}:${PORT}/api/v1`);
  console.log(`❤️  Health: http://${HOST}:${PORT}/health`);
  
  // Initialize background jobs
  initializeBackgroundJobs();
});

export default app;

