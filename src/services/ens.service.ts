import { ethers } from "ethers";
import { ContractService } from "./contract.service";
import { prisma } from "@/lib/prisma";
import { config } from "@/config/env";

export class ENSService {
  /**
   * Generate a unique subdomain label for a user
   */
  static generateSubdomainLabel(address: string): string {
    // Use first 8 characters of address (after 0x) + random suffix
    const shortAddress = address.slice(2, 10).toLowerCase();
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    return `${shortAddress}${randomSuffix}`;
  }

  /**
   * Check if an ENS subdomain is available
   */
  static async isSubdomainAvailable(label: string): Promise<boolean> {
    const existingUser = await prisma.user.findFirst({
      where: {
        ensName: {
          contains: label,
        },
      },
    });
    return !existingUser;
  }

  /**
   * Claim ENS subdomain for a user
   */
  static async claimSubdomain(address: string, customLabel?: string): Promise<string> {
    // Check if user already has an ENS name
    const existingUser = await prisma.user.findUnique({
      where: { address },
    });

    if (existingUser?.ensName) {
      return existingUser.ensName;
    }

    // Generate or use custom label
    let label = customLabel;
    if (!label) {
      label = this.generateSubdomainLabel(address);
    }

    // Check availability
    const available = await this.isSubdomainAvailable(label);
    if (!available && !customLabel) {
      // Retry with different random suffix
      label = this.generateSubdomainLabel(address);
    }

    // Construct full ENS name
    const ensName = `${label}.${config.ens.parentDomain}`;

    // Register on-chain via contract
    const txHash = await ContractService.registerSubdomain(label, address);

    // Update database
    await prisma.user.update({
      where: { address },
      data: { ensName },
    });

    return ensName;
  }

  /**
   * Resolve ENS name to address
   */
  static async resolveName(ensName: string): Promise<string | null> {
    try {
      // This would typically use ENS resolver, but for MVP we can check our DB
      const user = await prisma.user.findUnique({
        where: { ensName },
        select: { address: true },
      });

      return user?.address || null;
    } catch (error) {
      // Error resolving ENS name - return null
      return null;
    }
  }

  /**
   * Get ENS name from address (reverse lookup)
   */
  static async reverseResolve(address: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { address },
      select: { ensName: true },
    });

    return user?.ensName || null;
  }
}

