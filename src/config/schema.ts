import { z } from "zod";

// ── Enums ─────────────────────────────────────────────────────────────────────

const projectTypeSchema = z.enum([
  "web-app",
  "cli-tool",
  "vm-environment",
  "wordpress-site",
  "api-service",
]);

const moduleNameSchema = z.enum([
  "web",
  "api",
  "cli",
  "vm",
  "wordpress",
  "integration",
  "performance",
]);

const reportFormatSchema = z.enum(["console", "json", "github"]);

// ── Web Module ────────────────────────────────────────────────────────────────

const webPageTestSchema = z.object({
  name: z.string(),
  path: z.string(),
  expectedStatus: z.number().int().min(100).max(599),
  contentChecks: z.array(z.string()).optional(),
  requiresAuth: z.boolean().optional(),
  maxLoadTime: z.number().positive().optional(),
});

const webFormFieldSchema = z.object({
  selector: z.string(),
  type: z.string(),
  testValue: z.string(),
});

const webFormTestSchema = z.object({
  name: z.string(),
  page: z.string(),
  fields: z.array(webFormFieldSchema),
  submitSelector: z.string(),
  expectedResult: z.object({
    redirectTo: z.string().optional(),
    containsText: z.string().optional(),
    errorMessage: z.string().optional(),
  }),
});

const workflowStepSchema = z.object({
  action: z.enum([
    "navigate",
    "click",
    "fill",
    "select",
    "waitForUrl",
    "waitForSelector",
    "assertVisible",
    "assertText",
    "screenshot",
  ]),
  selector: z.string().optional(),
  url: z.string().optional(),
  value: z.string().optional(),
  timeout: z.number().positive().optional(),
});

const webWorkflowTestSchema = z.object({
  name: z.string(),
  steps: z.array(workflowStepSchema),
});

const webModuleConfigSchema = z.object({
  pages: z.array(webPageTestSchema).optional(),
  forms: z.array(webFormTestSchema).optional(),
  workflows: z.array(webWorkflowTestSchema).optional(),
});

// ── API Module ────────────────────────────────────────────────────────────────

const apiAuthConfigSchema = z.object({
  type: z.enum(["bearer", "api-key", "basic"]),
  tokenEnvVar: z.string().optional(),
  headerName: z.string().optional(),
  username: z.string().optional(),
  passwordEnvVar: z.string().optional(),
});

