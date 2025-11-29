import { Router } from "express";
import { SubscriptionService } from "@/services/subscription.service";
import { authenticateToken, AuthRequest } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validation.middleware";
import { createSubscriptionSchema } from "@/utils/validation.schemas";
import { AppError } from "@/middleware/error.middleware";

const router = Router();

/**
 * POST /subscription
 * Create a new subscription
 */
router.post(
  "/subscription",
  authenticateToken,
  validate(createSubscriptionSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { vendorAddress, planName, amountPerPeriod, periodDays } = req.body;
      const subscriberAddress = req.user!.address;

      const amountBigInt =
        typeof amountPerPeriod === "string" ? BigInt(amountPerPeriod) : amountPerPeriod;

      const subscription = await SubscriptionService.createSubscription(
        subscriberAddress,
        vendorAddress,
        planName,
        amountBigInt,
        periodDays
      );

      res.status(201).json({
        id: subscription.id,
        planName: subscription.planName,
        vendorAddress: subscription.vendorAddress,
        amountPerPeriod: subscription.amountPerPeriod.toString(),
        periodDays: subscription.periodDays,
        nextBillingDate: subscription.nextBillingDate,
        isActive: subscription.isActive,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /subscription/:id/pay
 * Process a subscription payment
 */
router.post("/subscription/:id/pay", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const subscriberAddress = req.user!.address;

    // Verify subscription ownership
    const subscription = await SubscriptionService.getUserSubscriptions(subscriberAddress);
    const sub = subscription.find((s) => s.id === id);

    if (!sub) {
      throw new AppError("Subscription not found", 404);
    }

    const txHash = await SubscriptionService.processPayment(id);

    res.json({
      message: "Payment processed",
      txHash,
      subscriptionId: id,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /subscription/:id
 * Cancel a subscription
 */
router.delete("/subscription/:id", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const subscriberAddress = req.user!.address;

    await SubscriptionService.cancelSubscription(id, subscriberAddress);

    res.json({
      message: "Subscription cancelled",
      subscriptionId: id,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /subscription
 * Get user's subscriptions
 */
router.get("/subscription", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const address = req.user!.address;

    const subscriptions = await SubscriptionService.getUserSubscriptions(address);

    res.json({
      subscriptions: subscriptions.map((sub) => ({
        id: sub.id,
        vendorAddress: sub.vendorAddress,
        planName: sub.planName,
        amountPerPeriod: sub.amountPerPeriod.toString(),
        periodDays: sub.periodDays,
        isActive: sub.isActive,
        nextBillingDate: sub.nextBillingDate,
        totalPaid: sub.totalPaid.toString(),
        createdAt: sub.createdAt,
        recentPayments: sub.payments.map((payment) => ({
          id: payment.id,
          amount: payment.amount.toString(),
          status: payment.status,
          periodStart: payment.periodStart,
          periodEnd: payment.periodEnd,
          txHash: payment.txHash,
          confirmedAt: payment.confirmedAt,
        })),
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;

