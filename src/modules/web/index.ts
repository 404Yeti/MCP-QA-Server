import { BaseModule } from "../base-module.js";
import type {
  ModuleName,
  TestResult,
  TestContext,
  WebModuleConfig,
} from "../../types.js";
import type { Browser, Page } from "playwright";

export class WebModule extends BaseModule {
  readonly name: ModuleName = "web";
  readonly description = "Web/UI testing (page loads, forms, workflows)";

  private browser: Browser | null = null;
  private page: Page | null = null;

  validate(context: TestContext): string[] {
    const errors: string[] = [];
    if (!context.config.baseUrl) {
      errors.push("Web module requires 'baseUrl' to be set in project config");
    }
    return errors;
  }

  async setup(_context: TestContext): Promise<void> {
    // Lazy-load Playwright to avoid requiring it when web module isn't used
    let chromium;
    try {
      const pw = await import("playwright");
      chromium = pw.chromium;
    } catch {
      throw new Error(
        "Playwright is required for the web module. Install it with: npx playwright install chromium"
      );
    }

    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();
  }

  async teardown(_context: TestContext): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  async run(context: TestContext): Promise<TestResult[]> {
    const cfg = context.config.moduleConfig["web"] as WebModuleConfig | undefined;
    if (!cfg) {
      return [this.skip("web", "No web module configuration found")];
    }
    if (!context.config.baseUrl) {
      return [this.skip("web", "No baseUrl configured")];
    }
    if (!this.page) {
      return [this.error("web", 0, new Error("Browser page not initialized — setup may have failed"))];
    }

    const baseUrl = context.config.baseUrl;
    const timeout = context.config.timeout;
    const results: TestResult[] = [];

    // Page load tests
    if (cfg.pages && cfg.pages.length > 0) {
      const { runPageLoadTests } = await import("./page-load.js");
      results.push(...await runPageLoadTests(cfg.pages, baseUrl, this.page, timeout));
    }

    // Form tests
    if (cfg.forms && cfg.forms.length > 0) {
      const { runFormTests } = await import("./forms.js");
      results.push(...await runFormTests(cfg.forms, baseUrl, this.page, timeout));
    }

    // Workflow tests
    if (cfg.workflows && cfg.workflows.length > 0) {
      const { runWorkflowTests } = await import("./workflows.js");
      results.push(...await runWorkflowTests(cfg.workflows, baseUrl, this.page, timeout));
    }

    return results;
  }
}
