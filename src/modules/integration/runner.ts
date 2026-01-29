import type {
  TestResult,
  TestContext,
  IntegrationScenario,
  ModuleName,
} from "../../types.js";
import { getModule } from "../index.js";
import { executeModule } from "../../runner/lifecycle.js";

/**
 * Run an integration scenario — a sequence of steps that span
 * multiple modules, executing them in order and sharing state
 * through context.store.
 */
export async function runScenario(
  scenario: IntegrationScenario,
  context: TestContext
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const start = Date.now();

  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];

    // Load the module for this step
    const mod = await getModule(step.module);
    if (!mod) {
      results.push({
        name: `integration:${scenario.name}:step${i + 1}`,
        module: "integration",
        status: "error",
        duration: 0,
        message: `Module "${step.module}" not available for step ${i + 1}`,
        error: { message: `Module "${step.module}" is not registered` },
      });
      // Stop the scenario — subsequent steps likely depend on this one
      break;
    }

    // Execute the module
    const stepResults = await executeModule(mod, context);
    results.push(...stepResults);

    // Check if any step failed — stop scenario on failure
    const hasFailure = stepResults.some(
      (r) => r.status === "failed" || r.status === "error"
    );
    if (hasFailure) {
      results.push({
        name: `integration:${scenario.name}:aborted`,
        module: "integration",
        status: "skipped",
        duration: Date.now() - start,
        message: `Scenario "${scenario.name}" aborted at step ${i + 1} due to failure`,
      });
      break;
    }

    // Capture result if requested
    if (step.captureAs) {
      // Store the step results so subsequent steps can reference them
      context.store[step.captureAs] = stepResults;
    }
  }

  return results;
}
