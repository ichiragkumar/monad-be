import { Router } from "express";
import multer from "multer";
import { prisma } from "@/lib/prisma";
import { ContractService } from "@/services/contract.service";
import { authenticateToken, requireVendor, AuthRequest } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validation.middleware";
import { createWhitelistSchema } from "@/utils/validation.schemas";
import { parseWhitelistCSV } from "@/utils/csv.utils";
import { normalizeAddress } from "@/utils/address.utils";
import { AppError } from "@/middleware/error.middleware";
import { z } from "zod";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /vendor/:id/whitelist
 * Add addresses to event whitelist (JSON or CSV)
 */
router.post(
  "/vendor/:id/whitelist",
  authenticateToken,
  requireVendor,
  async (req: AuthRequest, res, next) => {
    try {
      const { id: eventId } = req.params;
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

      const { addresses, amounts } = req.body;

      if (!Array.isArray(addresses) || addresses.length === 0) {
        throw new AppError("Addresses array is required", 400);
      }

      // Normalize addresses
      const normalizedAddresses = addresses.map((addr) => normalizeAddress(addr));

      // Check for existing entries
      const existingEntries = await prisma.whitelistEntry.findMany({
        where: {
          eventId,
          address: { in: normalizedAddresses },
        },
      });

      const existingAddresses = new Set(existingEntries.map((e) => e.address));

      // Prepare entries to create
      const entriesToCreate = normalizedAddresses
        .filter((addr) => !existingAddresses.has(addr))
        .map((address, index) => ({
          eventId,
          address,
          amount: amounts && amounts[index] ? BigInt(amounts[index]) : null,
        }));

      if (entriesToCreate.length === 0) {
        return res.json({
          message: "All addresses already in whitelist",
          added: 0,
          skipped: normalizedAddresses.length,
        });
      }

      // Create whitelist entries
      await prisma.whitelistEntry.createMany({
        data: entriesToCreate,
      });

      res.status(201).json({
        message: "Whitelist entries added",
        added: entriesToCreate.length,
        skipped: normalizedAddresses.length - entriesToCreate.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /vendor/:id/whitelist/upload
 * Upload CSV file with whitelist addresses
 */
router.post(
  "/vendor/:id/whitelist/upload",
  authenticateToken,
  requireVendor,
  upload.single("file"),
  async (req: AuthRequest, res, next) => {
    try {
      const { id: eventId } = req.params;
      const vendorAddress = req.user!.address;

      if (!req.file) {
        throw new AppError("CSV file is required", 400);
      }

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

      // Parse CSV
      const rows = parseWhitelistCSV(req.file.buffer);

      if (rows.length === 0) {
        throw new AppError("CSV file is empty", 400);
      }

      // Normalize addresses and prepare entries
      const entriesToCreate = [];
      for (const row of rows) {
        try {
          const address = normalizeAddress(row.address);
          entriesToCreate.push({
            eventId,
            address,
            amount: row.amount ? BigInt(row.amount) : null,
          });
        } catch (error) {
          // Skip invalid addresses
          console.warn(`Skipping invalid address: ${row.address}`);
        }
      }

      if (entriesToCreate.length === 0) {
        throw new AppError("No valid addresses found in CSV", 400);
      }

      // Check existing
      const existingAddresses = new Set(
        (
          await prisma.whitelistEntry.findMany({
            where: {
              eventId,
              address: { in: entriesToCreate.map((e) => e.address) },
            },
          })
        ).map((e) => e.address)
      );

      const newEntries = entriesToCreate.filter(
        (e) => !existingAddresses.has(e.address)
      );

      if (newEntries.length > 0) {
        await prisma.whitelistEntry.createMany({
          data: newEntries,
        });
      }

      res.status(201).json({
        message: "Whitelist uploaded",
        added: newEntries.length,
        skipped: entriesToCreate.length - newEntries.length,
        total: entriesToCreate.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /vendor/:id/whitelist
 * Get whitelist for an event
 */
router.get("/vendor/:id/whitelist", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id: eventId } = req.params;

    const entries = await prisma.whitelistEntry.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            address: true,
            ensName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      eventId,
      count: entries.length,
      entries: entries.map((entry) => ({
        id: entry.id,
        address: entry.address,
        ensName: entry.user?.ensName,
        amount: entry.amount?.toString(),
        claimed: entry.claimed,
        createdAt: entry.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /vendor/:id/whitelist/:entryId
 * Remove an entry from whitelist
 */
router.delete(
  "/vendor/:id/whitelist/:entryId",
  authenticateToken,
  requireVendor,
  async (req: AuthRequest, res, next) => {
    try {
      const { id: eventId, entryId } = req.params;
      const vendorAddress = req.user!.address;

      // Verify event ownership
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: { organizer: true },
      });

      if (!event || event.organizer.address !== vendorAddress) {
        throw new AppError("Unauthorized", 403);
      }

      await prisma.whitelistEntry.delete({
        where: { id: entryId },
      });

      res.json({ message: "Whitelist entry removed" });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

