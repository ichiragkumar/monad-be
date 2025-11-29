import { ethers } from "ethers";
import { ENSService } from "@/services/ens.service";

/**
 * Normalize Ethereum address (checksum)
 */
export const normalizeAddress = (address: string): string => {
  if (!ethers.isAddress(address)) {
    throw new Error("Invalid Ethereum address");
  }
  return ethers.getAddress(address);
};

/**
 * Resolve address from ENS name or return address if already an address
 */
export const resolveAddress = async (input: string): Promise<string> => {
  // If it's already an address, normalize and return
  if (ethers.isAddress(input)) {
    return normalizeAddress(input);
  }

  // Try to resolve as ENS name
  const resolved = await ENSService.resolveName(input);
  if (resolved) {
    return normalizeAddress(resolved);
  }

  throw new Error(`Could not resolve address: ${input}`);
};

