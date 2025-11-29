import { z } from "zod";
import { ethers } from "ethers";

/**
 * Validate Ethereum address
 */
const addressSchema = z.string().refine(
  (val) => ethers.isAddress(val),
  {
    message: "Invalid Ethereum address",
  }
);

/**
 * Validate ENS name format (basic)
 */
const ensNameSchema = z.string().regex(
  /^[a-z0-9-]+\.(eth|ourapp\.eth)$/i,
  "Invalid ENS name format"
);

/**
 * Validate amount (must be positive number or bigint string)
 */
const amountSchema = z.string().or(z.bigint()).refine(
  (val) => {
    try {
      const bigintVal = typeof val === "string" ? BigInt(val) : val;
      return bigintVal > 0n;
    } catch {
      return false;
    }
  },
  { message: "Amount must be a positive number" }
);

// Registration schemas
export const registerSchema = z.object({
  address: addressSchema,
  role: z.enum(["USER", "VENDOR"]).default("USER"),
  businessName: z.string().optional(),
  description: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
});

// Whitelist schemas
export const createWhitelistSchema = z.object({
  addresses: z.array(addressSchema).min(1, "At least one address required"),
  amounts: z.array(amountSchema).optional(),
});

export const uploadWhitelistCSVSchema = z.object({
  // This will be handled by multer for file upload
});

// Event schemas
export const createEventSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  description: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  tokenBudget: z.string().or(z.bigint()).optional(),
});

// Airdrop schemas
export const airdropSchema = z.object({
  eventId: z.string().cuid(),
  recipients: z.array(addressSchema).min(1),
  amounts: z.array(amountSchema).min(1),
});

export const airdropEqualSchema = z.object({
  eventId: z.string().cuid(),
  recipients: z.array(addressSchema).min(1),
  amount: amountSchema,
});

// ENS schemas
export const claimENSSchema = z.object({
  label: z.string().regex(/^[a-z0-9-]+$/i, "Invalid label format").optional(),
});

// Subscription schemas
export const createSubscriptionSchema = z.object({
  vendorAddress: addressSchema,
  planName: z.string().min(1),
  amountPerPeriod: amountSchema,
  periodDays: z.number().int().positive().default(30),
});

// Transfer schemas
export const transferSchema = z.object({
  toAddress: addressSchema.or(ensNameSchema),
  amount: amountSchema,
});

// Signed link schemas
export const generateLinkSchema = z.object({
  recipients: z.array(z.object({
    address: addressSchema,
    amount: amountSchema,
  })).min(1),
  expiresAt: z.string().datetime().optional(),
});

export const executeLinkSchema = z.object({
  signature: z.string().min(1),
});

