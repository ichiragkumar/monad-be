import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { ContractService } from "@/services/contract.service";
import { authenticateToken, requireVendor, AuthRequest } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validation.middleware";
import { airdropSchema, airdropEqualSchema } from "@/utils/validation.schemas";
import { normalizeAddress, resolveAddress } from "@/utils/address.utils";
import { AppError } from "@/middleware/error.middleware";

const router = Router();

/**
 * POST /airdrop
 * Execute airdrop with custom amounts
 */
router.post(
  "/airdrop",
  authenticateToken,
  requireVendor,
  validate(airdropSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { eventId, recipients, amounts } = req.body;
      const vendorAddress = req.user!.address;

      // Verify event exists and belongs to vendor
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: { organizer: true },
      });

      if (!event) {
        throw new AppError("Event not found", 404);
      }

      if (event.organizer.address !== vendorAddress) {
        throw new AppError("Unauthorized: Event does not belong to vendor", 403);
      }

      if (recipients.length !== amounts.length) {
        throw new AppError("Recipients and amounts arrays must have the same length", 400);
      }

      // Resolve ENS names to addresses
      const resolvedAddresses = await Promise.all(
        recipients.map((addr: string) => resolveAddress(addr))
      );

      // Convert amounts to BigInt
      const amountsBigInt = amounts.map((amt: string | bigint) =>
        typeof amt === "string" ? BigInt(amt) : amt
      );

      // Execute airdrop on-chain
      const txHash = await ContractService.executeAirdrop(
        vendorAddress,
        resolvedAddresses,
        amountsBigInt,
        eventId
      );

      res.status(201).json({
        message: "Airdrop initiated",
        txHash,
        recipientCount: recipients.length,
        status: "PENDING",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /airdrop/equal
 * Execute airdrop with equal amounts for all recipients
 */
router.post(
  "/airdrop/equal",
  authenticateToken,
  requireVendor,
  validate(airdropEqualSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { eventId, recipients, amount } = req.body;
      const vendorAddress = req.user!.address;

      // Verify event
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: { organizer: true },
      });

      if (!event) {
        throw new AppError("Event not found", 404);
      }

      if (event.organizer.address !== vendorAddress) {
        throw new AppError("Unauthorized", 403);
      }

      // Resolve ENS names
      const resolvedAddresses = await Promise.all(
        recipients.map((addr: string) => resolveAddress(addr))
      );

      // Convert amount to BigInt
      const amountBigInt = typeof amount === "string" ? BigInt(amount) : amount;

      // Execute airdrop
      const txHash = await ContractService.executeAirdropEqual(
        vendorAddress,
        resolvedAddresses,
        amountBigInt,
        eventId
      );

      res.status(201).json({
        message: "Airdrop initiated",
        txHash,
        recipientCount: recipients.length,
        amountPerRecipient: amountBigInt.toString(),
        totalAmount: (amountBigInt * BigInt(recipients.length)).toString(),
        status: "PENDING",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /airdrop/:id
 * Get airdrop details
 */
router.get("/airdrop/:id", authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const airdrop = await prisma.airdrop.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!airdrop) {
      throw new AppError("Airdrop not found", 404);
    }

    res.json({
      id: airdrop.id,
      event: airdrop.event,
      vendorAddress: airdrop.vendorAddress,
      recipientCount: airdrop.recipientCount,
      totalAmount: airdrop.totalAmount.toString(),
      txHash: airdrop.txHash,
      status: airdrop.status,
      errorMessage: airdrop.errorMessage,
      createdAt: airdrop.createdAt,
      completedAt: airdrop.completedAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /airdrop/event/:eventId
 * Get all airdrops for an event
 */
router.get("/airdrop/event/:eventId", authenticateToken, async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const airdrops = await prisma.airdrop.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      eventId,
      count: airdrops.length,
      airdrops: airdrops.map((airdrop) => ({
        id: airdrop.id,
        recipientCount: airdrop.recipientCount,
        totalAmount: airdrop.totalAmount.toString(),
        txHash: airdrop.txHash,
        status: airdrop.status,
        createdAt: airdrop.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;

