import { describe, it, expect } from "vitest";
import { formatConsoleReport } from "../../../src/reporter/console.js";
import { formatJsonReport } from "../../../src/reporter/json.js";
import { formatGitHubReport } from "../../../src/reporter/github-annotations.js";
import { formatReport } from "../../../src/reporter/index.js";
import type { TestReport } from "../../../src/types.js";

const sampleReport: TestReport = {
  projectName: "test-project",
  timestamp: "2026-01-29T00:00:00.000Z",
  duration: 1500,
  summary: {
    total: 4,
    passed: 2,
    failed: 1,
    skipped: 0,
    errors: 1,
  },
  results: [
    {
      name: "page-load",
      module: "web",
      status: "passed",
      duration: 200,
      message: "/ → 200 (200ms)",
    },
    {
      name: "api-health",
      module: "api",
      status: "passed",
      duration: 50,
      message: "GET /health → 200",
    },
    {
      name: "login-form",
      module: "web",
      status: "failed",
      duration: 500,
      message: "Form submission failed",
      error: {
        message: "Expected redirect to /dashboard",
        file: ".mcp-qa-config.json",
        line: 25,
      },
    },
    {
      name: "tool-check",
      module: "vm",
      status: "error",
      duration: 100,
      message: "Binary not found",
      error: {
        message: "docker not found on PATH",
        stack: "Error: docker not found\n    at check.ts:15",
      },
    },
  ],
};

describe("Console Reporter", () => {
  it("includes project name", () => {
    const output = formatConsoleReport(sampleReport);
    expect(output).toContain("test-project");
  });

  it("includes pass/fail indicators", () => {
    const output = formatConsoleReport(sampleReport);
    expect(output).toContain("[PASS]");
    expect(output).toContain("[FAIL]");
    expect(output).toContain("[ERR!]");
  });

  it("includes file:line for errors", () => {
    const output = formatConsoleReport(sampleReport);
    expect(output).toContain(".mcp-qa-config.json:25");
  });

  it("includes summary counts", () => {
    const output = formatConsoleReport(sampleReport);
    expect(output).toContain("Total:   4");
    expect(output).toContain("Passed:  2");
    expect(output).toContain("Failed:  1");
    expect(output).toContain("Errors:  1");
  });

  it("shows FAILURES DETECTED for failing reports", () => {
    const output = formatConsoleReport(sampleReport);
    expect(output).toContain("FAILURES DETECTED");
  });

  it("shows ALL PASSED for clean reports", () => {
    const clean: TestReport = {
      ...sampleReport,
      summary: { total: 2, passed: 2, failed: 0, skipped: 0, errors: 0 },
      results: sampleReport.results.filter((r) => r.status === "passed"),
    };
    const output = formatConsoleReport(clean);
    expect(output).toContain("ALL PASSED");
  });

  it("groups results by module", () => {
    const output = formatConsoleReport(sampleReport);
    expect(output).toContain("■ web");
    expect(output).toContain("■ api");
    expect(output).toContain("■ vm");
  });
});

describe("JSON Reporter", () => {
  it("produces valid JSON", () => {
    const output = formatJsonReport(sampleReport);
    const parsed = JSON.parse(output);
    expect(parsed.projectName).toBe("test-project");
    expect(parsed.results).toHaveLength(4);
  });

  it("preserves all fields", () => {
    const output = formatJsonReport(sampleReport);
    const parsed = JSON.parse(output);
    expect(parsed.summary.total).toBe(4);
    expect(parsed.results[2].error.file).toBe(".mcp-qa-config.json");
    expect(parsed.results[2].error.line).toBe(25);
  });
});

describe("GitHub Reporter", () => {
  it("produces ::error annotations for failures", () => {
    const output = formatGitHubReport(sampleReport);
    expect(output).toContain("::error");
    expect(output).toContain("file=.mcp-qa-config.json");
    expect(output).toContain("line=25");
  });

  it("produces ::notice for passes", () => {
    const output = formatGitHubReport(sampleReport);
    expect(output).toContain("::notice::page-load passed");
  });

  it("includes summary notice", () => {
    const output = formatGitHubReport(sampleReport);
    expect(output).toContain("QA Report for test-project");
    expect(output).toContain("4 tests");
  });
});

describe("formatReport dispatcher", () => {
  it("routes to console format", () => {
    const output = formatReport(sampleReport, "console");
    expect(output).toContain("[PASS]");
  });

  it("routes to json format", () => {
    const output = formatReport(sampleReport, "json");
    const parsed = JSON.parse(output);
    expect(parsed.projectName).toBe("test-project");
  });

  it("routes to github format", () => {
    const output = formatReport(sampleReport, "github");
    expect(output).toContain("::error");
  });
});
