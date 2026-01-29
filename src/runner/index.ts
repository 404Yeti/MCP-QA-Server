import type { ModuleName, TestReport, TestResult } from "../types.js";
import { loadConfig } from "../config/loader.js";
import { getModules } from "../modules/index.js";
import { createContext } from "./context.js";
import { executeModule } from "./lifecycle.js";
import { logger } from "../utils/logger.js";

export interface RunOptions {
  /** Only run these modules (defaults to all modules in config). */
  modules?: ModuleName[];
  /** Only run tests whose names match this substring. */
  filter?: string;
}

/**
 * Main entry point: load config, resolve modules, execute, return report.
 *
 * Config is always reloaded from disk so mid-session edits are picked up.
 */
export async function runTests(
  projectPath: string,
  options: RunOptions = {}
): Promise<TestReport> {
  const start = Date.now();

  // Load config fresh from disk
  const config = await loadConfig(projectPath);
  logger.info(`Loaded config for "${config.projectName}"`, {
    type: config.projectType,
    modules: config.modules,
  });

  // Determine which modules to run
  const requestedModules = options.modules ?? config.modules;
  const { modules, warnings } = await getModules(requestedModules);

  for (const w of warnings) {
    logger.warn(w);
  }

  // Build execution context
  const context = createContext(projectPath, config);

  // Execute each module sequentially
  const allResults: TestResult[] = [];
  for (const mod of modules) {
    const results = await executeModule(mod, context);

    // Apply name filter if provided
    if (options.filter) {
      const lower = options.filter.toLowerCase();
      const filtered = results.filter((r) =>
        r.name.toLowerCase().includes(lower)
      );
      allResults.push(...filtered);
    } else {
      allResults.push(...results);
    }
  }

  // Add warnings as skipped results so they appear in the report
  for (const w of warnings) {
    allResults.push({
      name: "module-warning",
      module: "integration", // closest fit for cross-cutting warnings
      status: "skipped",
      duration: 0,
      message: w,
    });
  }

  const duration = Date.now() - start;

  return buildReport(config.projectName, allResults, duration);
}

/**
 * Run a single module by name. Convenience wrapper around runTests.
 */
export async function runModule(
  projectPath: string,
  moduleName: ModuleName,
  testFilter?: string
): Promise<TestReport> {
  return runTests(projectPath, {
    modules: [moduleName],
    filter: testFilter,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildReport(
  projectName: string,
  results: TestResult[],
  duration: number
): TestReport {
  const summary = {
    total: results.length,
    passed: results.filter((r) => r.status === "passed").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
  };

  return {
    projectName,
    timestamp: new Date().toISOString(),
    duration,
    summary,
    results,
  };
}
