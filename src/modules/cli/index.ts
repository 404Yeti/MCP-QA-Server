import { BaseModule } from "../base-module.js";
import type {
  ModuleName,
  TestResult,
  TestContext,
  CliModuleConfig,
} from "../../types.js";
import { executeCommand } from "./executor.js";
import { validateExecution, validateCreatedFiles } from "./output-validator.js";

export class CliModule extends BaseModule {
  readonly name: ModuleName = "cli";
  readonly description = "CLI tool testing (command execution, output validation)";

  validate(context: TestContext): string[] {
    const cfg = context.config.moduleConfig["cli"] as CliModuleConfig | undefined;
    if (!cfg) return [];

    const errors: string[] = [];
    if (!cfg.commands || cfg.commands.length === 0) {
      errors.push("CLI module has no commands configured");
    } else if (!cfg.binaryPath) {
      // If no module-level binaryPath, every command must have its own
      const missing = cfg.commands.filter((c) => !c.binaryPath);
      if (missing.length > 0) {
        errors.push(
          `No module-level binaryPath set and ${missing.length} command(s) missing binaryPath: ${missing.map((c) => c.name).join(", ")}`
        );
      }
    }
    return errors;
  }

  async run(context: TestContext): Promise<TestResult[]> {
    const cfg = context.config.moduleConfig["cli"] as CliModuleConfig | undefined;
    if (!cfg) {
      return [this.skip("cli", "No CLI module configuration found")];
    }

    if (!cfg.commands || cfg.commands.length === 0) {
      return [this.skip("cli", "No CLI commands configured")];
    }

    const results: TestResult[] = [];

    for (const test of cfg.commands) {
      try {
        const execution = await executeCommand(
          cfg.binaryPath,
          test,
          context.config.timeout
        );

        // Validate output
        results.push(...validateExecution(execution, context.projectPath));

        // Validate created files
        results.push(...await validateCreatedFiles(execution, context.projectPath));
      } catch (err) {
        results.push(
          this.error(`cli:${test.name}`, 0, err)
        );
      }
    }

    return results;
  }
}
