import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { sendSuccess, sendError, sendPaginated, ErrorCode } from "@/utils/response.util";
import { normalizeAddress } from "@/utils/address.utils";
import { signPayload, generateNonce } from "@/utils/eip712.utils";
import { z } from "zod";
import { validate } from "@/middleware/validation.middleware";
import { config } from "@/config/env";

const router = Router();

const createPaymentLinkSchema = z.object({
  sender: z.string(),
  recipients: z.array(
    z.object({
      address: z.string(),
      amount: z.string(),
    })
  ),
  token: z.string().default("XTK"),
  expiry: z.number(), // Unix timestamp
  note: z.string().optional(),
  eventId: z.string().optional(),
});

/**
 * POST /api/v1/payment-links
 * Generate payment link
 */
router.post("/", validate(createPaymentLinkSchema), async (req, res, next) => {
  try {
    const { sender, recipients, token, expiry, note, eventId } = req.body;

    const normalizedSender = normalizeAddress(sender);
    const nonce = generateNonce();

    // Create EIP-712 payload
    const payload = {
      recipients,
      nonce,
      expiresAt: new Date(expiry * 1000).toISOString(),
    };

    // Sign payload
    const signature = await signPayload(payload);

    // Calculate total amount
    const totalAmount = recipients.reduce(
      (sum: bigint, r: any) => sum + BigInt(r.amount || "0"),
      0n
    );

    // Create payment link record
    const paymentLink = await prisma.paymentLink.create({
      data: {
        senderAddress: normalizedSender,
        recipients: recipients as any,
        token: token || "XTK",
        nonce: parseInt(nonce.split("-")[0]) || Date.now(),
        expiry: BigInt(expiry),
        eventId,
        note,
        status: "PENDING",
      },
    });

    // Generate link URL
    const linkUrl = `${config.server.corsOrigin === "*" ? "https://app.domain.xyz" : config.server.corsOrigin}/approve-payment?token=${signature}&sender=${normalizedSender}&linkId=${paymentLink.paymentLinkId}`;

    return sendSuccess(
      res,
      {
        paymentLinkId: paymentLink.paymentLinkId,
        linkUrl,
        nonce: paymentLink.nonce,
        expiry: paymentLink.expiry.toString(),
        createdAt: paymentLink.createdAt,
      },
      201
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/payment-links/:paymentLinkId
 * Get payment link details
 */
router.get("/:paymentLinkId", async (req, res, next) => {
  try {
    const { paymentLinkId } = req.params;

    const paymentLink = await prisma.paymentLink.findUnique({
      where: { paymentLinkId },
    });

    if (!paymentLink) {
      return sendError(res, ErrorCode.NOT_FOUND, "Payment link not found", 404);
    }

    const totalAmount = (paymentLink.recipients as any[]).reduce(
      (sum: bigint, r: any) => sum + BigInt(r.amount || "0"),
      0n
    );

    return sendSuccess(res, {
      paymentLinkId: paymentLink.paymentLinkId,
      sender: paymentLink.senderAddress,
      recipients: paymentLink.recipients,
      totalAmount: totalAmount.toString(),
      expiry: paymentLink.expiry.toString(),
      status: paymentLink.status.toLowerCase(),
      txHash: paymentLink.txHash,
      createdAt: paymentLink.createdAt,
      executedAt: paymentLink.executedAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/payment-links/:paymentLinkId/execute
 * Record payment link execution
 */
router.post("/:paymentLinkId/execute", async (req, res, next) => {
  try {
    const { paymentLinkId } = req.params;
    const { txHash, executedBy } = req.body;

    const paymentLink = await prisma.paymentLink.findUnique({
      where: { paymentLinkId },
    });

    if (!paymentLink) {
      return sendError(res, ErrorCode.NOT_FOUND, "Payment link not found", 404);
    }

    if (paymentLink.status !== "PENDING") {
      return sendError(
        res,
        ErrorCode.INVALID_PARAMETERS,
        "Payment link already executed or expired",
        400
      );
    }

    // Update payment link
    const updated = await prisma.paymentLink.update({
      where: { paymentLinkId },
      data: {
        status: "EXECUTED",
        txHash,
        executedAt: new Date(),
      },
    });

    // Create transaction records for each recipient
    const recipients = paymentLink.recipients as any[];
    const transactionPromises = recipients.map((recipient: any) =>
      prisma.transaction.create({
        data: {
          txHash: `${txHash}-${recipient.address}`,
          fromAddress: paymentLink.senderAddress,
          toAddress: normalizeAddress(recipient.address),
          amount: recipient.amount,
          token: paymentLink.token,
          type: "PAYMENT_LINK",
          status: "PENDING",
          syncStatus: "PENDING",
          metadata: {
            paymentLinkId: paymentLink.paymentLinkId,
            eventId: paymentLink.eventId,
          },
        },
      })
    );

    await Promise.all(transactionPromises);

    return sendSuccess(res, {
      paymentLinkId: updated.paymentLinkId,
      txHash: updated.txHash,
      status: updated.status.toLowerCase(),
      executedAt: updated.executedAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/payment-links/initiated/:walletAddress
 * Get all payment links created by a user
 */
router.get("/initiated/:walletAddress", async (req, res, next) => {
  try {
    const { walletAddress } = req.params;
    const { page = "1", limit = "20", status = "all" } = req.query;

    const normalizedAddress = normalizeAddress(walletAddress);
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      senderAddress: normalizedAddress,
    };

    if (status !== "all") {
      where.status = (status as string).toUpperCase();
    }

    // Check for expired links
    if (status === "all" || status === "expired") {
      // This will be handled in the formatting step
    }

    const [paymentLinks, total] = await Promise.all([
      prisma.paymentLink.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.paymentLink.count({ where }),
    ]);

    const now = BigInt(Math.floor(Date.now() / 1000));
    const formatted = paymentLinks.map((link) => {
      const recipients = link.recipients as any[];
      const totalAmount = recipients.reduce(
        (sum: bigint, r: any) => sum + BigInt(r.amount || "0"),
        0n
      );

      // Check if expired
      let linkStatus = link.status.toLowerCase();
      if (link.expiry && link.expiry < now && linkStatus === "pending") {
        linkStatus = "expired";
      }

      return {
        id: link.id,
        linkId: link.paymentLinkId,
        creatorAddress: link.senderAddress,
        recipients: recipients.map((r: any) => ({
          address: r.address,
          amount: r.amount,
        })),
        totalAmount: totalAmount.toString(),
        status: linkStatus,
        executedAt: link.executedAt,
        txHash: link.txHash,
        expiresAt: link.expiry.toString(),
        createdAt: link.createdAt,
        executionCount: link.executedAt ? 1 : 0, // Simplified - could track multiple executions
      };
    });

    // Filter by status if needed (for expired)
    const filtered = status === "expired"
      ? formatted.filter((link) => link.status === "expired")
      : formatted;

    return sendPaginated(res, filtered, pageNum, limitNum, filtered.length);
  } catch (error) {
    next(error);
  }
});

export default router;

