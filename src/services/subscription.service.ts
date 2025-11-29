import { prisma } from "@/lib/prisma";
import { ContractService } from "./contract.service";
import { ethers } from "ethers";

export class SubscriptionService {
  /**
   * Create a new subscription
   */
  static async createSubscription(
    subscriberAddress: string,
    vendorAddress: string,
    planName: string,
    amountPerPeriod: bigint,
    periodDays: number = 30
  ) {
    const subscriber = await prisma.user.findUnique({
      where: { address: subscriberAddress },
    });

    if (!subscriber) {
      throw new Error("Subscriber not found");
    }

    const nextBillingDate = new Date();
    nextBillingDate.setDate(nextBillingDate.getDate() + periodDays);

    return await prisma.subscription.create({
      data: {
        subscriberId: subscriber.id,
        vendorAddress,
        planName,
        amountPerPeriod,
        periodDays,
        nextBillingDate,
      },
    });
  }

  /**
   * Process subscription payment
   */
  static async processPayment(subscriptionId: string): Promise<string> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { subscriber: true },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    if (!subscription.isActive) {
      throw new Error("Subscription is not active");
    }

    if (new Date() < subscription.nextBillingDate) {
      throw new Error("Billing date has not been reached");
    }

    // Transfer tokens from subscriber to vendor
    const txHash = await ContractService.transferTokens(
      subscription.subscriber.address,
      subscription.vendorAddress,
      subscription.amountPerPeriod
    );

    const receipt = await ContractService.getTransactionReceipt(txHash);
    const periodStart = subscription.nextBillingDate;
    const periodEnd = new Date(subscription.nextBillingDate);
    periodEnd.setDate(periodEnd.getDate() + subscription.periodDays);

    const nextBillingDate = new Date(periodEnd);

    // Create payment record
    await prisma.subscriptionPayment.create({
      data: {
        subscriptionId,
        txHash: receipt.hash,
        amount: subscription.amountPerPeriod,
        status: receipt.status === 1 ? "CONFIRMED" : "FAILED",
        periodStart,
        periodEnd,
        confirmedAt: receipt.status === 1 ? new Date() : null,
      },
    });

    // Update subscription
    if (receipt.status === 1) {
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          nextBillingDate,
          totalPaid: subscription.totalPaid + subscription.amountPerPeriod,
        },
      });

      // Create transaction record
      await prisma.transaction.create({
        data: {
          userId: subscription.subscriberId,
          fromAddress: subscription.subscriber.address,
          toAddress: subscription.vendorAddress,
          amount: subscription.amountPerPeriod,
          type: "SUBSCRIPTION",
          status: "CONFIRMED",
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber?.toString(),
          blockHash: receipt.blockHash || null,
          gasUsed: receipt.gasUsed?.toString(),
          gasPrice: receipt.gasPrice?.toString(),
          metadata: {
            subscriptionId,
            planName: subscription.planName,
          },
          confirmedAt: new Date(),
        },
      });
    }

    return receipt.hash;
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(subscriptionId: string, subscriberAddress: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { subscriber: true },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    if (subscription.subscriber.address !== subscriberAddress) {
      throw new Error("Unauthorized");
    }

    return await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        isActive: false,
        cancelledAt: new Date(),
      },
    });
  }

  /**
   * Get subscriptions for a user
   */
  static async getUserSubscriptions(address: string) {
    const user = await prisma.user.findUnique({
      where: { address },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return await prisma.subscription.findMany({
      where: {
        subscriberId: user.id,
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
    return await prisma.subscription.findMany({
      where: {
        isActive: true,
        nextBillingDate: {
          lte: new Date(),
        },
      },
      include: {
        subscriber: true,
      },
    });
  }
}

