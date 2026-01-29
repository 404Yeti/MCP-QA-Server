import { describe, it, expect } from "vitest";
import { VmModule } from "../../../src/modules/vm/index.js";
import type { TestContext, ProjectConfig } from "../../../src/types.js";

function makeContext(moduleConfig: Record<string, unknown>): TestContext {
  const config: ProjectConfig = {
    configVersion: 1,
    projectName: "test",
    projectType: "vm-environment",
    modules: ["vm"],
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

describe("VmModule", () => {
  const mod = new VmModule();

  it("has correct name and description", () => {
    expect(mod.name).toBe("vm");
    expect(mod.description).toContain("VM");
  });

  it("skips when no config provided", async () => {
    const ctx = makeContext({});
    const results = await mod.run(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("skipped");
  });

  it("validates empty config warns", () => {
    const ctx = makeContext({
      vm: { tools: [], dependencies: [], configFiles: [], services: [] },
    });
    const errors = mod.validate(ctx);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("no tools");
  });

  it("detects installed tool (node)", async () => {
    const ctx = makeContext({
      vm: {
        tools: [
          { name: "Node.js", binary: "node", versionFlag: "--version", expectedVersion: ">=18.0.0" },
        ],
      },
    });
    const results = await mod.run(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("passed");
    expect(results[0].message).toContain("Node.js");
  });

  it("detects missing tool", async () => {
    const ctx = makeContext({
      vm: {
        tools: [
          { name: "FakeTool", binary: "absolutely-fake-binary-xyz" },
        ],
      },
    });
    const results = await mod.run(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("failed");
    expect(results[0].message).toContain("not found");
  });

  it("validates version ranges", async () => {
    const ctx = makeContext({
      vm: {
        tools: [
          { name: "Node.js", binary: "node", versionFlag: "--version", expectedVersion: ">=999.0.0" },
        ],
      },
    });
    const results = await mod.run(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("failed");
    expect(results[0].message).toContain("does not satisfy");
  });

  it("checks config file existence", async () => {
    const ctx = makeContext({
      vm: {
        configFiles: [
          { path: "/tmp", exists: true },
          { path: "/tmp/nonexistent-file-xyz-test", exists: false },
        ],
      },
    });
    const results = await mod.run(ctx);
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("passed");
    expect(results[1].status).toBe("passed");
  });

  it("fails when expected file is missing", async () => {
    const ctx = makeContext({
      vm: {
        configFiles: [
          { path: "/tmp/nonexistent-file-xyz-test", exists: true },
        ],
      },
    });
    const results = await mod.run(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("failed");
    expect(results[0].message).toContain("does not exist");
  });

  it("runs dependency checks", async () => {
    const ctx = makeContext({
      vm: {
        dependencies: [
          { name: "Node version", command: "node --version" },
        ],
      },
    });
    const results = await mod.run(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("passed");
  });
});
