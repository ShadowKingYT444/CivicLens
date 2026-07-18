import { NETWORK_LIMITS } from "./constants";
import { hashPrivateValue } from "./privacy/hashing";

export interface RateLimitConfig {
  windowMs?: number;
  maxRequests?: number;
  now?: () => number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  resetAtMs: number;
}

export function createRateLimiter(config: RateLimitConfig = {}) {
  const windowMs = config.windowMs ?? NETWORK_LIMITS.rateLimitWindowMs;
  const maxRequests = config.maxRequests ?? NETWORK_LIMITS.rateLimitMaxRequests;
  const now = config.now ?? Date.now;
  const buckets = new Map<string, Bucket>();

  return {
    check(key: string): RateLimitResult {
      const currentTime = now();
      const safeKey = hashPrivateValue(key, { purpose: "rate-limit" });
      const existing = buckets.get(safeKey);
      const bucket =
        existing && existing.resetAtMs > currentTime
          ? existing
          : { count: 0, resetAtMs: currentTime + windowMs };

      bucket.count += 1;
      buckets.set(safeKey, bucket);
      cleanupExpiredBuckets(buckets, currentTime);

      const remaining = Math.max(0, maxRequests - bucket.count);
      const retryAfterSeconds = Math.max(0, Math.ceil((bucket.resetAtMs - currentTime) / 1000));

      return {
        allowed: bucket.count <= maxRequests,
        limit: maxRequests,
        remaining,
        resetAt: new Date(bucket.resetAtMs),
        retryAfterSeconds,
      };
    },
    reset(): void {
      buckets.clear();
    },
    size(): number {
      return buckets.size;
    },
  };
}

export const defaultRateLimiter = createRateLimiter();

function cleanupExpiredBuckets(buckets: Map<string, Bucket>, currentTime: number): void {
  if (buckets.size < 500) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (bucket.resetAtMs <= currentTime) {
      buckets.delete(key);
    }
  }
}
