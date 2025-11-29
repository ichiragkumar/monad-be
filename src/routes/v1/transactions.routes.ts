import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { sendSuccess, sendError, ErrorCode, sendPaginated } from "@/utils/response.util";
import { normalizeAddress } from "@/utils/address.utils";
import { z } from "zod";
import { validate } from "@/middleware/validation.middleware";

const router = Router();

const createTransactionSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash"),
  from: z.string(),
  to: z.string(),
  amount: z.string(),
  token: z.string().default("XTK"),
  type: z.enum(["send", "batch", "reward", "subscription", "payment_link"]),
  metadata: z.object({}).passthrough().optional(),
});

/**
 * GET /api/v1/transactions
 * Get transaction history with pagination and filters
 */
router.get("/", async (req, res, next) => {
  try {
    const {
      walletAddress,
      page = "1",
      limit = "20",
      type,
      status,
      fromDate,
      toDate,
    } = req.query;

    if (!walletAddress) {
      return sendError(
        res,
        ErrorCode.INVALID_PARAMETERS,
        "walletAddress is required",
        400
      );
    }

    const normalizedAddress = normalizeAddress(walletAddress as string);
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {
      OR: [
        { fromAddress: normalizedAddress },
        { toAddress: normalizedAddress },
      ],
    };

    if (type && type !== "all") {
      // Map frontend type to database type
      const typeMap: Record<string, any> = {
        sent: { fromAddress: normalizedAddress },
        received: { toAddress: normalizedAddress },
      };
      if (typeMap[type as string]) {
        Object.assign(where, typeMap[type as string]);
      }
    }

    if (status) {
      where.status = status.toUpperCase();
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = new Date(fromDate as string);
      }
      if (toDate) {
        where.createdAt.lte = new Date(toDate as string);
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.transaction.count({ where }),
    ]);

    const formattedTransactions = transactions.map((tx) => {
      const isSent = tx.fromAddress.toLowerCase() === normalizedAddress.toLowerCase();
      return {
        txHash: tx.txHash,
        from: tx.fromAddress,
        to: tx.toAddress,
        amount: tx.amount,
        token: tx.token,
        type: isSent ? "sent" : "received",
        status: tx.status.toLowerCase(),
        blockNumber: tx.blockNumber?.toString(),
        blockTimestamp: tx.blockTimestamp?.toString(),
        gasUsed: tx.gasUsed,
        gasPrice: tx.gasPrice,
        createdAt: tx.createdAt,
        confirmedAt: tx.confirmedAt,
        syncStatus: tx.syncStatus.toLowerCase(),
      };
    });

    return sendPaginated(res, formattedTransactions, pageNum, limitNum, total);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/transactions
 * Create transaction record
 */
router.post("/", validate(createTransactionSchema), async (req, res, next) => {
  try {
    const { txHash, from, to, amount, token, type, metadata } = req.body;

    // Check if transaction already exists
    const existing = await prisma.transaction.findUnique({
      where: { txHash },
    });

    if (existing) {
      return sendSuccess(res, {
        transactionId: existing.id,
        txHash: existing.txHash,
        status: existing.status.toLowerCase(),
        syncStatus: existing.syncStatus.toLowerCase(),
        createdAt: existing.createdAt,
      });
    }

    // Map type
    const typeMap: Record<string, any> = {
      send: "SEND",
      batch: "BATCH",
      reward: "REWARD",
      subscription: "SUBSCRIPTION",
      payment_link: "PAYMENT_LINK",
    };

    const transaction = await prisma.transaction.create({
      data: {
        txHash,
        fromAddress: normalizeAddress(from),
        toAddress: normalizeAddress(to),
        amount,
        token: token || "XTK",
        type: typeMap[type] || "SEND",
        status: "PENDING",
        syncStatus: "PENDING",
        metadata: metadata || {},
      },
    });

    return sendSuccess(
      res,
      {
        transactionId: transaction.id,
        txHash: transaction.txHash,
        status: transaction.status.toLowerCase(),
        syncStatus: transaction.syncStatus.toLowerCase(),
        createdAt: transaction.createdAt,
      },
      201
    );
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/transactions/:txHash
 * Update transaction status after blockchain confirmation
 */
router.patch("/:txHash", async (req, res, next) => {
  try {
    const { txHash } = req.params;
    const { status, blockNumber, blockTimestamp, gasUsed, gasPrice, syncStatus } = req.body;

    const updateData: any = {};
    if (status) updateData.status = status.toUpperCase();
    if (blockNumber) updateData.blockNumber = BigInt(blockNumber);
    if (blockTimestamp) updateData.blockTimestamp = BigInt(blockTimestamp);
    if (gasUsed) updateData.gasUsed = gasUsed;
    if (gasPrice) updateData.gasPrice = gasPrice;
    if (syncStatus) updateData.syncStatus = syncStatus.toUpperCase();
    if (status === "confirmed") updateData.confirmedAt = new Date();
    updateData.updatedAt = new Date();

    const transaction = await prisma.transaction.update({
      where: { txHash },
      data: updateData,
    });

    return sendSuccess(res, {
      txHash: transaction.txHash,
      status: transaction.status.toLowerCase(),
      syncStatus: transaction.syncStatus.toLowerCase(),
      updatedAt: transaction.createdAt, // Use createdAt as updatedAt isn't in the model yet
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      return sendError(
        res,
        ErrorCode.TRANSACTION_NOT_FOUND,
        "Transaction not found",
        404
      );
    }
    next(error);
  }
});

/**
 * GET /api/v1/transactions/:txHash
 * Get transaction by hash
 */
router.get("/:txHash", async (req, res, next) => {
  try {
    const { txHash } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { txHash },
    });

    if (!transaction) {
      return sendError(
        res,
        ErrorCode.TRANSACTION_NOT_FOUND,
        "Transaction not found",
        404
      );
    }

    return sendSuccess(res, {
      txHash: transaction.txHash,
      from: transaction.fromAddress,
      to: transaction.toAddress,
      amount: transaction.amount,
      token: transaction.token,
      type: transaction.type.toLowerCase(),
      status: transaction.status.toLowerCase(),
      blockNumber: transaction.blockNumber?.toString(),
      blockTimestamp: transaction.blockTimestamp?.toString(),
      syncStatus: transaction.syncStatus.toLowerCase(),
      metadata: transaction.metadata || {},
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/transactions/recent
 * Get recent transactions (last 2-10 minutes) with sync status
 */
router.get("/recent", async (req, res, next) => {
  try {
    const { walletAddress, minutes = "10" } = req.query;

    if (!walletAddress) {
      return sendError(
        res,
        ErrorCode.INVALID_PARAMETERS,
        "walletAddress is required",
        400
      );
    }

    const normalizedAddress = normalizeAddress(walletAddress as string);
    const minutesNum = parseInt(minutes as string) || 10;
    const cutoffTime = new Date(Date.now() - minutesNum * 60 * 1000);

    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { fromAddress: normalizedAddress },
          { toAddress: normalizedAddress },
        ],
        createdAt: {
          gte: cutoffTime,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const isSyncing = transactions.some(
      (tx) => tx.syncStatus === "PENDING" || tx.syncStatus === "SYNCING"
    );

    const formattedTransactions = transactions.map((tx) => ({
      txHash: tx.txHash,
      status: tx.status.toLowerCase(),
      syncStatus: tx.syncStatus.toLowerCase(),
      createdAt: tx.createdAt,
    }));

    return sendSuccess(res, {
      transactions: formattedTransactions,
      isSyncing,
      syncMessage: isSyncing ? "Transactions syncing in progress..." : "All transactions synced",
    });
  } catch (error) {
    next(error);
  }
});

export default router;

