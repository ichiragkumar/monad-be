import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { sendSuccess, sendError, ErrorCode, sendPaginated } from "@/utils/response.util";
import { normalizeAddress } from "@/utils/address.utils";
import { z } from "zod";
import { validate } from "@/middleware/validation.middleware";

const router = Router();

const createBatchSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  sender: z.string(),
  recipients: z.array(
    z.object({
      address: z.string(),
      amount: z.string(),
    })
  ),
  totalAmount: z.string(),
  token: z.string().default("XTK"),
  type: z.enum(["equal", "variable"]).default("variable"),
  eventId: z.string().optional(),
  note: z.string().optional(),
});

/**
 * POST /api/v1/batch-transactions
 * Create batch transaction record
 */
router.post("/", validate(createBatchSchema), async (req, res, next) => {
  try {
    const { txHash, sender, recipients, totalAmount, token, type, eventId, note } = req.body;

    const normalizedSender = normalizeAddress(sender);

    // Create batch transaction
    const batch = await prisma.batchTransaction.create({
      data: {
        txHash,
        senderAddress: normalizedSender,
        recipients: recipients as any,
        totalAmount,
        token: token || "XTK",
        type,
        eventId,
        note,
        status: "PENDING",
      },
    });

    // Create individual transaction records for each recipient
    const transactionPromises = recipients.map((recipient: any) =>
      prisma.transaction.create({
        data: {
          txHash: `${txHash}-${recipient.address}`, // Unique hash for each recipient
          fromAddress: normalizedSender,
          toAddress: normalizeAddress(recipient.address),
          amount: recipient.amount,
          token: token || "XTK",
          type: "BATCH",
          status: "PENDING",
          syncStatus: "PENDING",
          metadata: {
            batchId: batch.batchId,
            eventId,
          },
        },
      })
    );

    await Promise.all(transactionPromises);

    return sendSuccess(
      res,
      {
        batchId: batch.batchId,
        txHash: batch.txHash,
        recipientCount: recipients.length,
        totalAmount: batch.totalAmount,
        status: batch.status.toLowerCase(),
        createdAt: batch.createdAt,
      },
      201
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/batch-transactions/:batchId
 * Get batch transaction details
 */
router.get("/:batchId", async (req, res, next) => {
  try {
    const { batchId } = req.params;

    const batch = await prisma.batchTransaction.findUnique({
      where: { batchId },
    });

    if (!batch) {
      return sendError(res, ErrorCode.NOT_FOUND, "Batch transaction not found", 404);
    }

    return sendSuccess(res, {
      batchId: batch.batchId,
      txHash: batch.txHash,
      sender: batch.senderAddress,
      recipients: (batch.recipients as any[]).map((r: any) => ({
        address: r.address,
        amount: r.amount,
        status: batch.status.toLowerCase(),
      })),
      totalAmount: batch.totalAmount,
      status: batch.status.toLowerCase(),
      createdAt: batch.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/batch-transactions
 * Get batch transactions by user
 */
router.get("/", async (req, res, next) => {
  try {
    const { walletAddress, page = "1", limit = "20" } = req.query;

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

    const [batches, total] = await Promise.all([
      prisma.batchTransaction.findMany({
        where: { senderAddress: normalizedAddress },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.batchTransaction.count({
        where: { senderAddress: normalizedAddress },
      }),
    ]);

    const formattedBatches = batches.map((batch) => ({
      batchId: batch.batchId,
      txHash: batch.txHash,
      sender: batch.senderAddress,
      recipients: batch.recipients,
      totalAmount: batch.totalAmount,
      status: batch.status.toLowerCase(),
      createdAt: batch.createdAt,
    }));

    return sendPaginated(res, formattedBatches, pageNum, limitNum, total);
  } catch (error) {
    next(error);
  }
});

export default router;

