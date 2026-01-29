import type { TestReport, TestResult } from "../types.js";

// Status indicators (plain text, no emoji — works in all terminals)
const STATUS_ICONS: Record<string, string> = {
  passed: "[PASS]",
  failed: "[FAIL]",
  skipped: "[SKIP]",
  error: "[ERR!]",
};

/**
 * Format a TestReport as human-readable console output.
 * Includes file:line references for failures and errors.
 */
export function formatConsoleReport(report: TestReport): string {
  const lines: string[] = [];

  // Header
  lines.push("");
  lines.push(`  QA Report: ${report.projectName}`);
  lines.push(`  ${"─".repeat(50)}`);
  lines.push(`  Ran at: ${report.timestamp}`);
  lines.push(`  Duration: ${formatDuration(report.duration)}`);
  lines.push("");

  // Group results by module
  const byModule = groupByModule(report.results);

  for (const [moduleName, results] of byModule) {
    lines.push(`  ■ ${moduleName}`);

    for (const result of results) {
      const icon = STATUS_ICONS[result.status] ?? "[????]";
      const duration = result.duration > 0 ? ` (${formatDuration(result.duration)})` : "";
      lines.push(`    ${icon} ${result.name}${duration}`);

      // Show failure/error details
      if (result.status === "failed" || result.status === "error") {
        if (result.error) {
          const location = formatLocation(result.error.file, result.error.line, result.error.column);
          if (location) {
            lines.push(`           at ${location}`);
          }
          lines.push(`           ${result.error.message}`);
        } else if (result.message) {
          lines.push(`           ${result.message}`);
        }
      }

      // Show skip reason
      if (result.status === "skipped" && result.message) {
        lines.push(`           ${result.message}`);
      }
    }

    lines.push("");
  }

  // Summary
  lines.push(`  ${"─".repeat(50)}`);
  lines.push(`  Summary:`);
  lines.push(`    Total:   ${report.summary.total}`);
  lines.push(`    Passed:  ${report.summary.passed}`);
  lines.push(`    Failed:  ${report.summary.failed}`);
  lines.push(`    Errors:  ${report.summary.errors}`);
  lines.push(`    Skipped: ${report.summary.skipped}`);
  lines.push("");

  // Final status line
  const allPassed = report.summary.failed === 0 && report.summary.errors === 0;
  if (allPassed) {
    lines.push(`  Result: ALL PASSED`);
  } else {
    lines.push(`  Result: FAILURES DETECTED`);
  }
  lines.push("");

  return lines.join("\n");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByModule(results: TestResult[]): Map<string, TestResult[]> {
  const map = new Map<string, TestResult[]>();
  for (const result of results) {
    const existing = map.get(result.module) ?? [];
    existing.push(result);
    map.set(result.module, existing);
  }
  return map;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

function formatLocation(
  file?: string,
  line?: number,
  column?: number
): string | null {
  if (!file) return null;
  let loc = file;
  if (line !== undefined) {
    loc += `:${line}`;
    if (column !== undefined) {
      loc += `:${column}`;
    }
  }
  return loc;
}
