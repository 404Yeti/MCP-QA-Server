import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import type { TestResult } from "../../types.js";
import type { CommandExecution } from "./executor.js";

/**
 * Validate a command execution result against the test expectations.
 * Returns a list of TestResult entries (one per check that was specified).
 */
export function validateExecution(
  execution: CommandExecution,
  projectPath: string
): TestResult[] {
  const { test, result, duration } = execution;
  const failures: string[] = [];

  // Timeout check
  if (result.timedOut) {
    return [
      {
        name: `cli:${test.name}`,
        module: "cli",
        status: "failed",
        duration,
        message: `Command timed out`,
        error: { message: `Command timed out after ${test.timeout ?? "default"}ms` },
      },
    ];
  }

  // Exit code
  if (result.exitCode !== test.expectedExitCode) {
    failures.push(
      `Exit code: expected ${test.expectedExitCode}, got ${result.exitCode}`
    );
  }

  // stdout validation
  if (test.expectedOutput) {
    const stdout = result.stdout;

    if (test.expectedOutput.exact !== undefined) {
      if (stdout !== test.expectedOutput.exact) {
        failures.push(
          `stdout exact match failed. Expected: "${truncate(test.expectedOutput.exact)}", Got: "${truncate(stdout)}"`
        );
      }
    }

    if (test.expectedOutput.contains) {
      for (const expected of test.expectedOutput.contains) {
        if (!stdout.includes(expected)) {
          failures.push(`stdout missing expected string: "${expected}"`);
        }
      }
    }

    if (test.expectedOutput.pattern) {
      const regex = new RegExp(test.expectedOutput.pattern);
      if (!regex.test(stdout)) {
        failures.push(
          `stdout does not match pattern: /${test.expectedOutput.pattern}/`
        );
      }
    }
  }

  // stderr validation
  if (test.expectedStderr) {
    const stderr = result.stderr;

    if (test.expectedStderr.empty && stderr.length > 0) {
      failures.push(`stderr should be empty but got: "${truncate(stderr)}"`);
    }

    if (test.expectedStderr.contains) {
      for (const expected of test.expectedStderr.contains) {
        if (!stderr.includes(expected)) {
          failures.push(`stderr missing expected string: "${expected}"`);
        }
      }
    }

    if (test.expectedStderr.pattern) {
      const regex = new RegExp(test.expectedStderr.pattern);
      if (!regex.test(stderr)) {
        failures.push(
          `stderr does not match pattern: /${test.expectedStderr.pattern}/`
        );
      }
    }
  }

  if (failures.length === 0) {
    return [
      {
        name: `cli:${test.name}`,
        module: "cli",
        status: "passed",
        duration,
        message: `Command "${test.name}" passed all checks`,
      },
    ];
  }

  return [
    {
      name: `cli:${test.name}`,
      module: "cli",
      status: "failed",
      duration,
      message: failures.join("; "),
      error: { message: failures.join("\n") },
    },
  ];
}

/**
 * Validate that expected files were created by a command.
 */
export async function validateCreatedFiles(
  execution: CommandExecution,
  projectPath: string
): Promise<TestResult[]> {
  const { test, duration } = execution;
  if (!test.createsFiles || test.createsFiles.length === 0) return [];

  const results: TestResult[] = [];

  for (const fileCheck of test.createsFiles) {
    const filePath = resolve(projectPath, fileCheck.path);

    try {
      await access(filePath);
    } catch {
      results.push({
        name: `cli:${test.name}:file:${fileCheck.path}`,
        module: "cli",
        status: "failed",
        duration: 0,
        message: `Expected file not created: ${fileCheck.path}`,
        error: { message: `File not found: ${filePath}`, file: filePath },
      });
      continue;
    }

    if (fileCheck.contains && fileCheck.contains.length > 0) {
      const content = await readFile(filePath, "utf-8");
      const missing = fileCheck.contains.filter((s) => !content.includes(s));

      if (missing.length > 0) {
        results.push({
          name: `cli:${test.name}:file:${fileCheck.path}`,
          module: "cli",
          status: "failed",
          duration: 0,
          message: `File ${fileCheck.path} missing content: ${missing.join(", ")}`,
          error: {
            message: `Missing content: ${missing.join(", ")}`,
            file: filePath,
          },
        });
        continue;
      }
    }

    results.push({
      name: `cli:${test.name}:file:${fileCheck.path}`,
      module: "cli",
      status: "passed",
      duration: 0,
      message: `File ${fileCheck.path} exists and passes all checks`,
    });
  }

  return results;
}

function truncate(str: string, maxLen = 200): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}
