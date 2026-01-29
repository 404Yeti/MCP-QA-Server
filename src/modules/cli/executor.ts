import { exec, type ExecResult } from "../../utils/process.js";
import type { CliCommandTest } from "../../types.js";

export interface CommandExecution {
  test: CliCommandTest;
  result: ExecResult;
  duration: number;
}

/**
 * Execute a CLI command test and return the raw result.
 * Does not validate — that's handled by output-validator.
 */
export async function executeCommand(
  binaryPath: string,
  test: CliCommandTest,
  defaultTimeout: number
): Promise<CommandExecution> {
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
