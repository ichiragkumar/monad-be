import { prisma } from "@/lib/prisma";
import { provider, waitForTransaction } from "@/lib/ethers";
import { config } from "@/config/env";

/**
 * Transaction Sync Service
 * Syncs pending transactions with blockchain
 */
export class SyncService {
  /**
   * Sync pending transactions
   */
  static async syncPendingTransactions(): Promise<void> {
    try {
      // Get transactions that need syncing
      const pendingTransactions = await prisma.transaction.findMany({
        where: {
          syncStatus: {
            in: ["PENDING", "SYNCING"],
          },
          createdAt: {
            // Only sync transactions from last 10 minutes
            gte: new Date(Date.now() - 10 * 60 * 1000),
          },
        },
        take: 50, // Process in batches
      });

      console.log(`Syncing ${pendingTransactions.length} pending transactions...`);

      for (const tx of pendingTransactions) {
        try {
          if (!tx.txHash) continue;

          // Update status to syncing
          await prisma.transaction.update({
            where: { id: tx.id },
            data: { syncStatus: "SYNCING" },
          });

          // Try to get transaction receipt
          const receipt = await provider.getTransactionReceipt(tx.txHash);

          if (receipt) {
            // Transaction found on blockchain
            const block = await provider.getBlock(receipt.blockNumber);

            await prisma.transaction.update({
              where: { id: tx.id },
              data: {
                status: receipt.status === 1 ? "CONFIRMED" : "FAILED",
                syncStatus: "SYNCED",
                blockNumber: receipt.blockNumber,
                blockTimestamp: BigInt(block?.timestamp || 0),
                blockHash: receipt.blockHash,
                gasUsed: receipt.gasUsed?.toString(),
                gasPrice: receipt.gasPrice?.toString(),
                confirmedAt: receipt.status === 1 ? new Date() : null,
              },
            });
          } else {
            // Transaction not found - check if it's been more than 10 minutes
            const ageMinutes = (Date.now() - tx.createdAt.getTime()) / (1000 * 60);
            if (ageMinutes > 10) {
              // Keep as pending but mark as syncing (may have failed)
              await prisma.transaction.update({
                where: { id: tx.id },
                data: { syncStatus: "SYNCING" },
              });
            }
          }
        } catch (error: any) {
          console.error(`Error syncing transaction ${tx.txHash}:`, error.message);
          // Keep as pending on error
          await prisma.transaction.update({
            where: { id: tx.id },
            data: { syncStatus: "PENDING" },
          });
        }
      }

      console.log(`Sync complete. Processed ${pendingTransactions.length} transactions.`);
    } catch (error) {
      console.error("Error in sync service:", error);
    }
  }

  /**
   * Check for due subscription payments
   */
  static async checkSubscriptionPayments(): Promise<void> {
    try {
      const now = BigInt(Math.floor(Date.now() / 1000));

      const dueSubscriptions = await prisma.subscription.findMany({
        where: {
          status: "ACTIVE",
          nextPaymentTime: {
            lte: now,
          },
        },
      });

      console.log(`Checking ${dueSubscriptions.length} due subscriptions...`);

      for (const subscription of dueSubscriptions) {
        try {
          // Check if payment was executed on-chain
          // This would typically query the SubscriptionScheduler contract
          // For now, we'll just log it - the payment should be recorded via API
          console.log(
            `Subscription ${subscription.subscriptionId} payment due at ${subscription.nextPaymentTime}`
          );
          // In production, query contract to check if payment executed
        } catch (error) {
          console.error(
            `Error checking subscription ${subscription.subscriptionId}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error("Error checking subscription payments:", error);
    }
  }
}

