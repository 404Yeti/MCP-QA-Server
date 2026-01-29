import type { TestResult, WpPageTest } from "../../types.js";
import { httpRequest } from "../../utils/http.js";

/**
 * Test WordPress pages load with expected status and content.
 * Uses HTTP requests (no browser) for lightweight checking.
 */
export async function runWpPageTests(
  pages: WpPageTest[],
  baseUrl: string,
  timeout: number
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const test of pages) {
    const start = Date.now();
    const url = new URL(test.path, baseUrl).toString();

    try {
      const response = await httpRequest(url, { timeout });
      const duration = Date.now() - start;
      const failures: string[] = [];

      // Status code
      if (response.status !== test.expectedStatus) {
        failures.push(
          `Status: expected ${test.expectedStatus}, got ${response.status}`
        );
      }

      // Content checks
      if (test.contentChecks && test.contentChecks.length > 0) {
        const missing = test.contentChecks.filter(
          (text) => !response.body.includes(text)
        );
        if (missing.length > 0) {
          failures.push(
            `Missing content: ${missing.map((m) => `"${m}"`).join(", ")}`
          );
        }
      }

      if (failures.length === 0) {
        results.push({
          name: `wordpress:page:${test.name}`,
          module: "wordpress",
          status: "passed",
          duration,
          message: `${test.path} → ${response.status} (${duration}ms)`,
        });
      } else {
        results.push({
          name: `wordpress:page:${test.name}`,
          module: "wordpress",
          status: "failed",
          duration,
          message: failures.join("; "),
          error: { message: failures.join("\n") },
        });
      }
    } catch (err) {
      results.push({
        name: `wordpress:page:${test.name}`,
        module: "wordpress",
        status: "error",
        duration: Date.now() - start,
        message: err instanceof Error ? err.message : String(err),
        error: {
          message: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  return results;
}
