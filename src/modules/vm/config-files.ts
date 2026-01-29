import { readFile, access, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import type { TestResult, TestContext, VmConfigFileCheck } from "../../types.js";

/**
 * Validate that config files exist, contain expected content,
 * and optionally have the correct permissions.
 */
export async function runConfigFileChecks(
  configFiles: VmConfigFileCheck[],
  context: TestContext
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const check of configFiles) {
    const start = Date.now();
    const filePath = expandPath(check.path);

    // Check existence
    try {
      await access(filePath);
    } catch {
      if (check.exists) {
        results.push({
          name: `vm:config:${check.path}`,
          module: "vm",
          status: "failed",
          duration: Date.now() - start,
          message: `File does not exist: ${filePath}`,
          error: { message: `Expected file to exist: ${filePath}`, file: filePath },
        });
      } else {
        results.push({
          name: `vm:config:${check.path}`,
          module: "vm",
          status: "passed",
          duration: Date.now() - start,
          message: `File correctly does not exist: ${filePath}`,
        });
      }
      continue;
    }

    // File exists but shouldn't
    if (!check.exists) {
      results.push({
        name: `vm:config:${check.path}`,
        module: "vm",
        status: "failed",
        duration: Date.now() - start,
        message: `File should not exist but does: ${filePath}`,
        error: { message: `Expected file to not exist: ${filePath}`, file: filePath },
      });
      continue;
    }

    // Check permissions if specified
    if (check.permissions) {
      try {
        const fileStat = await stat(filePath);
        const mode = (fileStat.mode & 0o777).toString(8);
        if (mode !== check.permissions) {
          results.push({
            name: `vm:config:${check.path}:permissions`,
            module: "vm",
            status: "failed",
            duration: Date.now() - start,
            message: `${filePath} has permissions ${mode}, expected ${check.permissions}`,
            error: {
              message: `Permissions mismatch: got ${mode}, expected ${check.permissions}`,
              file: filePath,
            },
          });
          continue;
        }
      } catch (err) {
        results.push({
          name: `vm:config:${check.path}:permissions`,
          module: "vm",
          status: "error",
          duration: Date.now() - start,
          message: `Could not read permissions for ${filePath}`,
          error: {
            message: err instanceof Error ? err.message : String(err),
            file: filePath,
          },
        });
        continue;
      }
    }

    // Check content patterns
    if (check.contains && check.contains.length > 0) {
      let content: string;
      try {
        content = await readFile(filePath, "utf-8");
      } catch (err) {
        results.push({
          name: `vm:config:${check.path}`,
          module: "vm",
          status: "error",
          duration: Date.now() - start,
          message: `Could not read file: ${filePath}`,
          error: {
            message: err instanceof Error ? err.message : String(err),
            file: filePath,
          },
        });
        continue;
      }

      const missing = check.contains.filter(
        (pattern) => !content.includes(pattern)
      );

      if (missing.length > 0) {
        results.push({
          name: `vm:config:${check.path}`,
          module: "vm",
          status: "failed",
          duration: Date.now() - start,
          message: `${filePath} missing expected content: ${missing.map((m) => `"${m}"`).join(", ")}`,
          error: {
            message: `Missing content patterns: ${missing.join(", ")}`,
            file: filePath,
          },
        });
        continue;
      }
    }

    // All checks passed
    results.push({
      name: `vm:config:${check.path}`,
      module: "vm",
      status: "passed",
      duration: Date.now() - start,
      message: `${filePath} exists and passes all checks`,
    });
  }

  return results;
}

/**
 * Expand ~ to home directory in file paths.
 */
function expandPath(filePath: string): string {
  if (filePath.startsWith("~/")) {
    return resolve(homedir(), filePath.slice(2));
  }
  return resolve(filePath);
}
