import type { TestResult, TestContext, VmDependencyCheck } from "../../types.js";
import { exec } from "../../utils/process.js";
import semver from "semver";

/**
 * Run arbitrary commands to check dependency versions.
 * Useful for tools that don't follow the simple binary+flag pattern
 * (e.g., "tsc --version", "aws --version").
 */
export async function runDependencyChecks(
  dependencies: VmDependencyCheck[],
  context: TestContext
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const dep of dependencies) {
    const start = Date.now();

    const result = await exec(dep.command, [], {
      timeout: context.config.timeout,
    });

    const output = (result.stdout || result.stderr).trim();

    if (result.exitCode !== 0) {
      results.push({
        name: `vm:dep:${dep.name}`,
        module: "vm",
        status: "failed",
        duration: Date.now() - start,
        message: `Command failed (exit ${result.exitCode}): ${dep.command}`,
        error: {
          message: `Command "${dep.command}" exited with code ${result.exitCode}. Output: ${output}`,
        },
      });
      continue;
    }

    // If no version requirement, just check the command succeeds
    if (!dep.expectedVersion) {
      results.push({
        name: `vm:dep:${dep.name}`,
        module: "vm",
        status: "passed",
        duration: Date.now() - start,
        message: `${dep.name} is available: ${output}`,
      });
      continue;
    }

    // Extract and validate version
    const version = extractVersion(output);
    if (!version) {
      results.push({
        name: `vm:dep:${dep.name}`,
        module: "vm",
        status: "failed",
        duration: Date.now() - start,
        message: `Could not extract version from output: ${output}`,
        error: { message: `Could not extract version from output: ${output}` },
      });
      continue;
    }

    if (semver.satisfies(version, dep.expectedVersion)) {
      results.push({
        name: `vm:dep:${dep.name}`,
        module: "vm",
        status: "passed",
        duration: Date.now() - start,
        message: `${dep.name} v${version} satisfies ${dep.expectedVersion}`,
      });
    } else {
      results.push({
        name: `vm:dep:${dep.name}`,
        module: "vm",
        status: "failed",
        duration: Date.now() - start,
        message: `${dep.name} v${version} does not satisfy ${dep.expectedVersion}`,
        error: {
          message: `Version ${version} does not satisfy range ${dep.expectedVersion}`,
        },
      });
    }
  }

  return results;
}

function extractVersion(output: string): string | null {
  const match = output.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}
