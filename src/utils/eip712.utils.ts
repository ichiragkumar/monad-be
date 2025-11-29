import { ethers } from "ethers";
import { getBackendWallet } from "@/lib/ethers";
import { config } from "@/config/env";

export interface LinkPayload {
  recipients: Array<{ address: string; amount: string }>;
  nonce: string;
  expiresAt?: string;
}

/**
 * EIP-712 domain for signed links
 */
const getDomain = () => ({
  name: "Monad Micropayments",
  version: "1",
  chainId: config.monad.chainId,
  verifyingContract: config.contracts.token || "",
});

/**
 * EIP-712 types for batch transfer
 */
const types = {
  BatchTransfer: [
    { name: "recipients", type: "Recipient[]" },
    { name: "nonce", type: "string" },
    { name: "expiresAt", type: "string" },
  ],
  Recipient: [
    { name: "address", type: "address" },
    { name: "amount", type: "uint256" },
  ],
};

/**
 * Generate EIP-712 typed data for batch transfer
 */
export const generateTypedData = (payload: LinkPayload) => {
  return {
    types,
    domain: getDomain(),
    primaryType: "BatchTransfer",
    message: {
      recipients: payload.recipients.map((r) => ({
        address: r.address,
        amount: ethers.parseUnits(r.amount.toString(), 18), // Assuming 18 decimals
      })),
      nonce: payload.nonce,
      expiresAt: payload.expiresAt || "",
    },
  };
};

/**
 * Sign payload with backend wallet
 */
export const signPayload = async (payload: LinkPayload): Promise<string> => {
  const wallet = getBackendWallet();
  const typedData = generateTypedData(payload);
  const signature = await wallet.signTypedData(
    typedData.domain,
    typedData.types,
    typedData.message
  );
  return signature;
};

/**
 * Verify signature
 */
export const verifySignature = (
  payload: LinkPayload,
  signature: string,
  expectedSigner: string
): boolean => {
  try {
    const typedData = generateTypedData(payload);
    const recoveredAddress = ethers.verifyTypedData(
      typedData.domain,
      typedData.types,
      typedData.message,
      signature
    );
    return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
  } catch {
    return false;
  }
};

/**
 * Generate unique nonce
 */
export const generateNonce = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

