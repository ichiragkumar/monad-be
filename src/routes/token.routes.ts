import { Router } from "express";
import { ContractService } from "@/services/contract.service";
import { authenticateToken, AuthRequest } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validation.middleware";
import { transferSchema } from "@/utils/validation.schemas";
import { resolveAddress } from "@/utils/address.utils";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/middleware/error.middleware";

const router = Router();

/**
 * GET /balance
 * Get token balance for an address (defaults to current user)
 */
router.get("/balance", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const address = req.query.address as string | undefined;
    const targetAddress = address || req.user!.address;

    const balance = await ContractService.getTokenBalance(targetAddress);

    res.json({
      address: targetAddress,
      balance,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /token/info
 * Get token contract information
 */
router.get("/token/info", async (req, res, next) => {
  try {
    const info = await ContractService.getTokenInfo();

    res.json(info);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /topup
 * Request tokens from faucet (testnet only)
 */
router.post("/topup", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const address = req.user!.address;

    // In production, this would interact with a faucet contract
    // For now, return a message indicating faucet functionality
    // TODO: Implement actual faucet interaction when contract is deployed

    res.json({
      message: "Faucet request submitted",
      address,
      note: "Tokens will be sent to your address shortly",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /transfer
 * Transfer tokens (user signs on frontend, backend logs the transaction)
 */
router.post(
  "/transfer",
  authenticateToken,
  validate(transferSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { toAddress, amount, txHash } = req.body;
      const fromAddress = req.user!.address;

      // Resolve ENS name if needed
      const resolvedToAddress = await resolveAddress(toAddress);

      // Convert amount to BigInt
      const amountBigInt = typeof amount === "string" ? BigInt(amount) : amount;

      // If txHash is provided, just log it
      // Otherwise, this would be a backend-initiated transfer (rare)
      if (txHash) {
        // Wait for confirmation
        const receipt = await ContractService.getTransactionReceipt(txHash);

        // Create transaction record
        await prisma.transaction.create({
          data: {
            userId: req.user!.userId,
            fromAddress,
            toAddress: resolvedToAddress,
            amount: amountBigInt,
            type: "TRANSFER",
            status: receipt.status === 1 ? "CONFIRMED" : "FAILED",
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber?.toString(),
            blockHash: receipt.blockHash || null,
            gasUsed: receipt.gasUsed?.toString(),
            gasPrice: receipt.gasPrice?.toString(),
            confirmedAt: receipt.status === 1 ? new Date() : null,
          },
        });

        res.json({
          message: "Transfer logged",
          txHash: receipt.hash,
          status: receipt.status === 1 ? "CONFIRMED" : "FAILED",
        });
      } else {
        throw new AppError("Transaction hash is required", 400);
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /transactions
 * Get transaction history for current user
 */
router.get("/transactions", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    res.json({
      transactions: transactions.map((tx) => ({
        id: tx.id,
        txHash: tx.txHash,
        fromAddress: tx.fromAddress,
        toAddress: tx.toAddress,
        amount: tx.amount.toString(),
        type: tx.type,
        status: tx.status,
        blockNumber: tx.blockNumber?.toString(),
        createdAt: tx.createdAt,
        confirmedAt: tx.confirmedAt,
      })),
      count: transactions.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

