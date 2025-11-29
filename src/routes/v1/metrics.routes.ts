import { Router } from "express";
import { processMetrics, Metric } from "@/services/metrics.service";
import { sendSuccess, sendError, ErrorCode } from "@/utils/response.util";
import { z } from "zod";
import { validate } from "@/middleware/validation.middleware";

const router = Router();

const metricsSchema = z.object({
  metrics: z.array(
    z.object({
      metric_name: z.string(),
      page_path: z.string().nullable().optional(),
      value: z.number(),
      tags: z.record(z.any()),
      type: z.string(),
    })
  ),
});

/**
 * POST /api/v1/metrics
 * Receive metrics from frontend, check DB first, then call external API if needed
 */
router.post("/", validate(metricsSchema), async (req, res, next) => {
  try {
    const { metrics } = req.body;

    if (!Array.isArray(metrics) || metrics.length === 0) {
      return sendError(
        res,
        ErrorCode.INVALID_PARAMETERS,
        "Metrics array is required and cannot be empty",
        400
      );
    }

    // Process metrics (check DB, store, call external API)
    const result = await processMetrics(metrics as Metric[]);

    return sendSuccess(res, {
      processed: result.processed,
      stored: result.stored,
      skipped: result.skipped,
    });
  } catch (error: any) {
    console.error("Metrics endpoint error:", error);
    return sendError(
      res,
      ErrorCode.INTERNAL_ERROR,
      error.message || "Failed to process metrics",
      500
    );
  }
});

export default router;

