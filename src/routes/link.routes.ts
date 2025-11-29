import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { ContractService } from "@/services/contract.service";
import { authenticateToken, AuthRequest } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validation.middleware";
import { generateLinkSchema, executeLinkSchema } from "@/utils/validation.schemas";
import { signPayload, verifySignature, generateNonce } from "@/utils/eip712.utils";
import { normalizeAddress } from "@/utils/address.utils";
import { AppError } from "@/middleware/error.middleware";
import { nanoid } from "nanoid";

const router = Router();

/**
 * POST /link/generate
 * Generate a signed link for batch/delayed transactions
 */
router.post(
  "/link/generate",
  authenticateToken,
  validate(generateLinkSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { recipients, expiresAt } = req.body;
      const creatorAddress = req.user!.address;

      // Normalize addresses
      const normalizedRecipients = recipients.map((r: { address: string; amount: string }) => ({
        address: normalizeAddress(r.address),
        amount: r.amount,
      }));

      // Calculate total amount
      const totalAmount = normalizedRecipients.reduce(
        (sum: bigint, r: { amount: string }) => sum + BigInt(r.amount),
        0n
      );

      // Generate nonce
      const nonce = generateNonce();

      // Create payload
      const payload = {
        recipients: normalizedRecipients,
        nonce,
        expiresAt: expiresAt || null,
      };

      // Sign payload
      const signature = await signPayload(payload);

      // Generate unique link ID
      const linkId = nanoid(12);

      // Store signed link
      await prisma.signedLink.create({
        data: {
          linkId,
          creatorAddress,
          payload: payload as any,
          signature,
          recipients: normalizedRecipients as any,
          totalAmount,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      });

      res.status(201).json({
        linkId,
        payload,
        signature,
        expiresAt: expiresAt || null,
        message: "Signed link generated",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /link/:id
 * Get signed link payload
 */
router.get("/link/:id", async (req, res, next) => {
  try {
    const { id: linkId } = req.params;

    const link = await prisma.signedLink.findUnique({
      where: { linkId },
    });

    if (!link) {
      throw new AppError("Link not found", 404);
    }

    if (link.executed) {
      throw new AppError("Link has already been executed", 400);
    }

    if (link.expiresAt && new Date() > link.expiresAt) {
      throw new AppError("Link has expired", 400);
    }

    res.json({
      linkId: link.linkId,
      payload: link.payload,
      signature: link.signature,
      recipients: link.recipients,
      totalAmount: link.totalAmount.toString(),
      expiresAt: link.expiresAt,
      creatorAddress: link.creatorAddress,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /link/:id/execute
 * Execute a signed link transaction
 */
router.post(
  "/link/:id/execute",
  authenticateToken,
  validate(executeLinkSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { id: linkId } = req.params;
      const { signature: userSignature } = req.body;
      const executorAddress = req.user!.address;

      const link = await prisma.signedLink.findUnique({
        where: { linkId },
      });

      if (!link) {
        throw new AppError("Link not found", 404);
      }

      if (link.executed) {
        throw new AppError("Link has already been executed", 400);
      }

      if (link.expiresAt && new Date() > link.expiresAt) {
        throw new AppError("Link has expired", 400);
      }

      // Verify backend signature
      const isValid = verifySignature(
        link.payload as any,
        link.signature,
        link.creatorAddress
      );

      if (!isValid) {
        throw new AppError("Invalid link signature", 400);
      }

      // Extract recipients and amounts
      const recipients = (link.recipients as any[]).map((r) => r.address);
      const amounts = (link.recipients as any[]).map((r) => BigInt(r.amount));

      // Execute airdrop (or transfer batch)
      // Note: This assumes the creator has approved tokens
      const txHash = await ContractService.executeAirdrop(
        link.creatorAddress,
        recipients,
        amounts,
        "" // No event ID for link-based transactions
      );

      // Mark link as executed
      await prisma.signedLink.update({
        where: { linkId },
        data: {
          executed: true,
          executedAt: new Date(),
          executedTxHash: txHash,
        },
      });

      res.json({
        message: "Link executed successfully",
        linkId,
        txHash,
        recipientCount: recipients.length,
        totalAmount: link.totalAmount.toString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

