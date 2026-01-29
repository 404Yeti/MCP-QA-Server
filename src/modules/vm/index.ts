import { BaseModule } from "../base-module.js";
import type {
  ModuleName,
  TestResult,
  TestContext,
  VmModuleConfig,
} from "../../types.js";
import { runToolChecks } from "./tools.js";
import { runDependencyChecks } from "./dependencies.js";
import { runConfigFileChecks } from "./config-files.js";
import { exec } from "../../utils/process.js";

export class VmModule extends BaseModule {
  readonly name: ModuleName = "vm";
  readonly description = "VM environment validation (tools, deps, configs)";

  validate(context: TestContext): string[] {
    const cfg = context.config.moduleConfig["vm"] as VmModuleConfig | undefined;
    if (!cfg) return [];

    const hasAnything =
      (cfg.tools && cfg.tools.length > 0) ||
      (cfg.dependencies && cfg.dependencies.length > 0) ||
      (cfg.configFiles && cfg.configFiles.length > 0) ||
      (cfg.services && cfg.services.length > 0);

    if (!hasAnything) {
      return ["VM module is enabled but has no tools, dependencies, configFiles, or services configured"];
    }
    return [];
  }

  async run(context: TestContext): Promise<TestResult[]> {
    const cfg = context.config.moduleConfig["vm"] as VmModuleConfig | undefined;
    if (!cfg) {
      return [this.skip("vm", "No VM module configuration found")];
    }

    const results: TestResult[] = [];

    // Tool checks
    if (cfg.tools && cfg.tools.length > 0) {
      results.push(...await runToolChecks(cfg.tools, context));
    }

    // Dependency checks
    if (cfg.dependencies && cfg.dependencies.length > 0) {
      results.push(...await runDependencyChecks(cfg.dependencies, context));
    }

    // Config file checks
    if (cfg.configFiles && cfg.configFiles.length > 0) {
      results.push(...await runConfigFileChecks(cfg.configFiles, context));
    }

    // Service checks
    if (cfg.services && cfg.services.length > 0) {
      results.push(...await this.runServiceChecks(cfg.services, context));
    }

    return results;
  }

  private async runServiceChecks(
    services: NonNullable<VmModuleConfig["services"]>,
    context: TestContext
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const svc of services) {
      const start = Date.now();

      const result = await exec(svc.command, [], {
        timeout: context.config.timeout,
      });

      const output = result.stdout.trim();

      if (result.exitCode !== 0) {
        results.push(
          this.fail(
            `vm:service:${svc.name}`,
            Date.now() - start,
            `Service check command failed (exit ${result.exitCode}): ${svc.command}`
          )
        );
        continue;
      }

      if (output === svc.expectedOutput) {
        results.push(
          this.pass(
            `vm:service:${svc.name}`,
            Date.now() - start,
            `${svc.name} is ${output}`
          )
        );
      } else {
        results.push(
          this.fail(
            `vm:service:${svc.name}`,
            Date.now() - start,
            `${svc.name}: expected "${svc.expectedOutput}", got "${output}"`
          )
        );
      }
    }

    return results;
  }
}