const apiEndpointTestSchema = z.object({
  name: z.string(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string(),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  queryParams: z.record(z.string()).optional(),
  expectedStatus: z.number().int().min(100).max(599),
  expectedBody: z
    .object({
      type: z.enum(["object", "array", "string", "number"]).optional(),
      hasKeys: z.array(z.string()).optional(),
      matches: z.record(z.unknown()).optional(),
      schema: z.object({}).passthrough().optional(),
    })
    .optional(),
  skipAuth: z.boolean().optional(),
  captureAs: z.string().optional(),
});

const apiModuleConfigSchema = z.object({
  auth: apiAuthConfigSchema.optional(),
  endpoints: z.array(apiEndpointTestSchema).optional(),
});

// ── CLI Module ────────────────────────────────────────────────────────────────

const cliCommandTestSchema = z.object({
  name: z.string(),
  binaryPath: z.string().optional(),
  args: z.array(z.string()),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
  stdin: z.string().optional(),
  expectedExitCode: z.number().int(),
  expectedOutput: z
    .object({
      exact: z.string().optional(),
      contains: z.array(z.string()).optional(),
      pattern: z.string().optional(),
    })
    .optional(),
  expectedStderr: z
    .object({
      empty: z.boolean().optional(),
      contains: z.array(z.string()).optional(),
      pattern: z.string().optional(),
    })
    .optional(),
  timeout: z.number().positive().optional(),
  createsFiles: z
    .array(
      z.object({
        path: z.string(),
        contains: z.array(z.string()).optional(),
      })
    )
    .optional(),
});

const cliModuleConfigSchema = z.object({
  binaryPath: z.string().optional(),
  commands: z.array(cliCommandTestSchema).optional(),
}).refine(
  (cfg) => {
    // Valid if module-level binaryPath is set, OR every command has its own binaryPath
    if (cfg.binaryPath) return true;
    if (!cfg.commands || cfg.commands.length === 0) return true;
    return cfg.commands.every((cmd) => cmd.binaryPath);
  },
  {
    message:
      "CLI module requires either a module-level 'binaryPath' or a 'binaryPath' on every command",
  }
);

// ── VM Module ─────────────────────────────────────────────────────────────────

const vmToolCheckSchema = z.object({
  name: z.string(),
  binary: z.string(),
  versionFlag: z.string().optional(),
  expectedVersion: z.string().optional(),
});

const vmDependencyCheckSchema = z.object({
  name: z.string(),
  command: z.string(),
  expectedVersion: z.string().optional(),
});

const vmConfigFileCheckSchema = z.object({
  path: z.string(),
  exists: z.boolean(),
  contains: z.array(z.string()).optional(),
  permissions: z.string().optional(),
});

const vmServiceCheckSchema = z.object({
  name: z.string(),
  command: z.string(),
  expectedOutput: z.string(),
});

const vmModuleConfigSchema = z.object({
  tools: z.array(vmToolCheckSchema).optional(),
  dependencies: z.array(vmDependencyCheckSchema).optional(),
  configFiles: z.array(vmConfigFileCheckSchema).optional(),
  services: z.array(vmServiceCheckSchema).optional(),
});

// ── WordPress Module ──────────────────────────────────────────────────────────

const wpPluginTestSchema = z.object({
  slug: z.string(),
  expectedState: z.enum(["active", "inactive", "installed"]),
  testUrl: z.string().optional(),
  testContent: z.array(z.string()).optional(),
});

const wpThemeTestSchema = z.object({
  slug: z.string(),
  expectedState: z.enum(["active", "installed"]),
});

const wpPageTestSchema = z.object({
  name: z.string(),
  path: z.string(),
  expectedStatus: z.number().int().min(100).max(599),
  contentChecks: z.array(z.string()).optional(),
});

const wordpressModuleConfigSchema = z.object({
  wpPath: z.string().optional(),
  wpCliAvailable: z.boolean().optional(),
  plugins: z.array(wpPluginTestSchema).optional(),
  themes: z.array(wpThemeTestSchema).optional(),
  pages: z.array(wpPageTestSchema).optional(),
});

// ── Performance Module ────────────────────────────────────────────────────────

const performanceTargetSchema = z.object({
  url: z.string(),
  maxResponseTime: z.number().positive(),
  concurrentRequests: z.number().int().positive().optional(),
});

const performanceModuleConfigSchema = z.object({
  targets: z.array(performanceTargetSchema).optional(),
});

// ── Integration Module ────────────────────────────────────────────────────────

const integrationStepSchema = z.object({
  module: moduleNameSchema,
  test: z.string(),
  captureAs: z.string().optional(),
});

const integrationScenarioSchema = z.object({
  name: z.string(),
  steps: z.array(integrationStepSchema),
});

const integrationModuleConfigSchema = z.object({
  scenarios: z.array(integrationScenarioSchema).optional(),
});

// ── Module Config Map ─────────────────────────────────────────────────────────

export const moduleConfigSchemas = {
  web: webModuleConfigSchema,
  api: apiModuleConfigSchema,
  cli: cliModuleConfigSchema,
  vm: vmModuleConfigSchema,
  wordpress: wordpressModuleConfigSchema,
  performance: performanceModuleConfigSchema,
  integration: integrationModuleConfigSchema,
} as const;

// ── Root Config Schema ────────────────────────────────────────────────────────

export const projectConfigSchema = z.object({
  configVersion: z.number().int().positive().default(1),
  projectName: z.string().min(1),
  projectType: projectTypeSchema,
  modules: z.array(moduleNameSchema).min(1),
  reportFormat: reportFormatSchema.default("console"),
  baseUrl: z.string().url().optional(),
  timeout: z.number().positive().default(30000),
  env: z.record(z.string()).optional(),
  moduleConfig: z.record(z.unknown()).default({}),
});

export type ProjectConfigInput = z.input<typeof projectConfigSchema>;
export type ProjectConfigOutput = z.output<typeof projectConfigSchema>;
