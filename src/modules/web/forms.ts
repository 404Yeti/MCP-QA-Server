import type { Page } from "playwright";
import type { TestResult, WebFormTest } from "../../types.js";

/**
 * Test form interactions: fill fields, submit, and validate the result
 * (redirect, page content, or error messages).
 */
export async function runFormTests(
  forms: WebFormTest[],
  baseUrl: string,
  page: Page,
  timeout: number
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const test of forms) {
    const start = Date.now();
    const url = new URL(test.page, baseUrl).toString();

    try {
      // Navigate to the form page
      await page.goto(url, { waitUntil: "domcontentloaded", timeout });

      // Fill form fields
      for (const field of test.fields) {
        await page.waitForSelector(field.selector, { timeout });

        switch (field.type) {
          case "select":
            await page.selectOption(field.selector, field.testValue);
            break;
          case "checkbox":
            if (field.testValue === "true") {
              await page.check(field.selector);
            } else {
              await page.uncheck(field.selector);
            }
            break;
          default:
            await page.fill(field.selector, field.testValue);
            break;
        }
      }

      // Submit the form
      await page.click(test.submitSelector);

      const failures: string[] = [];

      // Check expected result
      if (test.expectedResult.redirectTo) {
        try {
          await page.waitForURL(`**${test.expectedResult.redirectTo}`, {
            timeout,
          });
        } catch {
          const currentUrl = new URL(page.url()).pathname;
          failures.push(
            `Expected redirect to "${test.expectedResult.redirectTo}", still at "${currentUrl}"`
          );
        }
      }

      if (test.expectedResult.containsText) {
        // Wait briefly for page to update
        await page.waitForTimeout(500);
        const bodyText = (await page.textContent("body")) ?? "";
        if (!bodyText.includes(test.expectedResult.containsText)) {
          failures.push(
            `Page missing expected text: "${test.expectedResult.containsText}"`
          );
        }
      }

      if (test.expectedResult.errorMessage) {
        await page.waitForTimeout(500);
        const bodyText = (await page.textContent("body")) ?? "";
        if (!bodyText.includes(test.expectedResult.errorMessage)) {
          failures.push(
            `Expected error message not found: "${test.expectedResult.errorMessage}"`
          );
        }
      }

      const duration = Date.now() - start;

      if (failures.length === 0) {
        results.push({
          name: `web:form:${test.name}`,
          module: "web",
          status: "passed",
          duration,
          message: `Form "${test.name}" submitted successfully`,
        });
      } else {
        results.push({
          name: `web:form:${test.name}`,
          module: "web",
          status: "failed",
          duration,
          message: failures.join("; "),
          error: { message: failures.join("\n") },
        });
      }
    } catch (err) {
      results.push({
        name: `web:form:${test.name}`,
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
