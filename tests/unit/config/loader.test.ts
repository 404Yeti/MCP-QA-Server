import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig, validateConfig } from "../../../src/config/loader.js";

const TEST_DIR = join(import.meta.dirname, "../../.tmp-config-test");
const CONFIG_PATH = join(TEST_DIR, ".mcp-qa-config.json");

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("loads a valid config file", async () => {
    await writeFile(
      CONFIG_PATH,
      JSON.stringify({
        configVersion: 1,
        projectName: "test-project",
        projectType: "web-app",
        modules: ["web"],
        reportFormat: "console",
        timeout: 5000,
        baseUrl: "http://localhost:3000",
        moduleConfig: {},
      })
    );

    const config = await loadConfig(TEST_DIR);
    expect(config.projectName).toBe("test-project");
    expect(config.projectType).toBe("web-app");
    expect(config.modules).toEqual(["web"]);
    expect(config.timeout).toBe(5000);
  });

  it("applies default values for optional fields", async () => {
    await writeFile(
      CONFIG_PATH,
      JSON.stringify({
        projectName: "minimal",
        projectType: "cli-tool",
        modules: ["cli"],
      })
    );

    const config = await loadConfig(TEST_DIR);
    expect(config.configVersion).toBe(1);
    expect(config.reportFormat).toBe("console");
    expect(config.timeout).toBe(30000);
    expect(config.moduleConfig).toEqual({});
  });

  it("throws ConfigError for missing file", async () => {
    await expect(loadConfig("/tmp/nonexistent-dir-xyz")).rejects.toThrow(
      "Config file not found"
    );
  });

  it("throws ConfigError for invalid JSON", async () => {
    await writeFile(CONFIG_PATH, "{ bad json }}}");
    await expect(loadConfig(TEST_DIR)).rejects.toThrow("Invalid JSON");
  });

  it("throws ConfigError for schema violations", async () => {
    await writeFile(
      CONFIG_PATH,
      JSON.stringify({
        projectName: "bad",
        projectType: "invalid-type",
        modules: [],
      })
    );
    await expect(loadConfig(TEST_DIR)).rejects.toThrow(
      "Config validation failed"
    );
  });

  it("validates module-specific config sections", async () => {
    await writeFile(
      CONFIG_PATH,
      JSON.stringify({
        projectName: "test",
        projectType: "web-app",
        modules: ["web"],
        baseUrl: "http://localhost:3000",
        moduleConfig: {
          web: {
            pages: [
              {
                name: "Home",
                path: "/",
                expectedStatus: "not-a-number",
              },
            ],
          },
        },
      })
    );
    await expect(loadConfig(TEST_DIR)).rejects.toThrow(
      "Module config validation failed"
    );
  });
});

describe("validateConfig", () => {
  it("returns valid for a correct config object", () => {
    const result = validateConfig({
      projectName: "test",
      projectType: "api-service",
      modules: ["api"],
      baseUrl: "http://localhost:4000",
      moduleConfig: {},
    });
    expect(result.valid).toBe(true);
    expect(result.config).toBeDefined();
    expect(result.config!.projectName).toBe("test");
  });

  it("returns errors for invalid config", () => {
    const result = validateConfig({
      projectName: "",
      projectType: "bad",
      modules: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it("validates module config cross-references", () => {
    const result = validateConfig({
      projectName: "test",
      projectType: "cli-tool",
      modules: ["cli"],
      moduleConfig: {
        cli: {
          binaryPath: "./my-tool",
          commands: [
            {
              name: "test",
              args: ["--help"],
              expectedExitCode: "not-a-number",
            },
          ],
        },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors!.some((e) => e.includes("expectedExitCode"))).toBe(
      true
    );
  });
});
