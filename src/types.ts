// ── Project & Module Identifiers ──────────────────────────────────────────────

export type ProjectType =
  | "web-app"
  | "cli-tool"
  | "vm-environment"
  | "wordpress-site"
  | "api-service";

export type ModuleName =
  | "web"
  | "api"
  | "cli"
  | "vm"
  | "wordpress"
  | "integration"
  | "performance";

export type ReportFormat = "console" | "json" | "github";

// ── Test Results ──────────────────────────────────────────────────────────────

export type TestStatus = "passed" | "failed" | "skipped" | "error";

export interface TestError {
  message: string;
  file?: string;
  line?: number;
  column?: number;
  stack?: string;
}

export interface TestResult {
  name: string;
  module: ModuleName;
  status: TestStatus;
  duration: number; // milliseconds
  message?: string;
  error?: TestError;
}

export interface TestReportSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
}

export interface TestReport {
  projectName: string;
  timestamp: string;
  duration: number; // milliseconds
  summary: TestReportSummary;
  results: TestResult[];
}

// ── Project Configuration ─────────────────────────────────────────────────────

export interface ProjectConfig {
  configVersion: number;
  projectName: string;
  projectType: ProjectType;
  modules: ModuleName[];
  reportFormat: ReportFormat;
  baseUrl?: string;
  timeout: number; // milliseconds
  env?: Record<string, string>;
  moduleConfig: Record<string, unknown>;
}

// ── Web Module Config Types ───────────────────────────────────────────────────

export interface WebPageTest {
  name: string;
  path: string;
  expectedStatus: number;
  contentChecks?: string[];
  requiresAuth?: boolean;
  maxLoadTime?: number;
}

export interface WebFormField {
  selector: string;
  type: string;
  testValue: string;
}

export interface WebFormTest {
  name: string;
  page: string;
  fields: WebFormField[];
  submitSelector: string;
  expectedResult: {
    redirectTo?: string;
    containsText?: string;
    errorMessage?: string;
  };
}

export type WorkflowAction =
  | "navigate"
  | "click"
  | "fill"
  | "select"
  | "waitForUrl"
  | "waitForSelector"
  | "assertVisible"
  | "assertText"
  | "screenshot";

export interface WorkflowStep {
  action: WorkflowAction;
  selector?: string;
  url?: string;
  value?: string;
  timeout?: number;
}

export interface WebWorkflowTest {
  name: string;
  steps: WorkflowStep[];
}

export interface WebModuleConfig {
  pages?: WebPageTest[];
  forms?: WebFormTest[];
  workflows?: WebWorkflowTest[];
}

// ── API Module Config Types ───────────────────────────────────────────────────

export interface ApiAuthConfig {
  type: "bearer" | "api-key" | "basic";
  tokenEnvVar?: string;
  headerName?: string;
  username?: string;
  passwordEnvVar?: string;
}

export interface ApiEndpointTest {
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  queryParams?: Record<string, string>;
  expectedStatus: number;
  expectedBody?: {
    type?: "object" | "array" | "string" | "number";
    hasKeys?: string[];
    matches?: Record<string, unknown>;
    schema?: object;
  };
  skipAuth?: boolean;
  captureAs?: string;
}

export interface ApiModuleConfig {
  auth?: ApiAuthConfig;
  endpoints?: ApiEndpointTest[];
}

// ── CLI Module Config Types ───────────────────────────────────────────────────

export interface CliCommandTest {
  name: string;
  binaryPath?: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  stdin?: string;
  expectedExitCode: number;
  expectedOutput?: {
    exact?: string;
    contains?: string[];
    pattern?: string;
  };
  expectedStderr?: {
    empty?: boolean;
    contains?: string[];
    pattern?: string;
  };
  timeout?: number;
  createsFiles?: { path: string; contains?: string[] }[];
}

export interface CliModuleConfig {
  binaryPath?: string;
  commands?: CliCommandTest[];
}

// ── VM Module Config Types ────────────────────────────────────────────────────

export interface VmToolCheck {
  name: string;
  binary: string;
  versionFlag?: string;
  expectedVersion?: string; // semver range
}

export interface VmDependencyCheck {
  name: string;
  command: string;
  expectedVersion?: string; // semver range
}

export interface VmConfigFileCheck {
  path: string;
  exists: boolean;
  contains?: string[];
  permissions?: string;
}

export interface VmServiceCheck {
  name: string;
  command: string;
  expectedOutput: string;
}

export interface VmModuleConfig {
  tools?: VmToolCheck[];
  dependencies?: VmDependencyCheck[];
  configFiles?: VmConfigFileCheck[];
  services?: VmServiceCheck[];
}

// ── WordPress Module Config Types ─────────────────────────────────────────────

export interface WpPluginTest {
  slug: string;
  expectedState: "active" | "inactive" | "installed";
  testUrl?: string;
  testContent?: string[];
}

export interface WpThemeTest {
  slug: string;
  expectedState: "active" | "installed";
}

export interface WpPageTest {
  name: string;
  path: string;
  expectedStatus: number;
  contentChecks?: string[];
}

export interface WordPressModuleConfig {
  wpPath?: string;
  wpCliAvailable?: boolean;
  plugins?: WpPluginTest[];
  themes?: WpThemeTest[];
  pages?: WpPageTest[];
}

// ── Performance Module Config Types ───────────────────────────────────────────

export interface PerformanceTarget {
  url: string;
  maxResponseTime: number; // milliseconds
  concurrentRequests?: number;
}

export interface PerformanceModuleConfig {
  targets?: PerformanceTarget[];
}

// ── Integration Module Config Types ───────────────────────────────────────────

export interface IntegrationStep {
  module: ModuleName;
  test: string;
  captureAs?: string;
}

export interface IntegrationScenario {
  name: string;
  steps: IntegrationStep[];
}

export interface IntegrationModuleConfig {
  scenarios?: IntegrationScenario[];
}

// ── Test Execution Context ────────────────────────────────────────────────────

export interface TestContext {
  projectPath: string;
  config: ProjectConfig;
  store: Record<string, unknown>; // shared state between tests
  startTime: number;
}
