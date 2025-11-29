import { ethers } from "ethers";
import { config } from "@/config/env";
import {
  getContract,
  getContractWithSigner,
  ERC20_ABI,
  REWARD_DISTRIBUTOR_ABI,
  VENDOR_REGISTRY_ABI,
  ENS_REGISTRAR_ABI,
  waitForTransaction,
} from "@/lib/ethers";
import { prisma } from "@/lib/prisma";

export class ContractService {
  // Token operations
  static async getTokenBalance(address: string, tokenAddress?: string): Promise<string> {
    const tokenAddr = tokenAddress || config.contracts.token;
    if (!tokenAddr) throw new Error("Token contract address not configured");

    const contract = getContract(tokenAddr, ERC20_ABI);
    const balance = await contract.balanceOf(address);
    return balance.toString();
  }

  static async getTokenInfo(tokenAddress?: string) {
    const tokenAddr = tokenAddress || config.contracts.token;
    if (!tokenAddr) throw new Error("Token contract address not configured");

    const contract = getContract(tokenAddr, ERC20_ABI);
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
      contract.totalSupply(),
    ]);

    return {
      address: tokenAddr,
      name,
      symbol,
      decimals: Number(decimals),
      totalSupply: totalSupply.toString(),
    };
  }

  // Reward Distributor operations
  static async executeAirdrop(
    vendorAddress: string,
    recipients: string[],
    amounts: bigint[],
    eventId: string
  ): Promise<string> {
    if (!config.contracts.rewardDistributor) {
      throw new Error("RewardDistributor contract address not configured");
    }
    if (!config.contracts.token) {
      throw new Error("Token contract address not configured");
    }
    if (recipients.length !== amounts.length) {
      throw new Error("Recipients and amounts arrays must have the same length");
    }

    const contract = getContractWithSigner(config.contracts.rewardDistributor, REWARD_DISTRIBUTOR_ABI);

    // Execute airdrop
    const tx = await contract.airdrop(config.contracts.token, recipients, amounts);
    const receipt = await waitForTransaction(tx.hash);
    if (!receipt) {
      throw new Error("Transaction receipt not found");
    }

    // Calculate total amount
    const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0n);

    // Note: Airdrop table removed - using Reward model instead
    // Create transaction records
    if (receipt && receipt.status === 1) {
      const transactions = recipients.map((recipient, index) => ({
        txHash: `${receipt.hash}-${index}`,
        fromAddress: vendorAddress,
        toAddress: recipient,
        amount: amounts[index].toString(),
        token: "XTK",
        type: "REWARD" as const,
        status: "CONFIRMED" as const,
        syncStatus: "SYNCED" as const,
        blockNumber: receipt.blockNumber ? BigInt(receipt.blockNumber) : null,
        blockHash: receipt.blockHash || null,
        gasUsed: receipt.gasUsed?.toString(),
        gasPrice: receipt.gasPrice?.toString(),
        metadata: {
          eventId,
          recipientIndex: index,
        },
        confirmedAt: new Date(),
      }));

      await prisma.transaction.createMany({
        data: transactions,
      });
    }

    return receipt.hash;
  }

  static async executeAirdropEqual(
    vendorAddress: string,
    recipients: string[],
    amount: bigint,
    eventId: string
  ): Promise<string> {
    if (!config.contracts.rewardDistributor) {
      throw new Error("RewardDistributor contract address not configured");
    }
    if (!config.contracts.token) {
      throw new Error("Token contract address not configured");
    }

    const contract = getContractWithSigner(config.contracts.rewardDistributor, REWARD_DISTRIBUTOR_ABI);

    const tx = await contract.airdropEqual(config.contracts.token, recipients, amount);
    const receipt = await waitForTransaction(tx.hash);
    if (!receipt) {
      throw new Error("Transaction receipt not found");
    }

    const totalAmount = amount * BigInt(recipients.length);

    // Note: Airdrop table removed - using Reward model instead
    // Create transaction records
    if (receipt && receipt.status === 1) {
      const transactions = recipients.map((recipient, index) => ({
        txHash: `${receipt.hash}-${index}`,
        fromAddress: vendorAddress,
        toAddress: recipient,
        amount: amount.toString(),
        token: "XTK",
        type: "REWARD" as const,
        status: "CONFIRMED" as const,
        syncStatus: "SYNCED" as const,
        blockNumber: receipt.blockNumber ? BigInt(receipt.blockNumber) : null,
        blockHash: receipt.blockHash || null,
        gasUsed: receipt.gasUsed?.toString(),
        gasPrice: receipt.gasPrice?.toString(),
        metadata: { eventId },
        confirmedAt: new Date(),
      }));

      await prisma.transaction.createMany({
        data: transactions,
      });
    }

    return receipt.hash;
  }

  // Vendor Registry operations
  static async registerVendor(vendorAddress: string, businessName: string): Promise<string> {
    if (!config.contracts.vendorRegistry) {
      throw new Error("VendorRegistry contract address not configured");
    }

    const contract = getContractWithSigner(config.contracts.vendorRegistry, VENDOR_REGISTRY_ABI);
    const tx = await contract.registerVendor(vendorAddress, businessName);
    const receipt = await waitForTransaction(tx.hash);
    if (!receipt) {
      throw new Error("Transaction receipt not found");
    }

    return receipt.hash;
  }

  static async isVendor(vendorAddress: string): Promise<boolean> {
    if (!config.contracts.vendorRegistry) {
      throw new Error("VendorRegistry contract address not configured");
    }

    const contract = getContract(config.contracts.vendorRegistry, VENDOR_REGISTRY_ABI);
    return await contract.isVendor(vendorAddress);
  }

  // ENS operations
  static async registerSubdomain(label: string, ownerAddress: string): Promise<string> {
    if (!config.contracts.ensSubdomainRegistrar) {
      throw new Error("ENSSubdomainRegistrar contract address not configured");
    }

    const contract = getContractWithSigner(config.contracts.ensSubdomainRegistrar, ENS_REGISTRAR_ABI);
    const tx = await contract.registerSubdomain(label, ownerAddress);
    const receipt = await waitForTransaction(tx.hash);
    if (!receipt) {
      throw new Error("Transaction receipt not found");
    }

    return receipt.hash;
  }

  // Transfer tokens (for manual transfers)
  static async transferTokens(fromAddress: string, toAddress: string, amount: bigint): Promise<string> {
    if (!config.contracts.token) {
      throw new Error("Token contract address not configured");
    }

    // This assumes the backend wallet has approval or is the owner
    // In production, users would sign their own transactions
    const contract = getContractWithSigner(config.contracts.token, ERC20_ABI);
    const tx = await contract.transfer(toAddress, amount);
    const receipt = await waitForTransaction(tx.hash);
    if (!receipt) {
      throw new Error("Transaction receipt not found");
    }

    return receipt.hash;
  }

  // Get transaction receipt
  static async getTransactionReceipt(txHash: string) {
    return await waitForTransaction(txHash);
  }
}

