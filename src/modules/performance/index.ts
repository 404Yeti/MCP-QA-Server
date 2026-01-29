import { BaseModule } from "../base-module.js";
import type {
  ModuleName,
  TestResult,
  TestContext,
  PerformanceModuleConfig,
} from "../../types.js";
import { runLoadTest, evaluateLoadTest } from "./load.js";
import { runTimingTest } from "./timing.js";

export class PerformanceModule extends BaseModule {
  readonly name: ModuleName = "performance";
  readonly description = "Performance testing (load, response times)";

  validate(context: TestContext): string[] {
    const errors: string[] = [];
    if (!context.config.baseUrl) {
      errors.push("Performance module requires 'baseUrl' to be set in project config");
    }
    const cfg = context.config.moduleConfig["performance"] as PerformanceModuleConfig | undefined;
    if (cfg && (!cfg.targets || cfg.targets.length === 0)) {
      errors.push("Performance module has no targets configured");
    }
    return errors;
  }

  async run(context: TestContext): Promise<TestResult[]> {
    const cfg = context.config.moduleConfig["performance"] as PerformanceModuleConfig | undefined;
    if (!cfg) {
      return [this.skip("performance", "No performance module configuration found")];
    }
    if (!cfg.targets || cfg.targets.length === 0) {
      return [this.skip("performance", "No performance targets configured")];
    }
    if (!context.config.baseUrl) {
      return [this.skip("performance", "No baseUrl configured")];
    }

    const baseUrl = context.config.baseUrl;
    const timeout = context.config.timeout;
    const results: TestResult[] = [];

    for (const target of cfg.targets) {
      try {
        // Single-request timing test
        const timingResult = await runTimingTest(target, baseUrl, timeout);
        results.push(timingResult);

        // Concurrent load test (only if concurrentRequests > 1)
        if (target.concurrentRequests && target.concurrentRequests > 1) {
          const loadResult = await runLoadTest(target, baseUrl, timeout);
          results.push(evaluateLoadTest(loadResult));
        }
      } catch (err) {
        results.push(this.error(`performance:${target.url}`, 0, err));
      }
    }

    return results;
  }
}
