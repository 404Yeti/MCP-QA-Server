import { httpRequest } from "../../utils/http.js";
import type { TestResult, PerformanceTarget } from "../../types.js";

export interface LoadTestResult {
  target: PerformanceTarget;
  durations: number[];
  errors: number;
  totalDuration: number;
}

/**
 * Run a basic load test by sending concurrent HTTP requests to a target URL.
 * Returns timing data for further analysis.
 */
export async function runLoadTest(
  target: PerformanceTarget,
  baseUrl: string,
  timeout: number
): Promise<LoadTestResult> {
  const url = new URL(target.url, baseUrl).toString();
  const concurrency = target.concurrentRequests ?? 10;
  const start = Date.now();

  // Fire all requests concurrently
  const promises = Array.from({ length: concurrency }, () =>
    httpRequest(url, { timeout }).catch(() => null)
  );

  const responses = await Promise.all(promises);

  const durations: number[] = [];
  let errors = 0;

  for (const res of responses) {
    if (res === null) {
      errors++;
    } else if (res.status >= 400) {
      errors++;
      durations.push(res.duration);
    } else {
      durations.push(res.duration);
    }
  }

  return {
    target,
    durations: durations.sort((a, b) => a - b),
    errors,
    totalDuration: Date.now() - start,
  };
}

/**
 * Convert a LoadTestResult into a TestResult with pass/fail based on thresholds.
 */
export function evaluateLoadTest(result: LoadTestResult): TestResult {
  const { target, durations, errors } = result;
  const concurrency = target.concurrentRequests ?? 10;
  const failures: string[] = [];

  // Check if too many errors
  const errorRate = errors / concurrency;
  if (errorRate > 0.5) {
    failures.push(
      `Error rate: ${(errorRate * 100).toFixed(0)}% (${errors}/${concurrency} requests failed)`
    );
  }

  // Check response time threshold against p95
  if (durations.length > 0) {
    const p95 = percentile(durations, 95);
    if (p95 > target.maxResponseTime) {
      failures.push(
        `p95 response time: ${p95}ms exceeds max ${target.maxResponseTime}ms`
      );
    }
  }

  const stats = durations.length > 0
    ? `p50=${percentile(durations, 50)}ms, p95=${percentile(durations, 95)}ms, p99=${percentile(durations, 99)}ms`
    : "no successful responses";

  if (failures.length === 0) {
    return {
      name: `performance:load:${target.url}`,
      module: "performance",
      status: "passed",
      duration: result.totalDuration,
      message: `${target.url} — ${concurrency} concurrent: ${stats}, ${errors} errors`,
    };
  }

  return {
    name: `performance:load:${target.url}`,
    module: "performance",
    status: "failed",
    duration: result.totalDuration,
    message: failures.join("; "),
    error: {
      message: `${failures.join("\n")}\nStats: ${stats}`,
    },
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}
