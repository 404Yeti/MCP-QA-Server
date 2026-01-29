import { writeFile, access } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import inquirer from "inquirer";
import chalk from "chalk";
import type { ProjectType, ModuleName, ReportFormat } from "../../src/types.js";
import { getDefaults, getDefaultModules } from "../../src/config/defaults.js";

interface InitAnswers {
  projectName: string;
  projectType: ProjectType;
  baseUrl?: string;
  binaryPath?: string;
  wpPath?: string;
  wpCliAvailable?: boolean;
  modules: ModuleName[];
  reportFormat: ReportFormat;
}

const PROJECT_TYPE_CHOICES = [
  { name: "Web Application", value: "web-app" as const },
  { name: "API Service", value: "api-service" as const },
  { name: "CLI Tool", value: "cli-tool" as const },
  { name: "VM Environment", value: "vm-environment" as const },
  { name: "WordPress Site", value: "wordpress-site" as const },
];

const MODULE_CHOICES: { name: string; value: ModuleName }[] = [
  { name: "Web/UI Testing", value: "web" },
  { name: "API Testing", value: "api" },
  { name: "CLI Testing", value: "cli" },
  { name: "VM Environment Validation", value: "vm" },
  { name: "WordPress Testing", value: "wordpress" },
  { name: "Integration Testing", value: "integration" },
  { name: "Performance Testing", value: "performance" },
];

const REPORT_FORMAT_CHOICES = [
  {
    name: "Console (human-readable with colors)",
    value: "console" as const,
  },
  { name: "JSON (machine-readable)", value: "json" as const },
  {
    name: "GitHub Actions (annotation format)",
    value: "github" as const,
  },
];

export async function runInit(): Promise<void> {
  const cwd = process.cwd();
  const configPath = join(cwd, ".mcp-qa-config.json");

  console.log("");
  console.log(chalk.bold("  MCP QA Server — Project Initialization"));
  console.log(chalk.dim("  ──────────────────────────────────────────"));
  console.log("");

  // Check if config already exists
  try {
    await access(configPath);
    const { overwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: ".mcp-qa-config.json already exists. Overwrite?",
        default: false,
      },
    ]);
    if (!overwrite) {
      console.log(chalk.yellow("  Aborted. Existing config unchanged."));
      return;
    }
  } catch {
    // File doesn't exist — proceed
  }

  // Gather answers
  const answers = await inquirer.prompt<InitAnswers>([
    {
      type: "input",
      name: "projectName",
      message: "Project name:",
      default: basename(cwd),
    },
    {
      type: "list",
      name: "projectType",
      message: "Project type:",
      choices: PROJECT_TYPE_CHOICES,
    },
    {
      type: "input",
      name: "baseUrl",
      message: "Base URL:",
      when: (a: InitAnswers) =>
        ["web-app", "api-service", "wordpress-site"].includes(a.projectType),
      default: (a: InitAnswers) => {
        switch (a.projectType) {
          case "web-app":
            return "http://localhost:3000";
          case "api-service":
            return "http://localhost:4000";
          case "wordpress-site":
            return "http://localhost:8080";
          default:
            return undefined;
        }
      },
    },
    {
      type: "input",
      name: "binaryPath",
      message: "Path to CLI binary:",
      when: (a: InitAnswers) => a.projectType === "cli-tool",
      default: "./dist/index.js",
    },
    {
      type: "input",
      name: "wpPath",
      message: "WordPress installation path:",
      when: (a: InitAnswers) => a.projectType === "wordpress-site",
      default: "/var/www/html",
    },
    {
      type: "confirm",
      name: "wpCliAvailable",
      message: "Is WP-CLI available?",
      when: (a: InitAnswers) => a.projectType === "wordpress-site",
      default: false,
    },
    {
      type: "checkbox",
      name: "modules",
      message: "Which testing modules do you need?",
      choices: (a: InitAnswers) => {
        const defaults = new Set(getDefaultModules(a.projectType));
        return MODULE_CHOICES.map((c) => ({
          ...c,
          checked: defaults.has(c.value),
        }));
      },
      validate: (val: ModuleName[]) =>
        val.length > 0 || "Select at least one module",
    },
    {
      type: "list",
      name: "reportFormat",
      message: "Report format:",
      choices: REPORT_FORMAT_CHOICES,
      default: "console",
    },
  ]);

  // Build config object
  const defaults = getDefaults(answers.projectType);
  const moduleConfig: Record<string, unknown> = {};

  // Populate moduleConfig with defaults for selected modules
  for (const mod of answers.modules) {
    if (defaults.moduleConfig[mod]) {
      const defaultModCfg = defaults.moduleConfig[mod] as Record<string, unknown>;
      moduleConfig[mod] = { ...defaultModCfg };
    } else {
      moduleConfig[mod] = {};
    }
  }

  // Override specific fields from prompts
  if (answers.binaryPath && moduleConfig["cli"]) {
    (moduleConfig["cli"] as Record<string, unknown>)["binaryPath"] =
      answers.binaryPath;
  }
  if (answers.projectType === "wordpress-site" && moduleConfig["wordpress"]) {
    const wpCfg = moduleConfig["wordpress"] as Record<string, unknown>;
    if (answers.wpPath) wpCfg["wpPath"] = answers.wpPath;
    if (answers.wpCliAvailable !== undefined)
      wpCfg["wpCliAvailable"] = answers.wpCliAvailable;
  }

  const config = {
    configVersion: 1,
    projectName: answers.projectName,
    projectType: answers.projectType,
    modules: answers.modules,
    reportFormat: answers.reportFormat,
    ...(answers.baseUrl ? { baseUrl: answers.baseUrl } : {}),
    timeout: defaults.timeout,
    moduleConfig,
  };

  // Write config file
  const json = JSON.stringify(config, null, 2) + "\n";
  await writeFile(configPath, json, "utf-8");

  // Print summary
  console.log("");
  console.log(chalk.green("  Created .mcp-qa-config.json"));
  console.log("");
  console.log(chalk.bold("  Summary:"));
  console.log(`    Project:  ${answers.projectName}`);
  console.log(`    Type:     ${answers.projectType}`);
  console.log(`    Modules:  ${answers.modules.join(", ")}`);
  if (answers.baseUrl) {
    console.log(`    Base URL: ${answers.baseUrl}`);
  }
  console.log(`    Report:   ${answers.reportFormat}`);
  console.log("");
  console.log(chalk.bold("  Next steps:"));
  console.log(
    `    1. Edit .mcp-qa-config.json to add your specific test targets`
  );
  console.log(
    `    2. Add the MCP server to your Claude Desktop config:`
  );
  console.log(chalk.dim(`       {`));
  console.log(chalk.dim(`         "mcpServers": {`));
  console.log(chalk.dim(`           "qa": {`));
  console.log(chalk.dim(`             "command": "node",`));
  console.log(
    chalk.dim(
      `             "args": ["${resolve(dirname(fileURLToPath(import.meta.url)), "../../dist/src/index.js")}"]`
    )
  );
  console.log(chalk.dim(`           }`));
  console.log(chalk.dim(`         }`));
  console.log(chalk.dim(`       }`));
  console.log(
    `    3. Ask Claude to run your QA tests!`
  );
  console.log("");
}
