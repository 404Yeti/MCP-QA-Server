import type { TestReport } from "../types.js";

/**
 * Format a TestReport as pretty-printed JSON.
 * Suitable for machine consumption, CI pipelines, and file output.
 */
export function formatJsonReport(report: TestReport): string {
  return JSON.stringify(report, null, 2);
}
