import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { verifyWalletSignature } from "@/middleware/signature.middleware";
import { sendSuccess, sendError, ErrorCode } from "@/utils/response.util";
import { normalizeAddress } from "@/utils/address.utils";
import { ethers } from "ethers";

const router = Router();

/**
 * POST /api/v1/users
 * Create or get user account when wallet connects
 */
router.post("/", verifyWalletSignature, async (req, res, next) => {
  try {
    const { walletAddress } = req.body;
    const verifiedAddress = (req as any).verifiedAddress;

    const normalizedAddress = normalizeAddress(verifiedAddress || walletAddress);

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { address: normalizedAddress },
    });

    if (user) {
      // Update lastSeenAt
      user = await prisma.user.update({
        where: { id: user.id },
        data: { lastSeenAt: new Date() },
      });
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          address: normalizedAddress,
          role: "USER",
          lastSeenAt: new Date(),
        },
      });
    }

    return sendSuccess(res, {
      userId: user.id,
      walletAddress: user.address,
      ensName: user.ensName,
      createdAt: user.createdAt,
      lastSeenAt: user.lastSeenAt,
      profile: {
        displayName: user.displayName,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/users/:walletAddress
 * Get user profile with stats
 */
router.get("/:walletAddress", async (req, res, next) => {
  try {
    const { walletAddress } = req.params;
    const normalizedAddress = normalizeAddress(walletAddress);

    const user = await prisma.user.findUnique({
      where: { address: normalizedAddress },
    });

    if (!user) {
      return sendError(res, ErrorCode.WALLET_NOT_FOUND, "User not found", 404);
    }

    // Calculate stats
    const [sentTransactions, receivedTransactions, transactionCount, subscriptionCount] = await Promise.all([
      // Total sent - get all confirmed sent transactions
      prisma.transaction.findMany({
        where: { fromAddress: normalizedAddress, status: "CONFIRMED" },
        select: { amount: true },
      }),
      // Total received - get all confirmed received transactions
      prisma.transaction.findMany({
        where: { toAddress: normalizedAddress, status: "CONFIRMED" },
        select: { amount: true },
      }),
      // Transaction count
      prisma.transaction.count({
        where: {
          OR: [
            { fromAddress: normalizedAddress },
            { toAddress: normalizedAddress },
          ],
        },
      }),
      // Subscription count
      prisma.subscription.count({
        where: {
          OR: [
            { payerAddress: normalizedAddress },
            { recipientAddress: normalizedAddress },
          ],
          status: "ACTIVE",
        },
      }),
    ]);

    // Sum amounts (they're stored as decimal strings)
    const sentAmount = sentTransactions.reduce(
      (sum, tx) => sum + parseFloat(tx.amount || "0"),
      0
    ).toFixed(2);
    const receivedAmount = receivedTransactions.reduce(
      (sum, tx) => sum + parseFloat(tx.amount || "0"),
      0
    ).toFixed(2);

    return sendSuccess(res, {
      userId: user.id,
      walletAddress: user.address,
      ensName: user.ensName,
      stats: {
        totalSent: sentAmount,
        totalReceived: receivedAmount,
        transactionCount,
        subscriptionCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

