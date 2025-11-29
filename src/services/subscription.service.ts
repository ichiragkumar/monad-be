import { prisma } from "@/lib/prisma";
import { ContractService } from "./contract.service";
import { normalizeAddress } from "@/utils/address.utils";
import { provider } from "@/lib/ethers";

export class SubscriptionService {
  /**
   * Create a new subscription
   * Note: This is a legacy method. New subscriptions should use the API endpoint.
   */
  static async createSubscription(
    subscriberAddress: string,
    vendorAddress: string,
    amountPerPeriod: string,
    intervalSeconds: bigint
  ) {
    const normalizedSubscriber = normalizeAddress(subscriberAddress);
    const normalizedVendor = normalizeAddress(vendorAddress);

    const now = BigInt(Math.floor(Date.now() / 1000));
    const nextPaymentTime = now + intervalSeconds;

    return await prisma.subscription.create({
      data: {
        onChainId: "0", // Should be set by API
        payerAddress: normalizedSubscriber,
        recipientAddress: normalizedVendor,
        amount: amountPerPeriod,
        interval: intervalSeconds,
        nextPaymentTime,
        startTime: now,
        status: "ACTIVE",
      },
    });
  }

  /**
   * Process subscription payment
   */
  static async processPayment(subscriptionId: string): Promise<string> {
    const subscription = await prisma.subscription.findUnique({
      where: { subscriptionId },
      include: { payer: true },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    if (subscription.status !== "ACTIVE") {
      throw new Error("Subscription is not active");
    }

    const now = BigInt(Math.floor(Date.now() / 1000));
    if (subscription.nextPaymentTime > now) {
      throw new Error("Payment time has not been reached");
    }

    // Transfer tokens from payer to recipient
    const amount = BigInt(subscription.amount);
    const txHash = await ContractService.transferTokens(
      subscription.payerAddress,
      subscription.recipientAddress,
      amount
    );

    const receipt = await ContractService.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error("Transaction receipt not found");
    }

    const nextPaymentTime = subscription.nextPaymentTime + subscription.interval;

    // Get payment number
    const paymentNumber = subscription.paidCount + 1;

    // Create payment record
    await prisma.subscriptionPayment.create({
      data: {
        subscriptionId: subscription.id,
        txHash: receipt.hash || txHash,
        amount: subscription.amount,
        paymentNumber,
        nextPaymentTime,
        status: receipt.status === 1 ? "CONFIRMED" : "FAILED",
      },
    });

    // Update subscription
    if (receipt.status === 1) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          paidCount: paymentNumber,
          nextPaymentTime,
        },
      });

      // Get block to get timestamp - use provider directly
      let blockTimestamp: bigint | null = null;
      if (receipt.blockNumber) {
        try {
          const block = await provider.getBlock(Number(receipt.blockNumber));
          blockTimestamp = block ? BigInt(block.timestamp) : null;
        } catch (error) {
          // If block fetch fails, continue without timestamp
          console.error("Failed to fetch block timestamp:", error);
        }
      }

      // Create transaction record
      await prisma.transaction.create({
        data: {
          txHash: receipt.hash || txHash,
          fromAddress: subscription.payerAddress,
          toAddress: subscription.recipientAddress,
          amount: subscription.amount,
          token: subscription.token,
          type: "SUBSCRIPTION",
          status: "CONFIRMED",
          syncStatus: "SYNCED",
          blockNumber: receipt.blockNumber ? BigInt(receipt.blockNumber) : null,
          blockTimestamp,
          gasUsed: receipt.gasUsed?.toString(),
          gasPrice: receipt.gasPrice?.toString(),
          metadata: {
            subscriptionId: subscription.id,
            paymentNumber,
          },
          confirmedAt: new Date(),
        },
      });
    }

    return receipt.hash || txHash;
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(subscriptionId: string, subscriberAddress: string) {
    const normalizedAddress = normalizeAddress(subscriberAddress);
    const subscription = await prisma.subscription.findUnique({
      where: { subscriptionId },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    if (subscription.payerAddress !== normalizedAddress) {
      throw new Error("Unauthorized");
    }

    return await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "CANCELLED",
      },
    });
  }

  /**
   * Get subscriptions for a user
   */
  static async getUserSubscriptions(address: string) {
    const normalizedAddress = normalizeAddress(address);
    
    return await prisma.subscription.findMany({
      where: {
        OR: [
          { payerAddress: normalizedAddress },
          { recipientAddress: normalizedAddress },
        ],
      },
      include: {
        payments: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get active subscriptions due for billing
   */
  static async getDueSubscriptions() {
    const now = BigInt(Math.floor(Date.now() / 1000));
    
    return await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        nextPaymentTime: {
          lte: now,
        },
      },
      include: {
        payer: true,
      },
    });
  }
}

