import { BaseModule } from "../base-module.js";
import type {
  ModuleName,
  TestResult,
  TestContext,
  IntegrationModuleConfig,
} from "../../types.js";
import { runScenario } from "./runner.js";

export class IntegrationModule extends BaseModule {
  readonly name: ModuleName = "integration";
  readonly description = "Integration testing (cross-module orchestration)";

  validate(context: TestContext): string[] {
    const cfg = context.config.moduleConfig["integration"] as IntegrationModuleConfig | undefined;
    if (cfg && (!cfg.scenarios || cfg.scenarios.length === 0)) {
      return ["Integration module has no scenarios configured"];
    }
    return [];
  }

  async run(context: TestContext): Promise<TestResult[]> {
    const cfg = context.config.moduleConfig["integration"] as IntegrationModuleConfig | undefined;
    if (!cfg) {
      return [this.skip("integration", "No integration module configuration found")];
    }
    if (!cfg.scenarios || cfg.scenarios.length === 0) {
      return [this.skip("integration", "No integration scenarios configured")];
    }

    const results: TestResult[] = [];

    for (const scenario of cfg.scenarios) {
      try {
        const scenarioResults = await runScenario(scenario, context);
        results.push(...scenarioResults);
      } catch (err) {
        results.push(
          this.error(`integration:${scenario.name}`, 0, err)
        );
      }
    }

    return results;
  }
}
