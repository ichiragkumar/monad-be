import { PrismaClient } from "@prisma/client";
import { config } from "@/config/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Connection URL can be passed via datasources override if needed
    // For Prisma 7+, you can also use: datasources: { db: { url: config.database.url } }
    log:
      config.server.nodeEnv === "development"
        ? ["query", "error", "warn"]
        : config.logging.level === "debug"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (config.server.nodeEnv !== "production") globalForPrisma.prisma = prisma;

