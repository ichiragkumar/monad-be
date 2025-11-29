import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { sendSuccess, sendError, ErrorCode } from "@/utils/response.util";
import { normalizeAddress } from "@/utils/address.utils";

const router = Router();

/**
 * GET /api/v1/sync/status
 * Get sync status for wallet
 */
router.get("/status", async (req, res, next) => {
  try {
    const { walletAddress } = req.query;

    if (!walletAddress) {
      return sendError(
        res,
        ErrorCode.INVALID_PARAMETERS,
        "walletAddress is required",
        400
      );
    }

    const normalizedAddress = normalizeAddress(walletAddress as string);

    // Check transactions from last 2-10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    const [pendingTransactions, recentTransactions] = await Promise.all([
      // Transactions still syncing
      prisma.transaction.findMany({
        where: {
          OR: [
            { fromAddress: normalizedAddress },
            { toAddress: normalizedAddress },
          ],
          createdAt: {
            gte: tenMinutesAgo,
          },
          syncStatus: {
            in: ["PENDING", "SYNCING"],
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      // All recent transactions for last sync time
      prisma.transaction.findMany({
        where: {
          OR: [
            { fromAddress: normalizedAddress },
            { toAddress: normalizedAddress },
          ],
          createdAt: {
            gte: twoMinutesAgo,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      }),
    ]);

    const isSyncing = pendingTransactions.length > 0;
    const lastSyncTime = recentTransactions.length > 0
      ? recentTransactions[0].createdAt
      : null;

    // Find oldest pending transaction for sync window
    const oldestPending = pendingTransactions.length > 0
      ? pendingTransactions[pendingTransactions.length - 1].createdAt
      : null;

    return sendSuccess(res, {
      isSyncing,
      lastSyncTime,
      pendingTransactions: pendingTransactions.length,
      syncWindow: oldestPending
        ? {
            startTime: oldestPending,
            endTime: new Date(),
          }
        : null,
      message: isSyncing
        ? "Transactions syncing in progress..."
        : "All transactions synced",
    });
  } catch (error) {
    next(error);
  }
});

export default router;

