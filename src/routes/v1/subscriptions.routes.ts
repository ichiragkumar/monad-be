import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { sendSuccess, sendError, ErrorCode, sendPaginated } from "@/utils/response.util";
import { normalizeAddress } from "@/utils/address.utils";
import { z } from "zod";
import { validate } from "@/middleware/validation.middleware";

const router = Router();

const createSubscriptionSchema = z.object({
  subscriptionId: z.string(), // On-chain ID
  payer: z.string(),
  recipient: z.string(),
  amount: z.string(),
  token: z.string().default("XTK"),
  interval: z.number(), // seconds
  totalPayments: z.number().default(0), // 0 for unlimited
  nextPaymentTime: z.number(), // Unix timestamp
  startTime: z.number(), // Unix timestamp
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

/**
 * POST /api/v1/subscriptions
 * Create subscription record
 */
router.post("/", validate(createSubscriptionSchema), async (req, res, next) => {
  try {
    const {
      subscriptionId,
      payer,
      recipient,
      amount,
      token,
      interval,
      totalPayments,
      nextPaymentTime,
      startTime,
      txHash,
    } = req.body;

    const normalizedPayer = normalizeAddress(payer);
    const normalizedRecipient = normalizeAddress(recipient);

    // Ensure users exist
    await prisma.user.upsert({
      where: { address: normalizedPayer },
      update: {},
      create: { address: normalizedPayer, role: "USER" },
    });

    await prisma.user.upsert({
      where: { address: normalizedRecipient },
      update: {},
      create: { address: normalizedRecipient, role: "USER" },
    });

    const subscription = await prisma.subscription.create({
      data: {
        onChainId: subscriptionId,
        payerAddress: normalizedPayer,
        recipientAddress: normalizedRecipient,
        amount,
        token: token || "XTK",
        interval: BigInt(interval),
        totalPayments: totalPayments || 0,
        nextPaymentTime: BigInt(nextPaymentTime),
        startTime: BigInt(startTime),
        status: "ACTIVE",
      },
    });

    // Create transaction record for subscription creation
    await prisma.transaction.create({
      data: {
        txHash: `${txHash}-create`,
        fromAddress: normalizedPayer,
        toAddress: normalizedRecipient,
        amount: "0", // No amount for creation
        token: token || "XTK",
        type: "SUBSCRIPTION",
        status: "CONFIRMED",
        syncStatus: "SYNCED",
        metadata: {
          subscriptionId: subscription.subscriptionId,
          action: "create",
        },
      },
    });

    return sendSuccess(
      res,
      {
        subscriptionId: subscription.subscriptionId,
        onChainId: subscription.onChainId,
        payer: subscription.payerAddress,
        recipient: subscription.recipientAddress,
        amount: subscription.amount,
        status: subscription.status.toLowerCase(),
        createdAt: subscription.createdAt,
      },
      201
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/subscriptions
 * Get user subscriptions
 */
router.get("/", async (req, res, next) => {
  try {
    const { walletAddress, type, page = "1", limit = "20" } = req.query;

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

    const where: any = {
      OR: [
        { payerAddress: normalizedAddress },
        { recipientAddress: normalizedAddress },
      ],
    };

    if (type && type !== "all") {
      where.status = (type as string).toUpperCase();
    }

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.subscription.count({ where }),
    ]);

    const formatted = subscriptions.map((sub) => ({
      subscriptionId: sub.subscriptionId,
      onChainId: sub.onChainId,
      payer: sub.payerAddress,
      recipient: sub.recipientAddress,
      amount: sub.amount,
      interval: sub.interval.toString(),
      nextPaymentTime: sub.nextPaymentTime.toString(),
      totalPayments: sub.totalPayments,
      paidCount: sub.paidCount,
      status: sub.status.toLowerCase(),
      createdAt: sub.createdAt,
    }));

    return sendPaginated(res, formatted, pageNum, limitNum, total);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/subscriptions/:subscriptionId
 * Update subscription status
 */
router.patch("/:subscriptionId", async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const { status, txHash, nextPaymentTime } = req.body;

    const updateData: any = {};
    if (status) updateData.status = status.toUpperCase();
    if (nextPaymentTime) updateData.nextPaymentTime = BigInt(nextPaymentTime);

    const subscription = await prisma.subscription.update({
      where: { subscriptionId },
      data: updateData,
    });

    return sendSuccess(res, {
      subscriptionId: subscription.subscriptionId,
      status: subscription.status.toLowerCase(),
      nextPaymentTime: subscription.nextPaymentTime.toString(),
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      return sendError(res, ErrorCode.NOT_FOUND, "Subscription not found", 404);
    }
    next(error);
  }
});

/**
 * POST /api/v1/subscriptions/:subscriptionId/payments
 * Record subscription payment
 */
router.post("/:subscriptionId/payments", async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const { txHash, amount, paymentNumber, nextPaymentTime } = req.body;

    const subscription = await prisma.subscription.findUnique({
      where: { subscriptionId },
    });

    if (!subscription) {
      return sendError(res, ErrorCode.NOT_FOUND, "Subscription not found", 404);
    }

    // Create payment record
    const payment = await prisma.subscriptionPayment.create({
      data: {
        subscriptionId,
        txHash,
        amount,
        paymentNumber,
        nextPaymentTime: nextPaymentTime ? BigInt(nextPaymentTime) : null,
        status: "PENDING",
      },
    });

    // Update subscription
    await prisma.subscription.update({
      where: { subscriptionId },
      data: {
        paidCount: subscription.paidCount + 1,
        nextPaymentTime: nextPaymentTime ? BigInt(nextPaymentTime) : subscription.nextPaymentTime,
      },
    });

    // Create transaction record
    await prisma.transaction.create({
      data: {
        txHash: `${txHash}-${paymentNumber}`,
        fromAddress: subscription.payerAddress,
        toAddress: subscription.recipientAddress,
        amount,
        token: subscription.token,
        type: "SUBSCRIPTION",
        status: "PENDING",
        syncStatus: "PENDING",
        metadata: {
          subscriptionId: subscription.subscriptionId,
          paymentNumber,
        },
      },
    });

    return sendSuccess(
      res,
      {
        paymentId: payment.id,
        txHash: payment.txHash,
        amount: payment.amount,
        paymentNumber: payment.paymentNumber,
        createdAt: payment.createdAt,
      },
      201
    );
  } catch (error) {
    next(error);
  }
});

export default router;

