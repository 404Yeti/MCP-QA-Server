import { httpRequest } from "../../utils/http.js";
import type { TestResult, PerformanceTarget } from "../../types.js";

/**
 * Run a single-request response time check against a target URL.
 * Validates that the response time is under the configured threshold.
 */
export async function runTimingTest(
  target: PerformanceTarget,
  baseUrl: string,
  timeout: number
): Promise<TestResult> {
  const url = new URL(target.url, baseUrl).toString();

  try {
    const response = await httpRequest(url, { timeout });

    if (response.status >= 400) {
      return {
        name: `performance:timing:${target.url}`,
        module: "performance",
        status: "failed",
        duration: response.duration,
        message: `${target.url} returned HTTP ${response.status}`,
        error: { message: `HTTP ${response.status}` },
      };
    }

    if (response.duration > target.maxResponseTime) {
      return {
        name: `performance:timing:${target.url}`,
        module: "performance",
        status: "failed",
        duration: response.duration,
        message: `${target.url} responded in ${response.duration}ms, exceeds max ${target.maxResponseTime}ms`,
        error: {
          message: `Response time ${response.duration}ms exceeds threshold ${target.maxResponseTime}ms`,
        },
      };
    }

    return {
      name: `performance:timing:${target.url}`,
      module: "performance",
      status: "passed",
      duration: response.duration,
      message: `${target.url} → ${response.duration}ms (max ${target.maxResponseTime}ms)`,
    };
  } catch (err) {
    return {
      name: `performance:timing:${target.url}`,
      module: "performance",
      status: "error",
      duration: 0,
      message: err instanceof Error ? err.message : String(err),
      error: {
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
