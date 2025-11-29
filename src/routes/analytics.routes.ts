import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { authenticateToken } from "@/middleware/auth.middleware";

const router = Router();

/**
 * GET /stats
 * Get platform-wide statistics
 */
router.get("/stats", authenticateToken, async (req, res, next) => {
  try {
    // Get date range (default: last 30 days)
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // User statistics
    const totalUsers = await prisma.user.count();
    const totalVendors = await prisma.user.count({
      where: { role: "VENDOR" },
    });
    const newUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
    });

    // Transaction statistics
    const totalTransactions = await prisma.transaction.count({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
    });

    const transactionVolume = await prisma.transaction.aggregate({
      where: {
        createdAt: {
          gte: startDate,
        },
        status: "CONFIRMED",
      },
      _sum: {
        amount: true,
      },
    });

    const transactionStats = await prisma.transaction.groupBy({
      by: ["type"],
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      _count: {
        id: true,
      },
      _sum: {
        amount: true,
      },
    });

    // Event statistics
    const totalEvents = await prisma.event.count({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
    });

    const activeEvents = await prisma.event.count({
      where: {
        status: "ACTIVE",
      },
    });

    // Airdrop statistics
    const totalAirdrops = await prisma.airdrop.count({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
    });

    const airdropVolume = await prisma.airdrop.aggregate({
      where: {
        createdAt: {
          gte: startDate,
        },
        status: "CONFIRMED",
      },
      _sum: {
        totalAmount: true,
        recipientCount: true,
      },
    });

    const totalRecipients = await prisma.airdrop.aggregate({
      where: {
        createdAt: {
          gte: startDate,
        },
        status: "CONFIRMED",
      },
      _sum: {
        recipientCount: true,
      },
    });

    // Daily transaction count (last 7 days)
    const dailyTransactions = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = await prisma.transaction.count({
        where: {
          createdAt: {
            gte: date,
            lt: nextDate,
          },
          status: "CONFIRMED",
        },
      });

      dailyTransactions.push({
        date: date.toISOString().split("T")[0],
        count,
      });
    }

    res.json({
      period: {
        days,
        startDate,
        endDate: new Date(),
      },
      users: {
        total: totalUsers,
        vendors: totalVendors,
        newUsers,
      },
      transactions: {
        total: totalTransactions,
        volume: transactionVolume._sum.amount?.toString() || "0",
        byType: transactionStats.map((stat) => ({
          type: stat.type,
          count: stat._count.id,
          volume: stat._sum.amount?.toString() || "0",
        })),
        daily: dailyTransactions,
      },
      events: {
        total,
        active: activeEvents,
      },
      airdrops: {
        total: totalAirdrops,
        totalVolume: airdropVolume._sum.totalAmount?.toString() || "0",
        totalRecipients: totalRecipients._sum.recipientCount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /stats/vendor/:id
 * Get vendor-specific statistics
 */
router.get("/stats/vendor/:id", authenticateToken, async (req, res, next) => {
  try {
    const vendorAddress = req.params.id; // Address or vendor ID

    // Find vendor by address or ID
    const vendor = await prisma.user.findFirst({
      where: {
        OR: [
          { address: vendorAddress },
          { vendorProfile: { id: vendorAddress } },
        ],
      },
      include: {
        vendorProfile: true,
      },
    });

    if (!vendor || vendor.role !== "VENDOR") {
      return res.status(404).json({ error: "Vendor not found" });
    }

    // Vendor events
    const totalEvents = await prisma.event.count({
      where: { organizerId: vendor.id },
    });

    const activeEvents = await prisma.event.count({
      where: {
        organizerId: vendor.id,
        status: "ACTIVE",
      },
    });

    // Vendor airdrops
    const totalAirdrops = await prisma.airdrop.count({
      where: { vendorAddress: vendor.address },
    });

    const airdropVolume = await prisma.airdrop.aggregate({
      where: { vendorAddress: vendor.address },
      _sum: {
        totalAmount: true,
        recipientCount: true,
      },
    });

    // Recent activity
    const recentAirdrops = await prisma.airdrop.findMany({
      where: { vendorAddress: vendor.address },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        event: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({
      vendor: {
        address: vendor.address,
        businessName: vendor.vendorProfile?.businessName,
      },
      events: {
        total: totalEvents,
        active: activeEvents,
      },
      airdrops: {
        total: totalAirdrops,
        totalVolume: airdropVolume._sum.totalAmount?.toString() || "0",
        totalRecipients: airdropVolume._sum.recipientCount || 0,
        recent: recentAirdrops.map((airdrop) => ({
          id: airdrop.id,
          event: airdrop.event,
          recipientCount: airdrop.recipientCount,
          totalAmount: airdrop.totalAmount.toString(),
          status: airdrop.status,
          createdAt: airdrop.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

