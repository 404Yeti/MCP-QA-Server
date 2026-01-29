import type { ModuleName } from "../types.js";
import type { BaseModule } from "./base-module.js";

/**
 * Factory function type — each module provides one of these.
 * Lazy-loaded so we don't import heavy deps (e.g., Playwright) unless needed.
 */
type ModuleFactory = () => Promise<BaseModule>;

/**
 * Internal registry mapping module names to their lazy factory functions.
 * Entries are added as modules are implemented.
 */
const registry = new Map<ModuleName, ModuleFactory>();

/**
 * Register a module factory. Called once per module at import time.
 */
export function registerModule(name: ModuleName, factory: ModuleFactory): void {
  registry.set(name, factory);
}

/**
 * Get a module instance by name.
 * Returns null if the module is not registered (not yet implemented).
 */
export async function getModule(name: ModuleName): Promise<BaseModule | null> {
  const factory = registry.get(name);
  if (!factory) return null;
  return factory();
}

/**
 * Get instances of all modules requested by the project config.
 * Skips modules that aren't registered yet and returns a warning for each.
 */
export async function getModules(
  names: ModuleName[]
): Promise<{ modules: BaseModule[]; warnings: string[] }> {
  const modules: BaseModule[] = [];
  const warnings: string[] = [];

  for (const name of names) {
    const mod = await getModule(name);
    if (mod) {
      modules.push(mod);
    } else {
      warnings.push(`Module "${name}" is not available (not yet implemented or failed to load)`);
    }
  }

  return { modules, warnings };
}

/**
 * List all registered module names.
 */
export function getRegisteredModuleNames(): ModuleName[] {
  return Array.from(registry.keys());
}

/**
 * All known module names with descriptions, regardless of registration status.
 * Used by the CLI list-modules command.
 */
export const ALL_MODULES: { name: ModuleName; description: string }[] = [
  { name: "web", description: "Web/UI testing (page loads, forms, workflows)" },
  { name: "api", description: "API endpoint testing (REST, response validation)" },
  { name: "cli", description: "CLI tool testing (command execution, output validation)" },
  { name: "vm", description: "VM environment validation (tools, deps, configs)" },
  { name: "wordpress", description: "WordPress testing (plugins, themes, pages)" },
  { name: "integration", description: "Integration testing (cross-module orchestration)" },
  { name: "performance", description: "Performance testing (load, response times)" },
];

// ── Module Registrations ──────────────────────────────────────────────────────
// Each module registers itself when implemented. Lazy imports keep startup fast
// and avoid pulling in heavy deps (Playwright, etc.) unless the module is used.

registerModule("vm", async () => {
  const { VmModule } = await import("./vm/index.js");
  return new VmModule();
});

registerModule("cli", async () => {
  const { CliModule } = await import("./cli/index.js");
  return new CliModule();
});

registerModule("api", async () => {
  const { ApiModule } = await import("./api/index.js");
  return new ApiModule();
});

registerModule("web", async () => {
  const { WebModule } = await import("./web/index.js");
  return new WebModule();
});

registerModule("wordpress", async () => {
  const { WordPressModule } = await import("./wordpress/index.js");
  return new WordPressModule();
});

registerModule("performance", async () => {
  const { PerformanceModule } = await import("./performance/index.js");
  return new PerformanceModule();
});

registerModule("integration", async () => {
  const { IntegrationModule } = await import("./integration/index.js");
  return new IntegrationModule();
});
