import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { ContractService } from "@/services/contract.service";
import { authenticateToken, requireVendor, AuthRequest } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validation.middleware";
import { createEventSchema } from "@/utils/validation.schemas";
import { AppError } from "@/middleware/error.middleware";

const router = Router();

/**
 * POST /vendor/event
 * Create a new event
 */
router.post(
  "/vendor/event",
  authenticateToken,
  requireVendor,
  validate(createEventSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { name, description, startDate, endDate, tokenBudget } = req.body;
      const userId = req.user!.userId;

      // Get vendor profile
      const vendor = await prisma.vendor.findUnique({
        where: { userId },
      });

      if (!vendor) {
        throw new AppError("Vendor profile not found", 404);
      }

      const event = await prisma.event.create({
        data: {
          name,
          description,
          organizerId: userId,
          vendorId: vendor.id,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          tokenBudget: tokenBudget ? BigInt(tokenBudget) : 0n,
          status: "DRAFT",
        },
        include: {
          organizer: {
            select: {
              address: true,
              ensName: true,
            },
          },
          vendor: true,
        },
      });

      res.status(201).json({
        id: event.id,
        name: event.name,
        description: event.description,
        status: event.status,
        organizer: event.organizer,
        tokenBudget: event.tokenBudget.toString(),
        startDate: event.startDate,
        endDate: event.endDate,
        createdAt: event.createdAt,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /vendor/:id/dashboard
 * Get vendor dashboard data
 */
router.get("/vendor/:id/dashboard", authenticateToken, requireVendor, async (req: AuthRequest, res, next) => {
  try {
    const vendorAddress = req.user!.address;

    const user = await prisma.user.findUnique({
      where: { address: vendorAddress },
      include: {
        vendorProfile: {
          include: {
            events: {
              include: {
                _count: {
                  select: {
                    whitelistEntries: true,
                    airdrops: true,
                  },
                },
              },
              orderBy: { createdAt: "desc" },
              take: 10,
            },
          },
        },
      },
    });

    if (!user || !user.vendorProfile) {
      throw new AppError("Vendor profile not found", 404);
    }

    // Get token balance
    let tokenBalance = "0";
    try {
      tokenBalance = await ContractService.getTokenBalance(vendorAddress);
    } catch (error) {
      console.error("Failed to fetch token balance:", error);
    }

    // Get statistics
    const totalEvents = await prisma.event.count({
      where: { organizerId: user.id },
    });

    const totalAirdrops = await prisma.airdrop.count({
      where: { vendorAddress },
    });

    const totalDistributed = await prisma.airdrop.aggregate({
      where: { vendorAddress },
      _sum: { totalAmount: true },
    });

    res.json({
      vendor: {
        id: user.vendorProfile.id,
        businessName: user.vendorProfile.businessName,
        description: user.vendorProfile.description,
        website: user.vendorProfile.website,
      },
      tokenBalance,
      statistics: {
        totalEvents,
        totalAirdrops,
        totalTokensDistributed: totalDistributed._sum.totalAmount?.toString() || "0",
      },
      recentEvents: user.vendorProfile.events.map((event) => ({
        id: event.id,
        name: event.name,
        status: event.status,
        whitelistCount: event._count.whitelistEntries,
        airdropCount: event._count.airdrops,
        createdAt: event.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /event/:id
 * Get event details
 */
router.get("/event/:id", authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        organizer: {
          select: {
            address: true,
            ensName: true,
          },
        },
        vendor: true,
        _count: {
          select: {
            whitelistEntries: true,
            airdrops: true,
          },
        },
      },
    });

    if (!event) {
      throw new AppError("Event not found", 404);
    }

    res.json({
      id: event.id,
      name: event.name,
      description: event.description,
      status: event.status,
      organizer: event.organizer,
      tokenBudget: event.tokenBudget.toString(),
      startDate: event.startDate,
      endDate: event.endDate,
      whitelistCount: event._count.whitelistEntries,
      airdropCount: event._count.airdrops,
      createdAt: event.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /vendor/events
 * Get all events for current vendor
 */
router.get("/vendor/events", authenticateToken, requireVendor, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;

    const events = await prisma.event.findMany({
      where: { organizerId: userId },
      include: {
        _count: {
          select: {
            whitelistEntries: true,
            airdrops: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      events: events.map((event) => ({
        id: event.id,
        name: event.name,
        status: event.status,
        whitelistCount: event._count.whitelistEntries,
        airdropCount: event._count.airdrops,
        createdAt: event.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;

