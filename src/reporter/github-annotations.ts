import type { TestReport, TestResult } from "../types.js";

/**
 * Format a TestReport as GitHub Actions workflow command annotations.
 *
 * Output format per result:
 *   ::error file={file},line={line}::{message}
 *   ::warning file={file},line={line}::{message}
 *   ::notice::{message}
 *
 * See: https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions
 */
export function formatGitHubReport(report: TestReport): string {
  const lines: string[] = [];

  for (const result of report.results) {
    lines.push(formatAnnotation(result));
  }

  // Summary as a notice
  const { total, passed, failed, errors, skipped } = report.summary;
  lines.push(
    `::notice::QA Report for ${report.projectName}: ${total} tests — ${passed} passed, ${failed} failed, ${errors} errors, ${skipped} skipped (${report.duration}ms)`
  );

  return lines.join("\n");
}

function formatAnnotation(result: TestResult): string {
  switch (result.status) {
    case "failed":
    case "error": {
      const level = result.status === "failed" ? "error" : "error";
      const attrs = buildAttrs(result);
      const msg = result.error?.message ?? result.message ?? result.name;
      return `::${level} ${attrs}::${escape(msg)}`;
    }

    case "skipped": {
      const msg = result.message ?? `Skipped: ${result.name}`;
      return `::warning::${escape(msg)}`;
    }

    case "passed": {
      return `::notice::${escape(result.name)} passed (${result.duration}ms)`;
    }

    default:
      return `::notice::${escape(result.name)}: ${result.status}`;
  }
}

function buildAttrs(result: TestResult): string {
  const parts: string[] = [];
  if (result.error?.file) {
    parts.push(`file=${result.error.file}`);
  }
  if (result.error?.line) {
    parts.push(`line=${result.error.line}`);
  }
  if (result.error?.column) {
    parts.push(`col=${result.error.column}`);
  }
  // Always include test name as title
  parts.push(`title=${result.module}/${result.name}`);
  return parts.join(",");
}

/**
 * Escape special characters for GitHub annotation messages.
 * Newlines and other control chars break the annotation format.
 */
function escape(text: string): string {
  return text
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A");
}
