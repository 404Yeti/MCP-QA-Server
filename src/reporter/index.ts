import type { ReportFormat, TestReport } from "../types.js";
import { formatConsoleReport } from "./console.js";
import { formatJsonReport } from "./json.js";
import { formatGitHubReport } from "./github-annotations.js";

/**
 * Format a TestReport using the specified format.
 */
export function formatReport(
  report: TestReport,
  format: ReportFormat
): string {
  switch (format) {
    case "console":
      return formatConsoleReport(report);
    case "json":
      return formatJsonReport(report);
    case "github":
      return formatGitHubReport(report);
    default: {
      const _exhaustive: never = format;
      throw new Error(`Unknown report format: ${_exhaustive}`);
    }
  }
}

// Re-export individual formatters for direct use
export { formatConsoleReport } from "./console.js";
export { formatJsonReport } from "./json.js";
export { formatGitHubReport } from "./github-annotations.js";
