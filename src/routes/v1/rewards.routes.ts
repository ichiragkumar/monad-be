import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { sendSuccess, sendError, ErrorCode } from "@/utils/response.util";
import { normalizeAddress } from "@/utils/address.utils";
import { z } from "zod";
import { validate } from "@/middleware/validation.middleware";

const router = Router();

const createRewardSchema = z.object({
  eventId: z.string(),
  vendorAddress: z.string(),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  recipients: z.array(
    z.object({
      address: z.string(),
      amount: z.string(),
      reason: z.string().optional(),
    })
  ),
  totalAmount: z.string(),
  token: z.string().default("XTK"),
  distributionType: z.enum(["equal", "variable"]).default("variable"),
  metadata: z.object({}).passthrough().optional(),
});

/**
 * POST /api/v1/rewards
 * Create reward distribution record
 */
router.post("/", validate(createRewardSchema), async (req, res, next) => {
  try {
    const {
      eventId,
      vendorAddress,
      txHash,
      recipients,
      totalAmount,
      token,
      distributionType,
      metadata,
    } = req.body;

    const normalizedVendor = normalizeAddress(vendorAddress);

    const reward = await prisma.reward.create({
      data: {
        eventId,
        vendorAddress: normalizedVendor,
        txHash,
        recipients: recipients as any,
        totalAmount,
        token: token || "XTK",
        distributionType,
        metadata: metadata || {},
        status: "PENDING",
      },
    });

    // Create transaction records for each recipient
    const transactionPromises = recipients.map((recipient: any) =>
      prisma.transaction.create({
        data: {
          txHash: `${txHash}-${recipient.address}`,
          fromAddress: normalizedVendor,
          toAddress: normalizeAddress(recipient.address),
          amount: recipient.amount,
          token: token || "XTK",
          type: "REWARD",
          status: "PENDING",
          syncStatus: "PENDING",
          metadata: {
            eventId,
            rewardId: reward.rewardId,
            reason: recipient.reason,
          },
        },
      })
    );

    await Promise.all(transactionPromises);

    return sendSuccess(
      res,
      {
        rewardId: reward.rewardId,
        eventId: reward.eventId,
        txHash: reward.txHash,
        recipientCount: recipients.length,
        totalAmount: reward.totalAmount,
        status: reward.status.toLowerCase(),
        createdAt: reward.createdAt,
      },
      201
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/rewards/event/:eventId
 * Get rewards by event
 */
router.get("/event/:eventId", async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const rewards = await prisma.reward.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
    });

    return sendSuccess(
      res,
      rewards.map((reward) => ({
        rewardId: reward.rewardId,
        txHash: reward.txHash,
        totalAmount: reward.totalAmount,
        recipientCount: (reward.recipients as any[]).length,
        status: reward.status.toLowerCase(),
        createdAt: reward.createdAt,
      }))
    );
  } catch (error) {
    next(error);
  }
});

export default router;

