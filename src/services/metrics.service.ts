import { prisma } from "@/lib/prisma";
import { config } from "@/config/env";
import * as crypto from "crypto";
import axios from "axios";

export interface Metric {
  metric_name: string;
  page_path?: string | null;
  value: number;
  tags: Record<string, any>;
  type: string;
}

export interface ProcessedMetricsResult {
  processed: number;
  stored: number;
  skipped: number;
}

/**
 * Generate hash for metric deduplication
 */
export function generateMetricHash(metric: Metric): string {
  // Normalize tags (sort keys for consistent hashing)
  const normalizedTags = Object.keys(metric.tags)
    .sort()
    .reduce((acc, key) => {
      acc[key] = metric.tags[key];
      return acc;
    }, {} as Record<string, any>);

  const data = JSON.stringify({
    metric_name: metric.metric_name,
    page_path: metric.page_path || null,
    tags: normalizedTags,
    type: metric.type,
    value: metric.value,
  });

  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Check if metric exists in database within deduplication window
 */
export async function metricExistsInDB(
  metric: Metric,
  tagsHash: string
): Promise<boolean> {
  const hoursAgo = new Date(
    Date.now() - config.metrics.dedupWindowHours * 60 * 60 * 1000
  );

  const existing = await prisma.metric.findFirst({
    where: {
      metricName: metric.metric_name,
      pagePath: metric.page_path || null,
      tagsHash,
      type: metric.type,
      value: metric.value.toString(),
      createdAt: {
        gte: hoursAgo,
      },
    },
  });

  return !!existing;
}

/**
 * Store metric in database
 */
export async function storeMetric(
  metric: Metric,
  tagsHash: string
): Promise<void> {
  await prisma.metric.create({
    data: {
      metricName: metric.metric_name,
      pagePath: metric.page_path || null,
      value: metric.value.toString(),
      tags: metric.tags,
      type: metric.type,
      tagsHash,
      externalApiCalled: false,
    },
  });
}

/**
 * Call external metrics API
 */
export async function callExternalMetricsAPI(
  metrics: Metric[]
): Promise<any> {
  if (!config.metrics.externalApiEnabled) {
    return { message: "External API disabled" };
  }

  try {
    const response = await axios.post(
      config.metrics.externalApiUrl,
      { metrics },
      {
        headers: {
          "Content-Type": "text/plain;charset=UTF-8",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
        timeout: 10000, // 10 second timeout
      }
    );

    return response.data;
  } catch (error: any) {
    console.error("External metrics API error:", error.message);
    throw error;
  }
}

/**
 * Process metrics: check DB, store new ones, call external API
 */
export async function processMetrics(
  metrics: Metric[]
): Promise<ProcessedMetricsResult> {
  let processed = 0;
  let stored = 0;
  let skipped = 0;
  const metricsToSend: Metric[] = [];

  // Process each metric
  for (const metric of metrics) {
    processed++;

    // Generate hash for deduplication
    const tagsHash = generateMetricHash(metric);

    // Check if metric already exists in DB
    const exists = await metricExistsInDB(metric, tagsHash);

    if (exists) {
      skipped++;
      continue; // Skip - already in DB
    }

    // Store in database
    await storeMetric(metric, tagsHash);
    stored++;

    // Add to list for external API call
    metricsToSend.push(metric);
  }

  // Call external API only for new metrics
  if (metricsToSend.length > 0 && config.metrics.externalApiEnabled) {
    try {
      const externalResponse = await callExternalMetricsAPI(metricsToSend);

      // Update stored metrics with external API response
      for (const metric of metricsToSend) {
        const tagsHash = generateMetricHash(metric);

        await prisma.metric.updateMany({
          where: {
            metricName: metric.metric_name,
            pagePath: metric.page_path || null,
            tagsHash,
            type: metric.type,
            value: metric.value.toString(),
            externalApiCalled: false,
          },
          data: {
            externalApiCalled: true,
            externalApiResponse: externalResponse || {},
          },
        });
      }
    } catch (error) {
      // Log error but don't fail the request
      console.error("External API call failed (non-critical):", error);
      // Metrics are already stored in DB, so we continue
    }
  }

  return {
    processed,
    stored,
    skipped,
  };
}

