import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const SERVER_PATH = join(import.meta.dirname, "../../dist/src/index.js");
const PROJECT_DIR = join(import.meta.dirname, "../.tmp-integration-test");

let server: ChildProcess;
let requestId = 0;

function nextId(): number {
  return ++requestId;
}

/**
 * Send a JSON-RPC message to the server and wait for a response with the given id.
 */
function sendRequest(
  method: string,
  params: unknown = {},
  id?: number
): Promise<Record<string, unknown>> {
  const msgId = id ?? nextId();
  const msg = JSON.stringify({ jsonrpc: "2.0", id: msgId, method, params });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for response to ${method} (id=${msgId})`));
    }, 15000);

    const handler = (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === msgId) {
            clearTimeout(timeout);
            server.stdout!.off("data", handler);
            resolve(parsed);
            return;
          }
        } catch {
          // Not JSON or not our response, ignore
        }
      }
    };

    server.stdout!.on("data", handler);
    server.stdin!.write(msg + "\n");
  });
}

function sendNotification(method: string, params: unknown = {}): void {
  const msg = JSON.stringify({ jsonrpc: "2.0", method, params });
  server.stdin!.write(msg + "\n");
}

beforeAll(async () => {
  // Create test project with config
  await mkdir(PROJECT_DIR, { recursive: true });
  await writeFile(
    join(PROJECT_DIR, ".mcp-qa-config.json"),
    JSON.stringify({
      configVersion: 1,
      projectName: "integration-test",
      projectType: "vm-environment",
      modules: ["vm"],
      reportFormat: "console",
      timeout: 10000,
      moduleConfig: {
        vm: {
          tools: [
            {
              name: "Node.js",
              binary: "node",
              versionFlag: "--version",
              expectedVersion: ">=18.0.0",
            },
          ],
          configFiles: [
            { path: "/tmp", exists: true },
          ],
        },
      },
    })
  );

  // Start server
  server = spawn("node", [SERVER_PATH], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Initialize handshake
  const initResponse = await sendRequest("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "integration-test", version: "0.1.0" },
  });

  expect(initResponse.result).toBeDefined();

  // Send initialized notification
  sendNotification("notifications/initialized");

  // Small delay to ensure server is ready
  await new Promise((r) => setTimeout(r, 200));
});

afterAll(async () => {
  if (server) {
    server.kill();
    // Wait for process to exit
    await new Promise<void>((resolve) => {
      server.on("close", () => resolve());
      setTimeout(resolve, 2000);
    });
  }
  await rm(PROJECT_DIR, { recursive: true, force: true });
});

describe("MCP Server Integration", () => {
  it("lists tools via tools/list", async () => {
    const response = await sendRequest("tools/list");
    const result = response.result as { tools: { name: string }[] };

    const toolNames = result.tools.map((t) => t.name);
    expect(toolNames).toContain("qa_run_tests");
    expect(toolNames).toContain("qa_run_module");
    expect(toolNames).toContain("qa_list_modules");
    expect(toolNames).toContain("qa_check_config");
    expect(toolNames).toContain("qa_get_report");
    expect(toolNames).toHaveLength(5);
  });

  it("validates config via qa_check_config", async () => {
    const response = await sendRequest("tools/call", {
      name: "qa_check_config",
      arguments: { projectPath: PROJECT_DIR },
    });

    const result = response.result as { content: { text: string }[] };
    const text = result.content[0].text;

    expect(text).toContain("Config is valid");
    expect(text).toContain("integration-test");
    expect(text).toContain("vm-environment");
  });

  it("returns error for missing config", async () => {
    const response = await sendRequest("tools/call", {
      name: "qa_check_config",
      arguments: { projectPath: "/tmp/nonexistent-integration-xyz" },
    });

    const result = response.result as {
      content: { text: string }[];
      isError?: boolean;
    };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Config file not found");
  });

  it("lists modules via qa_list_modules", async () => {
    const response = await sendRequest("tools/call", {
      name: "qa_list_modules",
      arguments: { projectPath: PROJECT_DIR },
    });

    const result = response.result as { content: { text: string }[] };
    const text = result.content[0].text;

    expect(text).toContain("web");
    expect(text).toContain("api");
    expect(text).toContain("vm");
    expect(text).toContain("[ENABLED]");
  });

  it("runs tests via qa_run_tests and gets passing results", async () => {
    const response = await sendRequest("tools/call", {
      name: "qa_run_tests",
      arguments: { projectPath: PROJECT_DIR },
    });

    const result = response.result as {
      content: { text: string }[];
      isError?: boolean;
    };
    const text = result.content[0].text;

    expect(result.isError).toBeUndefined();
    expect(text).toContain("QA Report: integration-test");
    expect(text).toContain("[PASS]");
    expect(text).toContain("Node.js");
  });

  it("runs single module via qa_run_module", async () => {
    const response = await sendRequest("tools/call", {
      name: "qa_run_module",
      arguments: { projectPath: PROJECT_DIR, module: "vm" },
    });

    const result = response.result as { content: { text: string }[] };
    const text = result.content[0].text;

    expect(text).toContain("QA Report");
    expect(text).toContain("[PASS]");
  });

  it("retrieves last report via qa_get_report", async () => {
    const response = await sendRequest("tools/call", {
      name: "qa_get_report",
      arguments: { projectPath: PROJECT_DIR, format: "json" },
    });

    const result = response.result as { content: { text: string }[] };
    const text = result.content[0].text;

    const report = JSON.parse(text);
    expect(report.projectName).toBe("integration-test");
    expect(report.results.length).toBeGreaterThan(0);
    expect(report.summary.passed).toBeGreaterThan(0);
  });

  it("filters tests by name via qa_run_tests", async () => {
    const response = await sendRequest("tools/call", {
      name: "qa_run_tests",
      arguments: { projectPath: PROJECT_DIR, filter: "Node" },
    });

    const result = response.result as { content: { text: string }[] };
    const text = result.content[0].text;

    expect(text).toContain("Node.js");
    // Config file test should be filtered out
    expect(text).not.toContain("vm:config:");
  });
});
