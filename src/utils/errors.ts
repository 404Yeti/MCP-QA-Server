/**
 * Base error class for all MCP QA errors.
 * Includes optional file location info for precise error reporting.
 */
export class QaError extends Error {
  public readonly file?: string;
  public readonly line?: number;
  public readonly column?: number;

  constructor(message: string, file?: string, line?: number, column?: number) {
    super(message);
    this.name = "QaError";
    this.file = file;
    this.line = line;
    this.column = column;
  }

  /**
   * Format as a GitHub Actions annotation string.
   * Example: ::error file=.mcp-qa-config.json,line=15::Validation failed
   */
  toGitHubAnnotation(): string {
    const parts = ["::error"];
    const attrs: string[] = [];
    if (this.file) attrs.push(`file=${this.file}`);
    if (this.line) attrs.push(`line=${this.line}`);
    if (this.column) attrs.push(`col=${this.column}`);
    if (attrs.length > 0) parts[0] += ` ${attrs.join(",")}`;
    return `${parts[0]}::${this.message}`;
  }

  /**
   * Format with file:line prefix for console output.
   * Example: .mcp-qa-config.json:15 — Validation failed
   */
  toLocationString(): string {
    const parts: string[] = [];
    if (this.file) {
      let loc = this.file;
      if (this.line) {
        loc += `:${this.line}`;
        if (this.column) loc += `:${this.column}`;
      }
      parts.push(loc);
      parts.push("—");
    }
    parts.push(this.message);
    return parts.join(" ");
  }
}

/**
 * Error in project configuration (.mcp-qa-config.json).
 */
export class ConfigError extends QaError {
  constructor(message: string, file?: string, line?: number, column?: number) {
    super(message, file, line, column);
    this.name = "ConfigError";
  }
}

/**
 * Error during test module execution.
 */
export class ModuleError extends QaError {
  public readonly moduleName: string;

  constructor(
    moduleName: string,
    message: string,
    file?: string,
    line?: number,
    column?: number
  ) {
    super(message, file, line, column);
    this.name = "ModuleError";
    this.moduleName = moduleName;
  }
}

/**
 * Error from an individual test case.
 */
export class TestError extends QaError {
  public readonly testName: string;
  public readonly moduleName: string;

  constructor(
    testName: string,
    moduleName: string,
    message: string,
    file?: string,
    line?: number,
    column?: number
  ) {
    super(message, file, line, column);
    this.name = "TestError";
    this.testName = testName;
    this.moduleName = moduleName;
  }
}
