/**
 * Cron service for scheduled tasks
 * This handles background jobs for transaction syncing and subscription payments
 */

import { SyncService } from "./sync.service";

/**
 * Process due subscription payments
 * This should be called periodically (e.g., via a cron job or scheduler)
 */
export async function processDueSubscriptions(): Promise<void> {
  await SyncService.checkSubscriptionPayments();
}

/**
 * Sync pending transactions
 * Run every 30 seconds
 */
export async function syncTransactions(): Promise<void> {
  await SyncService.syncPendingTransactions();
}

/**
 * Initialize background jobs
 * Call this from server.ts to start scheduled tasks
 */
export function initializeBackgroundJobs(): void {
  // Transaction sync - every 30 seconds
  setInterval(async () => {
    await syncTransactions();
  }, 30 * 1000);

  // Subscription payment check - every 5 minutes
  setInterval(async () => {
    await processDueSubscriptions();
  }, 5 * 60 * 1000);

  console.log("✅ Background jobs initialized:");
  console.log("   - Transaction sync: every 30 seconds");
  console.log("   - Subscription check: every 5 minutes");
}
