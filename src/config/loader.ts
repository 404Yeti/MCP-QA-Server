import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { projectConfigSchema, moduleConfigSchemas } from "./schema.js";
import type { ProjectConfig, ModuleName } from "../types.js";
import { ConfigError } from "../utils/errors.js";

const CONFIG_FILENAME = ".mcp-qa-config.json";

/**
 * Locate and load the .mcp-qa-config.json file from a project directory.
 * Always reads from disk (never cached) so edits are picked up immediately.
 */
export async function loadConfig(projectPath: string): Promise<ProjectConfig> {
  const absolutePath = resolve(projectPath);
  const configPath = join(absolutePath, CONFIG_FILENAME);

  // Read raw file
  let raw: string;
  try {
    raw = await readFile(configPath, "utf-8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new ConfigError(
        `Config file not found: ${configPath}\nRun "mcp-qa init" in your project directory to create one.`,
        configPath
      );
    }
    throw new ConfigError(
      `Failed to read config file: ${configPath}\n${(err as Error).message}`,
      configPath
    );
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const jsonErr = err as SyntaxError;
    // Try to extract line number from SyntaxError message
    const lineMatch = jsonErr.message.match(/position (\d+)/);
    const position = lineMatch ? parseInt(lineMatch[1], 10) : undefined;
    const line = position !== undefined ? getLineFromPosition(raw, position) : undefined;

    throw new ConfigError(
      `Invalid JSON in ${configPath}: ${jsonErr.message}`,
      configPath,
      line
    );
  }

  // Validate root schema
  const rootResult = projectConfigSchema.safeParse(parsed);
  if (!rootResult.success) {
    const issues = rootResult.error.issues.map((issue) => {
      const path = issue.path.join(".");
      const line = findJsonKeyLine(raw, issue.path);
      return { message: `${path}: ${issue.message}`, line };
    });

    const message = [
      `Config validation failed in ${configPath}:`,
      ...issues.map((i) => `  - ${i.message}${i.line ? ` (line ${i.line})` : ""}`),
    ].join("\n");

    throw new ConfigError(message, configPath, issues[0]?.line);
  }

  const config = rootResult.data as ProjectConfig;

  // Validate per-module config sections
  for (const moduleName of config.modules) {
    const moduleSchema = moduleConfigSchemas[moduleName as keyof typeof moduleConfigSchemas];
    const moduleData = config.moduleConfig[moduleName];

    if (moduleData === undefined) {
      // Module listed but no config — that's fine, it'll use defaults
      continue;
    }

    const moduleResult = moduleSchema.safeParse(moduleData);
    if (!moduleResult.success) {
      const issues = moduleResult.error.issues.map((issue) => {
        const path = ["moduleConfig", moduleName, ...issue.path].join(".");
        return `  - ${path}: ${issue.message}`;
      });

      throw new ConfigError(
        [
          `Module config validation failed for "${moduleName}" in ${configPath}:`,
          ...issues,
        ].join("\n"),
        configPath
      );
    }
  }

  return config;
}

/**
 * Validate a config object without loading from disk.
 * Useful for the CLI validate command after reading the file separately.
 */
export function validateConfig(data: unknown): {
  valid: boolean;
  config?: ProjectConfig;
  errors?: string[];
} {
  const rootResult = projectConfigSchema.safeParse(data);
  if (!rootResult.success) {
    return {
      valid: false,
      errors: rootResult.error.issues.map(
        (i) => `${i.path.join(".")}: ${i.message}`
      ),
    };
  }

  const config = rootResult.data as ProjectConfig;
  const errors: string[] = [];

  for (const moduleName of config.modules) {
    const moduleSchema = moduleConfigSchemas[moduleName as keyof typeof moduleConfigSchemas];
    const moduleData = config.moduleConfig[moduleName];

    if (moduleData === undefined) continue;

    const moduleResult = moduleSchema.safeParse(moduleData);
    if (!moduleResult.success) {
      for (const issue of moduleResult.error.issues) {
        const path = ["moduleConfig", moduleName, ...issue.path].join(".");
        errors.push(`${path}: ${issue.message}`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, config };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Given a character position in a string, return the 1-based line number.
 */
function getLineFromPosition(text: string, position: number): number {
  let line = 1;
  for (let i = 0; i < position && i < text.length; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}

/**
 * Attempt to find the line number for a Zod error path in raw JSON text.
 * This is best-effort — JSON keys are searched as quoted strings.
 */
function findJsonKeyLine(
  raw: string,
  path: (string | number)[]
): number | undefined {
  if (path.length === 0) return undefined;

  const lastKey = path[path.length - 1];
  if (typeof lastKey === "number") {
    // Array index — harder to locate, fall back
    return undefined;
  }

  const pattern = `"${lastKey}"`;
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(pattern)) {
      return i + 1; // 1-based
    }
  }
  return undefined;
}
