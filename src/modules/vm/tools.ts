import type { TestResult, TestContext, VmToolCheck } from "../../types.js";
import { exec } from "../../utils/process.js";
import semver from "semver";

/**
 * Check that required tools/binaries are installed and optionally
 * validate their version against a semver range.
 */
export async function runToolChecks(
  tools: VmToolCheck[],
  context: TestContext
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const tool of tools) {
    const start = Date.now();

    // Check binary exists (POSIX-portable)
    const whichResult = await exec("command", ["-v", tool.binary], {
      timeout: context.config.timeout,
    });

    if (whichResult.exitCode !== 0) {
      results.push({
        name: `vm:tool:${tool.name}`,
        module: "vm",
        status: "failed",
        duration: Date.now() - start,
        message: `Binary "${tool.binary}" not found on PATH`,
        error: { message: `Binary "${tool.binary}" not found on PATH` },
      });
      continue;
    }

    // If no version check needed, pass
    if (!tool.versionFlag || !tool.expectedVersion) {
      results.push({
        name: `vm:tool:${tool.name}`,
        module: "vm",
        status: "passed",
        duration: Date.now() - start,
        message: `${tool.name} is installed at ${whichResult.stdout.trim()}`,
      });
      continue;
    }

    // Extract version
    const versionResult = await exec(tool.binary, [tool.versionFlag], {
      timeout: context.config.timeout,
    });

    const rawOutput = (versionResult.stdout || versionResult.stderr).trim();
    const version = extractVersion(rawOutput);

    if (!version) {
      results.push({
        name: `vm:tool:${tool.name}`,
        module: "vm",
        status: "failed",
        duration: Date.now() - start,
        message: `Could not extract version from "${tool.binary} ${tool.versionFlag}" output: ${rawOutput}`,
        error: {
          message: `Could not extract version from output: ${rawOutput}`,
        },
      });
      continue;
    }

    // Validate semver range
    if (semver.satisfies(version, tool.expectedVersion)) {
      results.push({
        name: `vm:tool:${tool.name}`,
        module: "vm",
        status: "passed",
        duration: Date.now() - start,
        message: `${tool.name} v${version} satisfies ${tool.expectedVersion}`,
      });
    } else {
      results.push({
        name: `vm:tool:${tool.name}`,
        module: "vm",
        status: "failed",
        duration: Date.now() - start,
        message: `${tool.name} v${version} does not satisfy ${tool.expectedVersion}`,
        error: {
          message: `Version ${version} does not satisfy range ${tool.expectedVersion}`,
        },
      });
    }
  }

  return results;
}

/**
 * Extract a semver-like version string from command output.
 * Handles common formats: "v20.10.0", "git version 2.43.0", "Python 3.10.12", etc.
 */
function extractVersion(output: string): string | null {
  const match = output.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}
