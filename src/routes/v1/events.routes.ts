import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { sendSuccess, sendError, ErrorCode, sendPaginated } from "@/utils/response.util";
import { normalizeAddress } from "@/utils/address.utils";
import { z } from "zod";
import { validate } from "@/middleware/validation.middleware";

const router = Router();

const createEventSchema = z.object({
  vendorAddress: z.string(),
  name: z.string(),
  description: z.string().optional(),
  eventDate: z.string().datetime().optional(),
  status: z.enum(["draft", "active", "completed"]).default("draft"),
  metadata: z.object({}).passthrough().optional(),
});

/**
 * POST /api/v1/events
 * Create event
 */
router.post("/", validate(createEventSchema), async (req, res, next) => {
  try {
    const { vendorAddress, name, description, eventDate, status, metadata } = req.body;

    const normalizedVendor = normalizeAddress(vendorAddress);

    // Ensure user exists
    const user = await prisma.user.upsert({
      where: { address: normalizedVendor },
      update: {},
      create: { address: normalizedVendor, role: "VENDOR" },
    });

    // Get or create vendor profile
    let vendor = await prisma.vendor.findUnique({
      where: { userId: user.id },
    });

    if (!vendor) {
      vendor = await prisma.vendor.create({
        data: { userId: user.id },
      });
    }

    const event = await prisma.event.create({
      data: {
        vendorAddress: normalizedVendor,
        vendorId: vendor.id,
        organizerId: user.id,
        name,
        description,
        eventDate: eventDate ? new Date(eventDate) : null,
        status: status.toUpperCase(),
        metadata: metadata || {},
        participantCount: 0,
        totalDistributed: "0",
      },
    });

    return sendSuccess(
      res,
      {
        eventId: event.id,
        vendorAddress: event.vendorAddress,
        name: event.name,
        status: event.status.toLowerCase(),
        createdAt: event.createdAt,
      },
      201
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/events
 * Get vendor events
 */
router.get("/", async (req, res, next) => {
  try {
    const { vendorAddress, status, page = "1", limit = "20" } = req.query;

    if (!vendorAddress) {
      return sendError(
        res,
        ErrorCode.INVALID_PARAMETERS,
        "vendorAddress is required",
        400
      );
    }

    const normalizedAddress = normalizeAddress(vendorAddress as string);
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;

    const where: any = { vendorAddress: normalizedAddress };
    if (status) {
      where.status = (status as string).toUpperCase();
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.event.count({ where }),
    ]);

    const formatted = events.map((event) => ({
      eventId: event.id,
      name: event.name,
      description: event.description,
      status: event.status.toLowerCase(),
      participantCount: event.participantCount,
      totalDistributed: event.totalDistributed,
      createdAt: event.createdAt,
    }));

    return sendPaginated(res, formatted, pageNum, limitNum, total);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/events/:eventId
 * Update event
 */
router.patch("/:eventId", async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { name, description, status } = req.body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status) updateData.status = status.toUpperCase();

    const event = await prisma.event.update({
      where: { id: eventId },
      data: updateData,
    });

    return sendSuccess(res, {
      eventId: event.id,
      name: event.name,
      description: event.description,
      status: event.status.toLowerCase(),
      updatedAt: event.updatedAt,
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      return sendError(res, ErrorCode.NOT_FOUND, "Event not found", 404);
    }
    next(error);
  }
});

/**
 * DELETE /api/v1/events/:eventId
 * Delete event
 */
router.delete("/:eventId", async (req, res, next) => {
  try {
    await prisma.event.delete({
      where: { id: req.params.eventId },
    });

    return sendSuccess(res, { message: "Event deleted successfully" });
  } catch (error: any) {
    if (error.code === "P2025") {
      return sendError(res, ErrorCode.NOT_FOUND, "Event not found", 404);
    }
    next(error);
  }
});

/**
 * POST /api/v1/events/:eventId/participants
 * Add event participants
 */
router.post("/:eventId/participants", async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { participants } = req.body;

    if (!Array.isArray(participants)) {
      return sendError(
        res,
        ErrorCode.INVALID_PARAMETERS,
        "participants must be an array",
        400
      );
    }

    const added = [];
    const skipped = [];

    for (const participant of participants) {
      try {
        const normalizedAddress = normalizeAddress(participant.address);
        await prisma.eventParticipant.create({
          data: {
            eventId,
            address: normalizedAddress,
            ensName: participant.ensName || null,
            amount: participant.amount || null,
          },
        });
        added.push(normalizedAddress);
      } catch (error: any) {
        if (error.code === "P2002") {
          skipped.push(participant.address);
        } else {
          throw error;
        }
      }
    }

    // Update participant count
    const count = await prisma.eventParticipant.count({
      where: { eventId },
    });

    await prisma.event.update({
      where: { id: eventId },
      data: { participantCount: count },
    });

    return sendSuccess(res, {
      addedCount: added.length,
      totalParticipants: count,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/events/:eventId/participants
 * Get event participants
 */
router.get("/:eventId/participants", async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { page = "1", limit = "50" } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [participants, total] = await Promise.all([
      prisma.eventParticipant.findMany({
        where: { eventId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.eventParticipant.count({ where: { eventId } }),
    ]);

    const formatted = participants.map((p) => ({
      address: p.address,
      ensName: p.ensName,
      amount: p.amount,
      createdAt: p.createdAt,
    }));

    return sendPaginated(res, formatted, pageNum, limitNum, total);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/events/participant/:walletAddress
 * Get all events where user is a participant
 */
router.get("/participant/:walletAddress", async (req, res, next) => {
  try {
    const { walletAddress } = req.params;
    const { page = "1", limit = "20", status } = req.query;

    const normalizedAddress = normalizeAddress(walletAddress);
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Build where clause for events
    const eventWhere: any = {};
    if (status) {
      eventWhere.status = (status as string).toUpperCase();
    }

    // Get participant entries for this address
    const participantWhere: any = {
      address: normalizedAddress,
    };

    if (Object.keys(eventWhere).length > 0) {
      participantWhere.event = eventWhere;
    }

    const [participants, total] = await Promise.all([
      prisma.eventParticipant.findMany({
        where: participantWhere,
        include: {
          event: {
            include: {
              organizer: {
                select: {
                  address: true,
                  ensName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.eventParticipant.count({
        where: participantWhere,
      }),
    ]);

    // Get participant counts and totals for each event
    const eventIds = participants.map((p) => p.eventId);
    const eventStats = await Promise.all(
      eventIds.map(async (eventId) => {
        const [participantCount, rewards] = await Promise.all([
          prisma.eventParticipant.count({ where: { eventId } }),
          prisma.reward.aggregate({
            where: { eventId, status: "CONFIRMED" },
            _sum: { totalAmount: true },
          }),
        ]);

        return {
          eventId,
          participantCount,
          totalDistributed: rewards._sum.totalAmount || "0",
        };
      })
    );

    const statsMap = new Map(eventStats.map((s) => [s.eventId, s]));

    const formatted = participants.map((participant) => {
      const stats = statsMap.get(participant.eventId) || {
        participantCount: 0,
        totalDistributed: "0",
      };

      return {
        eventId: participant.event.id,
        event: {
          id: participant.event.id,
          name: participant.event.name,
          description: participant.event.description,
          status: participant.event.status.toLowerCase(),
          startDate: participant.event.eventDate,
          endDate: null, // Not in schema, could add
          organizer: participant.event.organizer
            ? {
                address: participant.event.organizer.address,
                ensName: participant.event.organizer.ensName,
              }
            : null,
        },
        participant: {
          address: participant.address,
          amount: participant.amount,
          claimed: false, // Could add claim logic later
          addedAt: participant.createdAt,
        },
        participantCount: stats.participantCount,
        totalDistributed: stats.totalDistributed,
      };
    });

    return sendPaginated(res, formatted, pageNum, limitNum, total);
  } catch (error) {
    next(error);
  }
});

export default router;

