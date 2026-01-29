import { exec, type ExecResult } from "../../utils/process.js";
import type { CliCommandTest } from "../../types.js";

export interface CommandExecution {
  test: CliCommandTest;
  result: ExecResult;
  duration: number;
}

/**
 * Execute a CLI command test and return the raw result.
 * Uses the command-level binaryPath if set, otherwise falls back to the
 * module-level binaryPath.
 * Does not validate — that's handled by output-validator.
 */
export async function executeCommand(
  moduleBinaryPath: string | undefined,
  test: CliCommandTest,
  defaultTimeout: number
): Promise<CommandExecution> {
  const binaryPath = test.binaryPath ?? moduleBinaryPath;
  if (!binaryPath) {
    throw new Error(
      `No binaryPath for command "${test.name}": set it on the command or at the module level`
    );
  }

  const start = Date.now();

  const result = await exec(binaryPath, test.args, {
    cwd: test.cwd,
    env: test.env,
    stdin: test.stdin,
    timeout: test.timeout ?? defaultTimeout,
  });

  return {
    test,
    result,
    duration: Date.now() - start,
  };
}
