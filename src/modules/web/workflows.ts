import type { Page } from "playwright";
import type { TestResult, WebWorkflowTest, WorkflowStep } from "../../types.js";

/**
 * Execute multi-step browser workflows defined as a sequence of actions.
 * Each step is a navigate/click/fill/wait/assert action.
 */
export async function runWorkflowTests(
  workflows: WebWorkflowTest[],
  baseUrl: string,
  page: Page,
  timeout: number
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const workflow of workflows) {
    const start = Date.now();

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        const stepTimeout = step.timeout ?? timeout;

        await executeStep(page, step, baseUrl, stepTimeout);
      }

      results.push({
        name: `web:workflow:${workflow.name}`,
        module: "web",
        status: "passed",
        duration: Date.now() - start,
        message: `Workflow "${workflow.name}" completed (${workflow.steps.length} steps)`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        name: `web:workflow:${workflow.name}`,
        module: "web",
        status: "failed",
        duration: Date.now() - start,
        message,
        error: {
          message,
          stack: err instanceof Error ? err.stack : undefined,
        },
      });
    }
  }

  return results;
}

async function executeStep(
  page: Page,
  step: WorkflowStep,
  baseUrl: string,
  timeout: number
): Promise<void> {
  switch (step.action) {
    case "navigate": {
      if (!step.url) throw new Error("navigate step requires 'url'");
      const url = step.url.startsWith("http")
        ? step.url
        : new URL(step.url, baseUrl).toString();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout });
      break;
    }

    case "click": {
      if (!step.selector) throw new Error("click step requires 'selector'");
      await page.waitForSelector(step.selector, { timeout });
      await page.click(step.selector);
      break;
    }

    case "fill": {
      if (!step.selector) throw new Error("fill step requires 'selector'");
      if (step.value === undefined) throw new Error("fill step requires 'value'");
      await page.waitForSelector(step.selector, { timeout });
      await page.fill(step.selector, step.value);
      break;
    }

    case "select": {
      if (!step.selector) throw new Error("select step requires 'selector'");
      if (step.value === undefined) throw new Error("select step requires 'value'");
      await page.waitForSelector(step.selector, { timeout });
      await page.selectOption(step.selector, step.value);
      break;
    }

    case "waitForUrl": {
      if (!step.url) throw new Error("waitForUrl step requires 'url'");
      await page.waitForURL(`**${step.url}`, { timeout });
      break;
    }

    case "waitForSelector": {
      if (!step.selector) throw new Error("waitForSelector step requires 'selector'");
      await page.waitForSelector(step.selector, { timeout });
      break;
    }

    case "assertVisible": {
      if (!step.selector) throw new Error("assertVisible step requires 'selector'");
      const el = await page.waitForSelector(step.selector, { timeout });
      if (!el) {
        throw new Error(`Element not found: ${step.selector}`);
      }
      const visible = await el.isVisible();
      if (!visible) {
        throw new Error(`Element not visible: ${step.selector}`);
      }
      break;
    }

    case "assertText": {
      if (!step.selector) throw new Error("assertText step requires 'selector'");
      if (step.value === undefined) throw new Error("assertText step requires 'value'");
      const element = await page.waitForSelector(step.selector, { timeout });
      if (!element) {
        throw new Error(`Element not found: ${step.selector}`);
      }
      const text = await element.textContent() ?? "";
      if (!text.includes(step.value)) {
        throw new Error(
          `Text assertion failed on "${step.selector}": expected to contain "${step.value}", got "${text.slice(0, 200)}"`
        );
      }
      break;
    }

    case "screenshot": {
      // Screenshots are informational — won't fail the test
      await page.screenshot({
        path: step.value ?? "screenshot.png",
        fullPage: true,
      });
      break;
    }

    default: {
      const _exhaustive: never = step.action;
      throw new Error(`Unknown workflow action: ${_exhaustive}`);
    }
  }
}
