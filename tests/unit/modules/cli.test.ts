import { describe, it, expect } from "vitest";
import { CliModule } from "../../../src/modules/cli/index.js";
import type { TestContext, ProjectConfig } from "../../../src/types.js";

function makeContext(moduleConfig: Record<string, unknown>): TestContext {
  const config: ProjectConfig = {
    configVersion: 1,
    projectName: "test",
    projectType: "cli-tool",
    modules: ["cli"],
    reportFormat: "console",
    timeout: 10000,
    moduleConfig,
  };
  return {
    projectPath: "/tmp/test",
    config,
    store: {},
    startTime: Date.now(),
  };
}

describe("CliModule", () => {
  const mod = new CliModule();

  it("has correct name and description", () => {
    expect(mod.name).toBe("cli");
    expect(mod.description).toContain("CLI");
  });

  it("skips when no config provided", async () => {
    const ctx = makeContext({});
    const results = await mod.run(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("skipped");
  });

  it("validates missing binaryPath", () => {
    const ctx = makeContext({
      cli: { commands: [{ name: "test", args: [], expectedExitCode: 0 }] },
    });
    const errors = mod.validate(ctx);
    expect(errors.some((e) => e.includes("binaryPath"))).toBe(true);
  });

  it("passes when command exits with expected code", async () => {
    const ctx = makeContext({
      cli: {
        binaryPath: "echo",
        commands: [
          { name: "Echo test", args: ["hello"], expectedExitCode: 0 },
        ],
      },
    });
    const results = await mod.run(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("passed");
  });

  it("fails when exit code doesn't match", async () => {
    const ctx = makeContext({
      cli: {
        binaryPath: "false",
        commands: [
          { name: "Should fail", args: [], expectedExitCode: 0 },
        ],
      },
    });
    const results = await mod.run(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("failed");
    expect(results[0].message).toContain("Exit code");
  });

  it("validates stdout contains expected strings", async () => {
    const ctx = makeContext({
      cli: {
        binaryPath: "echo",
        commands: [
          {
            name: "Contains check",
            args: ["hello world"],
            expectedExitCode: 0,
            expectedOutput: { contains: ["hello", "world"] },
          },
        ],
      },
    });
    const results = await mod.run(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("passed");
  });

  it("fails when stdout missing expected content", async () => {
    const ctx = makeContext({
      cli: {
        binaryPath: "echo",
        commands: [
          {
            name: "Missing content",
            args: ["hello"],
            expectedExitCode: 0,
            expectedOutput: { contains: ["goodbye"] },
          },
        ],
      },
    });
    const results = await mod.run(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("failed");
    expect(results[0].message).toContain("goodbye");
  });

  it("validates stdout regex patterns", async () => {
    const ctx = makeContext({
      cli: {
        binaryPath: "node",
        commands: [
          {
            name: "Version pattern",
            args: ["--version"],
            expectedExitCode: 0,
            expectedOutput: { pattern: "v\\d+\\.\\d+\\.\\d+" },
          },
        ],
      },
    });
    const results = await mod.run(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("passed");
  });
});
