import { Router } from "express";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { config } from "@/config/env";
import { validate } from "@/middleware/validation.middleware";
import { registerSchema } from "@/utils/validation.schemas";
import { normalizeAddress } from "@/utils/address.utils";
import { AppError } from "@/middleware/error.middleware";
import { authenticateToken, AuthRequest } from "@/middleware/auth.middleware";

const router = Router();

/**
 * POST /register
 * Register a new user or vendor
 */
router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const { address, role, businessName, description, website } = req.body;

    const normalizedAddress = normalizeAddress(address);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { address: normalizedAddress },
    });

    if (existingUser) {
      throw new AppError("User already registered", 409);
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        address: normalizedAddress,
        role: role || "USER",
        ...(role === "VENDOR" && {
          vendorProfile: {
            create: {
              businessName,
              description,
              website: website || null,
            },
          },
        }),
      },
      include: {
        vendorProfile: role === "VENDOR",
      },
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        address: user.address,
        userId: user.id,
        role: user.role,
      },
      config.auth.jwtSecret,
      { expiresIn: config.auth.jwtExpiresIn }
    );

    res.status(201).json({
      user: {
        id: user.id,
        address: user.address,
        ensName: user.ensName,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /me
 * Get current user profile
 */
router.get("/me", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        vendorProfile: true,
      },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    res.json({
      id: user.id,
      address: user.address,
      ensName: user.ensName,
      role: user.role,
      vendorProfile: user.vendorProfile,
      createdAt: user.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

