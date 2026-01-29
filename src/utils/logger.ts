export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel];
}

function formatMessage(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): string {
  const timestamp = new Date().toISOString();
  const tag = level.toUpperCase().padEnd(5);
  let line = `[${timestamp}] ${tag} ${message}`;
  if (context && Object.keys(context).length > 0) {
    line += ` ${JSON.stringify(context)}`;
  }
  return line;
}

/**
 * Structured logger that writes to stderr to avoid interfering with
 * MCP protocol messages on stdout.
 */
export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    if (shouldLog("debug")) {
      process.stderr.write(formatMessage("debug", message, context) + "\n");
    }
  },

  info(message: string, context?: Record<string, unknown>): void {
    if (shouldLog("info")) {
      process.stderr.write(formatMessage("info", message, context) + "\n");
    }
  },

  warn(message: string, context?: Record<string, unknown>): void {
    if (shouldLog("warn")) {
      process.stderr.write(formatMessage("warn", message, context) + "\n");
    }
  },

  error(message: string, context?: Record<string, unknown>): void {
    if (shouldLog("error")) {
      process.stderr.write(formatMessage("error", message, context) + "\n");
    }
  },
};
