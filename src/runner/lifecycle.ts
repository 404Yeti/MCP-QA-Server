import type { BaseModule } from "../modules/base-module.js";
import type { TestContext, TestResult } from "../types.js";
import { logger } from "../utils/logger.js";

/**
 * Execute a single module through its full lifecycle:
 *   validate → setup → run → teardown
 *
 * Teardown always runs, even if run() throws.
 * Validation errors are returned as skipped test results.
 */
export async function executeModule(
  mod: BaseModule,
  context: TestContext
): Promise<TestResult[]> {
  // ── Validate ────────────────────────────────────────────────────────────
  const validationErrors = mod.validate(context);
  if (validationErrors.length > 0) {
    logger.warn(`Module "${mod.name}" failed validation`, {
      errors: validationErrors,
    });
    return validationErrors.map((msg) => ({
      name: `${mod.name}:validation`,
      module: mod.name,
      status: "skipped" as const,
      duration: 0,
      message: msg,
    }));
  }

  // ── Setup ───────────────────────────────────────────────────────────────
  try {
    logger.debug(`Setting up module "${mod.name}"`);
    await mod.setup(context);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Module "${mod.name}" setup failed`, { error: message });
    return [
      {
        name: `${mod.name}:setup`,
        module: mod.name,
        status: "error",
        duration: 0,
        message: `Setup failed: ${message}`,
        error: {
          message,
          stack: err instanceof Error ? err.stack : undefined,
        },
      },
    ];
  }

  // ── Run ─────────────────────────────────────────────────────────────────
  let results: TestResult[];
  try {
    logger.info(`Running module "${mod.name}"`);
    const start = Date.now();
    results = await mod.run(context);
    const elapsed = Date.now() - start;
    logger.info(`Module "${mod.name}" completed in ${elapsed}ms`, {
      total: results.length,
      passed: results.filter((r) => r.status === "passed").length,
      failed: results.filter((r) => r.status === "failed").length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Module "${mod.name}" threw unexpectedly`, { error: message });
    results = [
      {
        name: `${mod.name}:run`,
        module: mod.name,
        status: "error",
        duration: 0,
        message: `Module crashed: ${message}`,
        error: {
          message,
          stack: err instanceof Error ? err.stack : undefined,
        },
      },
    ];
  }

  // ── Teardown (always runs) ──────────────────────────────────────────────
  try {
    logger.debug(`Tearing down module "${mod.name}"`);
    await mod.teardown(context);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`Module "${mod.name}" teardown failed`, { error: message });
    results.push({
      name: `${mod.name}:teardown`,
      module: mod.name,
      status: "error",
      duration: 0,
      message: `Teardown failed: ${message}`,
      error: {
        message,
        stack: err instanceof Error ? err.stack : undefined,
      },
    });
  }

  return results;
}
