import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadConfig, validateConfig } from "./config/loader.js";
import { runTests, runModule } from "./runner/index.js";
import { formatReport } from "./reporter/index.js";
import { ALL_MODULES, getRegisteredModuleNames } from "./modules/index.js";
import { logger } from "./utils/logger.js";
import type { ModuleName, ReportFormat, TestReport } from "./types.js";

// ── In-memory cache for last report per project ──────────────────────────────
const lastReports = new Map<string, TestReport>();

// ── Server Instance ──────────────────────────────────────────────────────────

export function createServer(): McpServer {
  const server = new McpServer({
    name: "mcp-qa-server",
    version: "0.1.0",
  });

  // ── Tool: qa_run_tests ──────────────────────────────────────────────────
  server.registerTool(
    "qa_run_tests",
    {
      description:
        "Run QA tests for a project. Loads .mcp-qa-config.json from the project path, " +
        "executes the configured test modules, and returns a formatted report. " +
        "Optionally filter by module names or test name substring.",
      inputSchema: {
        projectPath: z
          .string()
          .describe("Absolute path to the project directory containing .mcp-qa-config.json"),
        modules: z
          .array(z.string())
          .optional()
          .describe("Only run these modules (e.g. ['web', 'api']). Defaults to all configured modules."),
        filter: z
          .string()
          .optional()
          .describe("Only run tests whose names contain this substring"),
      },
    },
    async ({ projectPath, modules, filter }) => {
      try {
        logger.info("qa_run_tests called", { projectPath, modules, filter });

        const report = await runTests(projectPath, {
          modules: modules as ModuleName[] | undefined,
          filter,
        });

        // Cache the report
        lastReports.set(projectPath, report);

        // Load config to get preferred report format
        const config = await loadConfig(projectPath);
        const formatted = formatReport(report, config.reportFormat);

        return {
          content: [{ type: "text" as const, text: formatted }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("qa_run_tests failed", { error: message });
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // ── Tool: qa_run_module ─────────────────────────────────────────────────
  server.registerTool(
    "qa_run_module",
    {
      description:
        "Run a single QA test module for a project. " +
        "Use this for targeted testing of a specific area (e.g. just API tests or just VM checks).",
      inputSchema: {
        projectPath: z
          .string()
          .describe("Absolute path to the project directory containing .mcp-qa-config.json"),
        module: z
          .string()
          .describe("Module name to run (e.g. 'web', 'api', 'cli', 'vm', 'wordpress', 'performance', 'integration')"),
        testFilter: z
          .string()
          .optional()
          .describe("Only run tests whose names contain this substring"),
      },
    },
    async ({ projectPath, module: moduleName, testFilter }) => {
      try {
        logger.info("qa_run_module called", { projectPath, moduleName, testFilter });

        const report = await runModule(
          projectPath,
          moduleName as ModuleName,
          testFilter
        );

        lastReports.set(projectPath, report);

        const config = await loadConfig(projectPath);
        const formatted = formatReport(report, config.reportFormat);

        return {
          content: [{ type: "text" as const, text: formatted }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("qa_run_module failed", { error: message });
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // ── Tool: qa_list_modules ───────────────────────────────────────────────
  server.registerTool(
    "qa_list_modules",
    {
      description:
        "List available QA testing modules. " +
        "If a projectPath is provided, also shows which modules are enabled for that project.",
      inputSchema: {
        projectPath: z
          .string()
          .optional()
          .describe("Optional project path to show project-specific module status"),
      },
    },
    async ({ projectPath }) => {
      try {
        const registered = new Set(getRegisteredModuleNames());
        let enabledModules: Set<string> | null = null;

        if (projectPath) {
          try {
            const config = await loadConfig(projectPath);
            enabledModules = new Set(config.modules);
          } catch {
            // Config load failed — just show all modules without project context
          }
        }

        const lines: string[] = ["Available QA Modules:", ""];

        for (const mod of ALL_MODULES) {
          const isRegistered = registered.has(mod.name);
          const isEnabled = enabledModules?.has(mod.name);

          let status = "";
          if (enabledModules) {
            status = isEnabled ? " [ENABLED]" : " [disabled]";
          }
          if (!isRegistered) {
            status += " (not yet implemented)";
          }

          lines.push(`  ${mod.name.padEnd(14)} ${mod.description}${status}`);
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // ── Tool: qa_check_config ───────────────────────────────────────────────
  server.registerTool(
    "qa_check_config",
    {
      description:
        "Validate a project's .mcp-qa-config.json file. " +
        "Returns validation results with specific error messages and line numbers if invalid.",
      inputSchema: {
        projectPath: z
          .string()
          .describe("Absolute path to the project directory containing .mcp-qa-config.json"),
      },
    },
    async ({ projectPath }) => {
      try {
        logger.info("qa_check_config called", { projectPath });

        // Try full load (includes file read + JSON parse + Zod validation)
        const config = await loadConfig(projectPath);

        const lines = [
          "Config is valid.",
          "",
          `  Project:  ${config.projectName}`,
          `  Type:     ${config.projectType}`,
          `  Modules:  ${config.modules.join(", ")} (${config.modules.length} active)`,
          `  Format:   ${config.reportFormat}`,
          `  Timeout:  ${config.timeout}ms`,
        ];

        if (config.baseUrl) {
          lines.push(`  Base URL: ${config.baseUrl}`);
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn("qa_check_config found issues", { error: message });
        return {
          content: [
            {
              type: "text" as const,
              text: `Config validation failed:\n\n${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ── Tool: qa_get_report ─────────────────────────────────────────────────
  server.registerTool(
    "qa_get_report",
    {
      description:
        "Retrieve the last test report for a project. " +
        "Optionally specify a different output format than what the config defaults to.",
      inputSchema: {
        projectPath: z
          .string()
          .describe("Absolute path to the project directory"),
        format: z
          .enum(["console", "json", "github"])
          .optional()
          .describe("Output format. Defaults to the project's configured format."),
      },
    },
    async ({ projectPath, format }) => {
      try {
        const report = lastReports.get(projectPath);
        if (!report) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No test report found for this project. Run qa_run_tests first.",
              },
            ],
          };
        }

        let reportFormat: ReportFormat = format as ReportFormat;
        if (!reportFormat) {
          try {
            const config = await loadConfig(projectPath);
            reportFormat = config.reportFormat;
          } catch {
            reportFormat = "console";
          }
        }

        const formatted = formatReport(report, reportFormat);

        return {
          content: [{ type: "text" as const, text: formatted }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}
