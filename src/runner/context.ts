import type { ProjectConfig, TestContext } from "../types.js";

/**
 * Create a fresh test execution context for a run.
 */
export function createContext(
  projectPath: string,
  config: ProjectConfig
): TestContext {
  return {
    projectPath,
    config,
    store: {},
    startTime: Date.now(),
  };
}
