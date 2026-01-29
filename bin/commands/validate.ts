import { readFile } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { validateConfig } from "../../src/config/loader.js";

export async function runValidate(): Promise<void> {
  const cwd = process.cwd();
  const configPath = join(cwd, ".mcp-qa-config.json");

  console.log("");

  // Read file
  let raw: string;
  try {
    raw = await readFile(configPath, "utf-8");
  } catch {
    console.log(
      chalk.red(`  Config file not found: ${configPath}`)
    );
    console.log(
      chalk.dim(`  Run "mcp-qa init" to create one.`)
    );
    console.log("");
    process.exitCode = 1;
    return;
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.log(chalk.red(`  Invalid JSON in ${configPath}`));
    console.log(
      chalk.dim(`  ${err instanceof Error ? err.message : String(err)}`)
    );
    console.log("");
    process.exitCode = 1;
    return;
  }

  // Validate
  const result = validateConfig(parsed);

  if (result.valid && result.config) {
    const cfg = result.config;
    console.log(chalk.green("  Config is valid"));
    console.log("");
    console.log(`    Project:  ${cfg.projectName}`);
    console.log(`    Type:     ${cfg.projectType}`);
    console.log(
      `    Modules:  ${cfg.modules.join(", ")} (${cfg.modules.length} active)`
    );
    console.log(`    Format:   ${cfg.reportFormat}`);
    console.log(`    Timeout:  ${cfg.timeout}ms`);
    if (cfg.baseUrl) {
      console.log(`    Base URL: ${cfg.baseUrl}`);
    }
    console.log(`    Issues:   none`);
  } else {
    console.log(chalk.red("  Config validation failed:"));
    console.log("");
    if (result.errors) {
      for (const err of result.errors) {
        console.log(chalk.red(`    ✗ ${err}`));
      }
    }
    process.exitCode = 1;
  }

  console.log("");
}
