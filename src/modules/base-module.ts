import type { ModuleName, TestResult, TestContext } from "../types.js";

/**
 * Abstract base class that every testing module extends.
 *
 * Each module is responsible for:
 * - Declaring its name and description
 * - Validating that it has the config it needs to run
 * - Running its tests and returning structured results
 */
export abstract class BaseModule {
  /** Unique module identifier used in config and CLI. */
  abstract readonly name: ModuleName;

  /** Human-readable description shown in list-modules output. */
  abstract readonly description: string;

  /**
   * Execute all tests for this module and return results.
   * Implementations should catch their own errors and return them as
   * failed/error TestResult entries rather than throwing.
   */
  abstract run(context: TestContext): Promise<TestResult[]>;

  /**
   * Check whether the module has enough config to run.
   * Returns a list of validation error messages (empty = valid).
   * Called before run() to give early feedback.
   */
  validate(context: TestContext): string[] {
    // Default: no extra validation. Modules override as needed.
    return [];
  }

  /**
   * Optional setup hook called before run().
   * Use for expensive one-time initialization (e.g., launching a browser).
   */
  async setup(_context: TestContext): Promise<void> {
    // Default: no-op
  }

  /**
   * Optional teardown hook called after run(), even if run() threw.
   * Use for cleanup (e.g., closing a browser).
   */
  async teardown(_context: TestContext): Promise<void> {
    // Default: no-op
  }

  /**
   * Helper to create a passing TestResult.
   */
  protected pass(name: string, duration: number, message?: string): TestResult {
    return {
      name,
      module: this.name,
      status: "passed",
      duration,
      message,
    };
  }

  /**
   * Helper to create a failing TestResult.
   */
  protected fail(
    name: string,
    duration: number,
    message: string,
    file?: string,
    line?: number
  ): TestResult {
    return {
      name,
      module: this.name,
      status: "failed",
      duration,
      message,
      error: { message, file, line },
    };
  }

  /**
   * Helper to create an error TestResult (unexpected exception).
   */
  protected error(
    name: string,
    duration: number,
    err: unknown,
    file?: string,
    line?: number
  ): TestResult {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    return {
      name,
      module: this.name,
      status: "error",
      duration,
      message,
      error: { message, file, line, stack },
    };
  }

  /**
   * Helper to create a skipped TestResult.
   */
  protected skip(name: string, reason: string): TestResult {
    return {
      name,
      module: this.name,
      status: "skipped",
      duration: 0,
      message: reason,
    };
  }
}
