import { spawn } from "node:child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  stdin?: string;
  timeout?: number; // milliseconds, default 30000
}

/**
 * Execute a shell command and capture stdout, stderr, and exit code.
 * Uses shell mode so piping and path resolution work cross-platform.
 */
export function exec(
  command: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<ExecResult> {
  const timeout = options.timeout ?? 30000;

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ? { ...process.env, ...options.env } : process.env,
      shell: true,
      timeout,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    if (options.stdin) {
      child.stdin?.write(options.stdin);
      child.stdin?.end();
    }

    child.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ETIMEDOUT") {
        timedOut = true;
      }
      resolve({
        stdout,
        stderr: stderr || err.message,
        exitCode: 1,
        timedOut,
      });
    });

    child.on("close", (code, signal) => {
      if (signal === "SIGTERM") {
        timedOut = true;
      }
      resolve({
        stdout: stdout.trimEnd(),
        stderr: stderr.trimEnd(),
        exitCode: code ?? 1,
        timedOut,
      });
    });
  });
}
