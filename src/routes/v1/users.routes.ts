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

    // Get vendor profile if exists
    let vendorProfile = null;
    if (user.role === "VENDOR") {
      vendorProfile = await prisma.vendor.findUnique({
        where: { userId: user.id },
      });
    }

    // Get event participant count
    const eventParticipantCount = await prisma.eventParticipant.count({
      where: { address: normalizedAddress },
    });

    return sendSuccess(res, {
      userId: user.id,
      walletAddress: user.address,
      ensName: user.ensName,
      role: user.role,
      profile: {
        displayName: user.displayName,
        avatar: user.avatar,
      },
      vendorProfile: vendorProfile
        ? {
            businessName: vendorProfile.businessName,
            description: vendorProfile.description,
            website: vendorProfile.website,
          }
        : null,
      createdAt: user.createdAt,
      lastSeenAt: user.lastSeenAt,
      stats: {
        totalSent: sentAmount,
        totalReceived: receivedAmount,
        transactionCount,
        subscriptionCount,
        totalEventsParticipated: eventParticipantCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/users/:walletAddress/vendor-request
 * Request vendor role
 */
router.post("/:walletAddress/vendor-request", verifyWalletSignature, async (req, res, next) => {
  try {
    const { walletAddress } = req.params;
    const verifiedAddress = (req as any).verifiedAddress;
    const { businessName, description, website } = req.body;

    const normalizedAddress = normalizeAddress(verifiedAddress || walletAddress);

    // Verify the signature matches the wallet address
    if (normalizedAddress !== normalizeAddress(walletAddress)) {
      return sendError(
        res,
        ErrorCode.INVALID_SIGNATURE,
        "Wallet address mismatch",
        403
      );
    }

    // Check if user already has vendor role
    const user = await prisma.user.findUnique({
      where: { address: normalizedAddress },
    });

    if (user && user.role === "VENDOR") {
      return sendError(
        res,
        ErrorCode.INVALID_PARAMETERS,
        "User is already a vendor",
        400
      );
    }

    // Check for existing pending request
    const existingRequest = await prisma.vendorRequest.findFirst({
      where: {
        walletAddress: normalizedAddress,
        status: "PENDING",
      },
    });

    if (existingRequest) {
      return sendError(
        res,
        ErrorCode.INVALID_PARAMETERS,
        "Vendor request already exists for this address",
        409,
        {
          requestId: existingRequest.requestId,
          status: existingRequest.status,
        }
      );
    }

    // Create vendor request
    const vendorRequest = await prisma.vendorRequest.create({
      data: {
        walletAddress: normalizedAddress,
        businessName,
        description,
        website: website || null,
        status: "PENDING",
      },
    });

    return sendSuccess(
      res,
      {
        requestId: vendorRequest.requestId,
        walletAddress: vendorRequest.walletAddress,
        status: vendorRequest.status,
        businessName: vendorRequest.businessName,
        submittedAt: vendorRequest.submittedAt,
        message: "Vendor request submitted successfully",
      },
      201
    );
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/users/:walletAddress/role
 * Update user role (admin function - typically called after vendor approval)
 */
router.patch("/:walletAddress/role", async (req, res, next) => {
  try {
    const { walletAddress } = req.params;
    const { role, vendorData } = req.body;

    const normalizedAddress = normalizeAddress(walletAddress);

    if (!["USER", "VENDOR"].includes(role)) {
      return sendError(
        res,
        ErrorCode.INVALID_PARAMETERS,
        "Invalid role. Must be USER or VENDOR",
        400
      );
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { address: normalizedAddress },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          address: normalizedAddress,
          role: role as any,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: role as any },
      });
    }

    // If vendor role, create/update vendor profile
    let vendorProfile = null;
    if (role === "VENDOR" && vendorData) {
      vendorProfile = await prisma.vendor.upsert({
        where: { userId: user.id },
        update: {
          businessName: vendorData.businessName,
          description: vendorData.description,
          website: vendorData.website || null,
        },
        create: {
          userId: user.id,
          businessName: vendorData.businessName,
          description: vendorData.description,
          website: vendorData.website || null,
        },
      });

      // Update vendor request status if exists
      await prisma.vendorRequest.updateMany({
        where: {
          walletAddress: normalizedAddress,
          status: "PENDING",
        },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
        },
      });
    }

    return sendSuccess(res, {
      userId: user.id,
      walletAddress: user.address,
      role: user.role,
      vendorProfile: vendorProfile
        ? {
            businessName: vendorProfile.businessName,
            description: vendorProfile.description,
            website: vendorProfile.website,
          }
        : null,
      updatedAt: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;

