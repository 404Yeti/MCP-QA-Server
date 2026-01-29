import { BaseModule } from "../base-module.js";
import type {
  ModuleName,
  TestResult,
  TestContext,
  ApiModuleConfig,
} from "../../types.js";
import { executeEndpoint } from "./rest.js";
import { validateEndpoint } from "./validation.js";

export class ApiModule extends BaseModule {
  readonly name: ModuleName = "api";
  readonly description = "API endpoint testing (REST, response validation)";

  validate(context: TestContext): string[] {
    const errors: string[] = [];
    if (!context.config.baseUrl) {
      errors.push("API module requires 'baseUrl' to be set in project config");
    }
    const cfg = context.config.moduleConfig["api"] as ApiModuleConfig | undefined;
    if (cfg && (!cfg.endpoints || cfg.endpoints.length === 0)) {
      errors.push("API module has no endpoints configured");
    }
    return errors;
  }

  async run(context: TestContext): Promise<TestResult[]> {
    const cfg = context.config.moduleConfig["api"] as ApiModuleConfig | undefined;
    if (!cfg) {
      return [this.skip("api", "No API module configuration found")];
    }
    if (!cfg.endpoints || cfg.endpoints.length === 0) {
      return [this.skip("api", "No API endpoints configured")];
    }
    if (!context.config.baseUrl) {
      return [this.skip("api", "No baseUrl configured")];
    }

    const baseUrl = context.config.baseUrl;
    const results: TestResult[] = [];

    // Captured values from previous responses (for chaining)
    const captured: Record<string, unknown> = {};

    for (const test of cfg.endpoints) {
      try {
        const execution = await executeEndpoint(
          baseUrl,
          test,
          cfg.auth,
          context.config.timeout
        );

        const result = validateEndpoint(execution);
        results.push(result);

        // Capture response value if requested
        if (test.captureAs && execution.response.json !== null) {
          captured[test.captureAs] = execution.response.json;
          context.store[test.captureAs] = execution.response.json;
        }
      } catch (err) {
        results.push(this.error(`api:${test.name}`, 0, err));
      }
    }

    return results;
  }
}
