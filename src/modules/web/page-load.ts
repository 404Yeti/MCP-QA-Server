import type { Page } from "playwright";
import type { TestResult, WebPageTest } from "../../types.js";

/**
 * Test that pages load with the expected status code, within time limits,
 * and contain expected content strings.
 */
export async function runPageLoadTests(
  pages: WebPageTest[],
  baseUrl: string,
  page: Page,
  timeout: number
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const test of pages) {
    const start = Date.now();
    const url = new URL(test.path, baseUrl).toString();

    try {
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout,
      });

      const duration = Date.now() - start;
      const status = response?.status() ?? 0;
      const failures: string[] = [];

      // Status code check
      if (status !== test.expectedStatus) {
        failures.push(
          `Status: expected ${test.expectedStatus}, got ${status}`
        );
      }

      // Load time check
      if (test.maxLoadTime && duration > test.maxLoadTime) {
        failures.push(
          `Load time: ${duration}ms exceeds max ${test.maxLoadTime}ms`
        );
      }

      // Content checks
      if (test.contentChecks && test.contentChecks.length > 0) {
        const bodyText = await page.textContent("body") ?? "";
        const missing = test.contentChecks.filter(
          (text) => !bodyText.includes(text)
        );
        if (missing.length > 0) {
          failures.push(
            `Missing content: ${missing.map((m) => `"${m}"`).join(", ")}`
          );
        }
      }

      if (failures.length === 0) {
        results.push({
          name: `web:page:${test.name}`,
          module: "web",
          status: "passed",
          duration,
          message: `${test.path} → ${status} (${duration}ms)`,
        });
      } else {
        results.push({
          name: `web:page:${test.name}`,
          module: "web",
          status: "failed",
          duration,
          message: failures.join("; "),
          error: { message: failures.join("\n") },
        });
      }
    } catch (err) {
      results.push({
        name: `web:page:${test.name}`,
        module: "web",
        status: "error",
        duration: Date.now() - start,
        message: err instanceof Error ? err.message : String(err),
        error: {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        },
      });
    }
  }

  return results;
}
