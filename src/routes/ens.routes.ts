import { Router } from "express";
import { ENSService } from "@/services/ens.service";
import { authenticateToken, AuthRequest } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validation.middleware";
import { claimENSSchema } from "@/utils/validation.schemas";
import { AppError } from "@/middleware/error.middleware";

const router = Router();

/**
 * POST /ens/claim
 * Claim ENS subdomain for current user
 */
router.post(
  "/ens/claim",
  authenticateToken,
  validate(claimENSSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { label } = req.body;
      const address = req.user!.address;

      const ensName = await ENSService.claimSubdomain(address, label);

      res.status(201).json({
        message: "ENS subdomain claimed successfully",
        ensName,
        address,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /ens/resolve/:name
 * Resolve ENS name to address
 */
router.get("/ens/resolve/:name", async (req, res, next) => {
  try {
    const { name } = req.params;

    const address = await ENSService.resolveName(name);

    if (!address) {
      throw new AppError("ENS name not found", 404);
    }

    res.json({
      name,
      address,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /ens/reverse/:address
 * Get ENS name for address (reverse lookup)
 */
router.get("/ens/reverse/:address", async (req, res, next) => {
  try {
    const { address } = req.params;

    const ensName = await ENSService.reverseResolve(address);

    res.json({
      address,
      ensName: ensName || null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /ens/status
 * Get ENS status for current user
 */
router.get("/ens/status", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const address = req.user!.address;

    const ensName = await ENSService.reverseResolve(address);

    res.json({
      address,
      ensName: ensName || null,
      hasENS: !!ensName,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

