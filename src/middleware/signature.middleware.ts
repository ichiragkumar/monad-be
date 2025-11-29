import { Request, Response, NextFunction } from "express";
import { ethers } from "ethers";
import { sendError, ErrorCode } from "@/utils/response.util";

/**
 * Verify EIP-712 signature for wallet authentication
 */
export const verifyWalletSignature = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { walletAddress, signature, message, timestamp } = req.body;

    if (!walletAddress || !signature || !message) {
      return sendError(
        res,
        ErrorCode.INVALID_PARAMETERS,
        "Missing required fields: walletAddress, signature, message",
        400
      );
    }

    // Check timestamp (prevent replay attacks)
    if (timestamp) {
      const now = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(now - timestamp);
      if (timeDiff > 300) {
        // 5 minutes
        return sendError(
          res,
          ErrorCode.INVALID_PARAMETERS,
          "Signature timestamp expired",
          400
        );
      }
    }

    // Verify signature
    // For EIP-712, we would verify the typed data signature
    // For now, we'll use a simple message signature verification
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      const normalizedWallet = ethers.getAddress(walletAddress);
      const normalizedRecovered = ethers.getAddress(recoveredAddress);

      if (normalizedWallet.toLowerCase() !== normalizedRecovered.toLowerCase()) {
        return sendError(
          res,
          ErrorCode.INVALID_SIGNATURE,
          "Signature verification failed",
          401
        );
      }

      // Add verified address to request
      (req as any).verifiedAddress = normalizedWallet;
      next();
    } catch (error) {
      return sendError(
        res,
        ErrorCode.INVALID_SIGNATURE,
        "Invalid signature format",
        401
      );
    }
  } catch (error) {
    return sendError(
      res,
      ErrorCode.INTERNAL_ERROR,
      "Error verifying signature",
      500
    );
  }
};

