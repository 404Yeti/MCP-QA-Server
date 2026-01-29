# MCP QA Server — Implementation Plan

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Architecture Overview](#2-architecture-overview)
3. [Required Files List](#3-required-files-list)
4. [Configuration Schema](#4-configuration-schema)
5. [Module Breakdown](#5-module-breakdown)
6. [CLI Tool Specification](#6-cli-tool-specification)
7. [Implementation Steps](#7-implementation-steps)
8. [Recommended Next Steps](#8-recommended-next-steps)
9. [Potential Challenges](#9-potential-challenges)

---

## 1. Project Structure

```
mcp-qa-server/
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .gitignore
├── README.md
│
├── bin/
│   └── mcp-qa.ts                    # CLI entry point (mcp-qa init, etc.)
│
├── src/
│   ├── index.ts                     # MCP server entry point
│   ├── server.ts                    # MCP server setup & tool registration
│   ├── types.ts                     # Shared TypeScript types/interfaces
│   │
│   ├── config/
│   │   ├── loader.ts                # Finds & loads .mcp-qa-config.json from target project
│   │   ├── schema.ts                # Zod schema for config validation
│   │   └── defaults.ts              # Default config values per project type
│   │
│   ├── modules/
│   │   ├── index.ts                 # Module registry — discovers & loads modules
│   │   ├── base-module.ts           # Abstract base class all modules extend
│   │   ├── web/
│   │   │   ├── index.ts             # Web/UI testing module entry
│   │   │   ├── page-load.ts         # Page load & navigation tests
│   │   │   ├── forms.ts             # Form interaction & validation tests
│   │   │   └── workflows.ts         # Multi-step user workflow tests
│   │   ├── api/
│   │   │   ├── index.ts             # API testing module entry
│   │   │   ├── rest.ts              # REST endpoint testing
│   │   │   └── validation.ts        # Response schema & status code validation
│   │   ├── cli/
│   │   │   ├── index.ts             # CLI testing module entry
│   │   │   ├── executor.ts          # Command execution & capture
│   │   │   └── output-validator.ts  # stdout/stderr/exit-code validation
│   │   ├── vm/
│   │   │   ├── index.ts             # VM environment validation module entry
│   │   │   ├── tools.ts             # Tool/binary installation checks
│   │   │   ├── dependencies.ts      # Dependency version validation
│   │   │   └── config-files.ts      # Config file existence & content checks
│   │   ├── wordpress/
│   │   │   ├── index.ts             # WordPress testing module entry
│   │   │   ├── plugins.ts           # Plugin activation & functionality tests
│   │   │   ├── themes.ts            # Theme rendering & functionality tests
│   │   │   └── pages.ts             # Page content & functionality tests
│   │   ├── integration/
│   │   │   ├── index.ts             # Integration testing module entry
│   │   │   └── runner.ts            # Cross-module test orchestration
│   │   └── performance/
│   │       ├── index.ts             # Performance testing module entry
│   │       ├── load.ts              # Basic load testing (concurrent requests)
│   │       └── timing.ts            # Response time & threshold validation
│   │
│   ├── runner/
│   │   ├── index.ts                 # Test runner — orchestrates module execution
│   │   ├── context.ts               # Test execution context (shared state per run)
│   │   └── lifecycle.ts             # Before/after hooks, setup/teardown
│   │
│   ├── reporter/
│   │   ├── index.ts                 # Reporter dispatcher
│   │   ├── console.ts              # Terminal output with file:line references
│   │   ├── json.ts                  # JSON report output
│   │   └── github-annotations.ts   # GitHub Actions annotation format
│   │
│   └── utils/
│       ├── logger.ts                # Structured logging
│       ├── errors.ts                # Custom error classes with file:line info
│       ├── process.ts               # Child process helpers (for CLI/VM modules)
│       └── http.ts                  # HTTP client wrapper (for API/web modules)
│
├── templates/
│   ├── web-app.json                 # Template config for web app projects
│   ├── cli-tool.json                # Template config for CLI tool projects
│   ├── vm-environment.json          # Template config for VM builds
│   ├── wordpress-site.json          # Template config for WordPress sites
│   └── api-service.json             # Template config for API services
│
└── tests/
    ├── unit/
    │   ├── config/
    │   │   └── loader.test.ts
    │   ├── modules/
    │   │   ├── api.test.ts
    │   │   ├── cli.test.ts
    │   │   └── vm.test.ts
    │   └── reporter/
    │       └── console.test.ts
    └── integration/
        └── server.test.ts
```

---

## 2. Architecture Overview

### Core Principle: Project-Agnostic Server, Project-Specific Config

The MCP server itself contains **zero project-specific logic**. All project-specific details live in a `.mcp-qa-config.json` file inside each target project's repository. The server reads this config at runtime to determine what modules to load and how to execute tests.

### Data Flow

```
┌─────────────────────────────────────────────────────┐
│  Claude Desktop / MCP Client                        │
│  (sends tool calls via MCP protocol)                │
└──────────────────┬──────────────────────────────────┘
                   │ stdio (JSON-RPC)
                   ▼
┌─────────────────────────────────────────────────────┐
│  MCP QA Server  (src/server.ts)                     │
│                                                     │
│  Registered Tools:                                  │
│  ┌───────────────────────────────────────────────┐  │
│  │ qa_run_tests     — run all or filtered tests  │  │
│  │ qa_run_module    — run a specific module       │  │
│  │ qa_list_modules  — list available modules      │  │
│  │ qa_check_config  — validate project config     │  │
│  │ qa_get_report    — retrieve last test report   │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌─────────────┐    ┌──────────────────────────┐    │
│  │ Config      │───▶│ Module Registry           │   │
│  │ Loader      │    │ (loads only modules the   │   │
│  │             │    │  config requests)          │   │
│  └─────────────┘    └──────────┬───────────────┘    │
│                                │                    │
│                     ┌──────────▼───────────────┐    │
│                     │ Test Runner               │   │
│                     │ (executes modules,        │   │
│                     │  collects results)        │   │
│                     └──────────┬───────────────┘    │
│                                │                    │
│                     ┌──────────▼───────────────┐    │
│                     │ Reporter                  │   │
│                     │ (formats results with     │   │
│                     │  file:line references)    │   │
│                     └──────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### How It Stays Project-Agnostic

| Concern | Where it lives | Why |
|---------|---------------|-----|
| Testing logic (how to test a form, how to hit an API) | `src/modules/*` in the MCP server repo | Reusable across all projects |
| What to test (which URLs, which commands, which tools) | `.mcp-qa-config.json` in each project repo | Project-specific |
| How to report results | `src/reporter/*` in the MCP server repo | Reusable, format-selectable via config |
| Module selection | `modules` array in `.mcp-qa-config.json` | Each project opts in to only what it needs |

### MCP Tool Design

The server exposes these MCP tools to Claude:

| Tool Name | Input | Output |
|-----------|-------|--------|
| `qa_run_tests` | `{ projectPath: string, filter?: string, modules?: string[] }` | Full test report with pass/fail/error details |
| `qa_run_module` | `{ projectPath: string, module: string, testFilter?: string }` | Single module test report |
| `qa_list_modules` | `{ projectPath: string }` | List of available modules for the project |
| `qa_check_config` | `{ projectPath: string }` | Config validation result with any errors |
| `qa_get_report` | `{ projectPath: string, format?: "console" \| "json" \| "github" }` | Last test run results in requested format |

The `projectPath` parameter is how the server knows which project's config to load. Claude passes in the path to the project it's currently working on.

---

## 3. Required Files List

### Core Infrastructure

| File | Purpose | Key Components |
|------|---------|----------------|
| `package.json` | Project manifest, dependencies, bin entry | `bin: { "mcp-qa": "./dist/bin/mcp-qa.js" }`, deps: `@modelcontextprotocol/sdk`, `zod`, `playwright`, `inquirer` |
| `tsconfig.json` | TypeScript configuration | Strict mode, ES2022 target, Node module resolution |
| `.gitignore` | Git ignore rules | `node_modules/`, `dist/`, `.env` |
| `src/index.ts` | Server entry point | Starts MCP server on stdio transport |
| `src/server.ts` | MCP server definition | Registers all tools, handles tool dispatch |
| `src/types.ts` | Shared type definitions | `TestResult`, `TestReport`, `ModuleConfig`, `ProjectConfig` interfaces |

### Configuration System

| File | Purpose | Key Components |
|------|---------|----------------|
| `src/config/loader.ts` | Loads `.mcp-qa-config.json` from a project path | `loadConfig(projectPath)` — reads, validates, returns typed config |
| `src/config/schema.ts` | Zod validation schema | Full schema for `.mcp-qa-config.json` with per-module sub-schemas |
| `src/config/defaults.ts` | Default values by project type | `getDefaults(projectType)` — returns sensible defaults |

### Testing Modules (7 modules)

| File | Purpose | Key Components |
|------|---------|----------------|
| `src/modules/index.ts` | Module registry | `getModule(name)`, `getAvailableModules(config)` |
| `src/modules/base-module.ts` | Abstract base class | `abstract run(context): Promise<TestResult[]>`, `name`, `description` |
| `src/modules/web/index.ts` | Web module entry | Aggregates page-load, forms, workflows sub-modules |
| `src/modules/web/page-load.ts` | Page load tests | URL reachability, status codes, load timing, content checks |
| `src/modules/web/forms.ts` | Form tests | Field presence, submission, validation behavior |
| `src/modules/web/workflows.ts` | Workflow tests | Multi-step browser interactions (login, checkout, etc.) |
| `src/modules/api/index.ts` | API module entry | Aggregates REST and validation sub-modules |
| `src/modules/api/rest.ts` | REST endpoint tests | HTTP method testing, header validation, body checks |
| `src/modules/api/validation.ts` | Response validation | Status code assertions, JSON schema matching |
| `src/modules/cli/index.ts` | CLI module entry | Aggregates executor and output-validator |
| `src/modules/cli/executor.ts` | Command execution | Spawns processes, captures stdout/stderr/exit code |
| `src/modules/cli/output-validator.ts` | Output validation | Regex matching, exact match, contains, exit code checks |
| `src/modules/vm/index.ts` | VM module entry | Aggregates tools, dependencies, config-files |
| `src/modules/vm/tools.ts` | Tool checks | Binary existence via `which`, version extraction |
| `src/modules/vm/dependencies.ts` | Dependency checks | Version range validation (semver) |
| `src/modules/vm/config-files.ts` | Config file checks | File existence, content pattern matching |
| `src/modules/wordpress/index.ts` | WordPress module entry | Aggregates plugins, themes, pages |
| `src/modules/wordpress/plugins.ts` | Plugin tests | WP-CLI plugin checks, activation status, functionality |
| `src/modules/wordpress/themes.ts` | Theme tests | Active theme validation, template rendering |
| `src/modules/wordpress/pages.ts` | Page tests | Page content, shortcodes, block rendering |
| `src/modules/integration/index.ts` | Integration module entry | Cross-module test orchestration |
| `src/modules/integration/runner.ts` | Integration runner | Sequences tests across modules with shared state |
| `src/modules/performance/index.ts` | Performance module entry | Aggregates load and timing |
| `src/modules/performance/load.ts` | Load testing | Concurrent request simulation, throughput measurement |
| `src/modules/performance/timing.ts` | Timing validation | Response time thresholds, percentile calculations |

### Test Runner & Reporting

| File | Purpose | Key Components |
|------|---------|----------------|
| `src/runner/index.ts` | Test orchestrator | `runTests(config, options)` — executes selected modules |
| `src/runner/context.ts` | Execution context | Shared state, project path, config reference, timing |
| `src/runner/lifecycle.ts` | Setup/teardown hooks | `beforeAll`, `afterAll`, `beforeEach`, `afterEach` per module |
| `src/reporter/index.ts` | Report dispatcher | Routes to correct formatter based on config |
| `src/reporter/console.ts` | Console reporter | Color-coded output with `file:line` references |
| `src/reporter/json.ts` | JSON reporter | Machine-readable structured output |
| `src/reporter/github-annotations.ts` | GitHub reporter | `::error file={file},line={line}::` annotation format |

### Utilities

| File | Purpose | Key Components |
|------|---------|----------------|
| `src/utils/logger.ts` | Logging | Structured log levels, contextual metadata |
| `src/utils/errors.ts` | Error types | `TestError`, `ConfigError`, `ModuleError` with `file`, `line`, `column` |
| `src/utils/process.ts` | Process helpers | `exec(cmd)`, `spawn(cmd)` with timeout, output capture |
| `src/utils/http.ts` | HTTP helpers | `request(url, options)` with retry, timeout, response parsing |

### CLI Tool

| File | Purpose | Key Components |
|------|---------|----------------|
| `bin/mcp-qa.ts` | CLI entry point | Commander.js command routing (`init`, `validate`, `list-modules`) |

### Config Templates

| File | Purpose |
|------|---------|
| `templates/web-app.json` | Pre-filled config for web application projects |
| `templates/cli-tool.json` | Pre-filled config for CLI tool projects |
| `templates/vm-environment.json` | Pre-filled config for VM environment validation |
| `templates/wordpress-site.json` | Pre-filled config for WordPress site projects |
| `templates/api-service.json` | Pre-filled config for API service projects |

---

## 4. Configuration Schema

### Base Schema (`.mcp-qa-config.json`)

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/<user>/mcp-qa-server/main/config-schema.json",
  "projectName": "my-project",
  "projectType": "web-app",          // "web-app" | "cli-tool" | "vm-environment" | "wordpress-site" | "api-service"
  "modules": ["web", "api"],         // Which modules to enable
  "reportFormat": "console",         // "console" | "json" | "github"
  "baseUrl": "http://localhost:3000", // Optional — used by web/api modules
  "timeout": 30000,                  // Global timeout in ms
  "env": {                           // Environment variables for test runs
    "NODE_ENV": "test"
  },
  "moduleConfig": {                  // Per-module configuration (see below)
    "web": { ... },
    "api": { ... }
  }
}
```

### Example: Web App Project

```json
{
  "projectName": "my-web-app",
  "projectType": "web-app",
  "modules": ["web", "api", "performance"],
  "reportFormat": "console",
  "baseUrl": "http://localhost:3000",
  "timeout": 30000,
  "moduleConfig": {
    "web": {
      "pages": [
        { "name": "Homepage", "path": "/", "expectedStatus": 200, "contentChecks": ["Welcome"] },
        { "name": "Login", "path": "/login", "expectedStatus": 200 },
        { "name": "Dashboard", "path": "/dashboard", "expectedStatus": 200, "requiresAuth": true }
      ],
      "forms": [
        {
          "name": "Login Form",
          "page": "/login",
          "fields": [
            { "selector": "#email", "type": "email", "testValue": "test@example.com" },
            { "selector": "#password", "type": "password", "testValue": "password123" }
          ],
          "submitSelector": "button[type=submit]",
          "expectedResult": { "redirectTo": "/dashboard" }
        }
      ],
      "workflows": [
        {
          "name": "User Login Flow",
          "steps": [
            { "action": "navigate", "url": "/login" },
            { "action": "fill", "selector": "#email", "value": "test@example.com" },
            { "action": "fill", "selector": "#password", "value": "password123" },
            { "action": "click", "selector": "button[type=submit]" },
            { "action": "waitForUrl", "url": "/dashboard" },
            { "action": "assertVisible", "selector": ".welcome-message" }
          ]
        }
      ]
    },
    "api": {
      "endpoints": [
        { "name": "Health Check", "method": "GET", "path": "/api/health", "expectedStatus": 200 },
        { "name": "List Users", "method": "GET", "path": "/api/users", "expectedStatus": 200, "expectedBody": { "type": "array" } }
      ]
    },
    "performance": {
      "targets": [
        { "url": "/", "maxResponseTime": 2000, "concurrentRequests": 10 },
        { "url": "/api/health", "maxResponseTime": 500, "concurrentRequests": 50 }
      ]
    }
  }
}
```

### Example: CLI Tool Project

```json
{
  "projectName": "my-cli-tool",
  "projectType": "cli-tool",
  "modules": ["cli"],
  "reportFormat": "console",
  "moduleConfig": {
    "cli": {
      "binaryPath": "./dist/my-tool",
      "commands": [
        {
          "name": "Version flag",
          "args": ["--version"],
          "expectedExitCode": 0,
          "expectedOutput": { "pattern": "\\d+\\.\\d+\\.\\d+" }
        },
        {
          "name": "Help flag",
          "args": ["--help"],
          "expectedExitCode": 0,
          "expectedOutput": { "contains": ["Usage:", "Options:"] }
        },
        {
          "name": "Process file",
          "args": ["process", "test-fixtures/input.txt"],
          "expectedExitCode": 0,
          "expectedOutput": { "contains": ["Processed successfully"] },
          "expectedStderr": { "empty": true }
        },
        {
          "name": "Missing file error",
          "args": ["process", "nonexistent.txt"],
          "expectedExitCode": 1,
          "expectedStderr": { "contains": ["File not found"] }
        }
      ]
    }
  }
}
```

### Example: VM Environment

```json
{
  "projectName": "dev-vm-build",
  "projectType": "vm-environment",
  "modules": ["vm"],
  "reportFormat": "console",
  "moduleConfig": {
    "vm": {
      "tools": [
        { "name": "Node.js", "binary": "node", "versionFlag": "--version", "expectedVersion": ">=20.0.0" },
        { "name": "npm", "binary": "npm", "versionFlag": "--version", "expectedVersion": ">=10.0.0" },
        { "name": "Git", "binary": "git", "versionFlag": "--version", "expectedVersion": ">=2.40.0" },
        { "name": "Docker", "binary": "docker", "versionFlag": "--version", "expectedVersion": ">=24.0.0" },
        { "name": "Python", "binary": "python3", "versionFlag": "--version", "expectedVersion": ">=3.10.0" }
      ],
      "dependencies": [
        { "name": "TypeScript (global)", "command": "tsc --version", "expectedVersion": ">=5.0.0" },
        { "name": "AWS CLI", "command": "aws --version", "expectedVersion": ">=2.0.0" }
      ],
      "configFiles": [
        { "path": "/etc/ssh/sshd_config", "exists": true, "contains": ["PermitRootLogin no"] },
        { "path": "~/.gitconfig", "exists": true, "contains": ["[user]"] },
        { "path": "~/.bashrc", "exists": true }
      ],
      "services": [
        { "name": "Docker daemon", "command": "systemctl is-active docker", "expectedOutput": "active" },
        { "name": "SSH", "command": "systemctl is-active sshd", "expectedOutput": "active" }
      ]
    }
  }
}
```

### Example: WordPress Site

```json
{
  "projectName": "client-wordpress-site",
  "projectType": "wordpress-site",
  "modules": ["wordpress", "web", "performance"],
  "reportFormat": "console",
  "baseUrl": "http://localhost:8080",
  "moduleConfig": {
    "wordpress": {
      "wpPath": "/var/www/html",
      "wpCliAvailable": true,
      "plugins": [
        { "slug": "woocommerce", "expectedState": "active", "testUrl": "/shop" },
        { "slug": "yoast-seo", "expectedState": "active" },
        { "slug": "contact-form-7", "expectedState": "active", "testUrl": "/contact" }
      ],
      "themes": [
        { "slug": "astra", "expectedState": "active" }
      ],
      "pages": [
        { "name": "Homepage", "path": "/", "expectedStatus": 200, "contentChecks": ["Welcome"] },
        { "name": "Shop", "path": "/shop", "expectedStatus": 200, "contentChecks": ["Products"] },
        { "name": "Contact", "path": "/contact", "expectedStatus": 200, "contentChecks": ["form"] }
      ]
    },
    "web": {
      "pages": [
        { "name": "Homepage", "path": "/", "expectedStatus": 200 },
        { "name": "Shop", "path": "/shop", "expectedStatus": 200 }
      ]
    },
    "performance": {
      "targets": [
        { "url": "/", "maxResponseTime": 3000, "concurrentRequests": 5 },
        { "url": "/shop", "maxResponseTime": 4000, "concurrentRequests": 5 }
      ]
    }
  }
}
```

### Example: API Service

```json
{
  "projectName": "user-api-service",
  "projectType": "api-service",
  "modules": ["api", "performance"],
  "reportFormat": "json",
  "baseUrl": "http://localhost:4000",
  "timeout": 15000,
  "moduleConfig": {
    "api": {
      "auth": {
        "type": "bearer",
        "tokenEnvVar": "API_TEST_TOKEN"
      },
      "endpoints": [
        { "name": "Health", "method": "GET", "path": "/health", "expectedStatus": 200 },
        {
          "name": "Create User",
          "method": "POST",
          "path": "/api/users",
          "body": { "name": "Test User", "email": "test@example.com" },
          "expectedStatus": 201,
          "expectedBody": { "hasKeys": ["id", "name", "email", "createdAt"] }
        },
        {
          "name": "List Users",
          "method": "GET",
          "path": "/api/users",
          "expectedStatus": 200,
          "expectedBody": { "type": "array" }
        },
        {
          "name": "Unauthorized access",
          "method": "GET",
          "path": "/api/admin",
          "skipAuth": true,
          "expectedStatus": 401
        }
      ]
    },
    "performance": {
      "targets": [
        { "url": "/health", "maxResponseTime": 200, "concurrentRequests": 100 },
        { "url": "/api/users", "maxResponseTime": 1000, "concurrentRequests": 20 }
      ]
    }
  }
}
```

---

## 5. Module Breakdown

### 5.1 Web/UI Testing Module (`src/modules/web/`)

**Capabilities:**
- **Page Load Testing**: Navigate to URLs, assert HTTP status codes, measure load times, check for expected content on page
- **Form Testing**: Locate form fields by CSS selector, fill with test data, submit, validate success/error responses, check redirects
- **Workflow Testing**: Execute multi-step browser interactions defined as a sequence of actions (navigate, click, fill, wait, assert)

**Browser Engine:** Playwright (headless Chromium by default, configurable)

**Key Types:**
```typescript
interface PageTest {
  name: string;
  path: string;
  expectedStatus: number;
  contentChecks?: string[];
  requiresAuth?: boolean;
  maxLoadTime?: number;
}

interface FormTest {
  name: string;
  page: string;
  fields: { selector: string; type: string; testValue: string }[];
  submitSelector: string;
  expectedResult: { redirectTo?: string; containsText?: string; errorMessage?: string };
}

interface WorkflowStep {
  action: "navigate" | "click" | "fill" | "select" | "waitForUrl" | "waitForSelector" | "assertVisible" | "assertText" | "screenshot";
  selector?: string;
  url?: string;
  value?: string;
  timeout?: number;
}
```

### 5.2 API Testing Module (`src/modules/api/`)

**Capabilities:**
- **REST Endpoint Testing**: Send HTTP requests with configurable method, headers, body, query params
- **Response Validation**: Assert status codes, check response body structure (has keys, type checks), validate against JSON schema
- **Authentication**: Support Bearer token, API key, and Basic auth from environment variables
- **Chained Requests**: Use response values from one request in subsequent requests (e.g., create then fetch by ID)

**Key Types:**
```typescript
interface EndpointTest {
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
    schema?: object;  // JSON Schema
  };
  skipAuth?: boolean;
  captureAs?: string;  // Store response value for chaining
}
```

### 5.3 CLI Testing Module (`src/modules/cli/`)

**Capabilities:**
- **Command Execution**: Run CLI commands with arguments, environment variables, working directory, stdin input
- **Output Validation**: Check stdout for exact match, contains, regex patterns; same for stderr
- **Exit Code Validation**: Assert specific exit codes
- **Timeout Handling**: Kill long-running commands after configurable timeout
- **File Output Checks**: Verify commands create expected files with expected content

**Key Types:**
```typescript
interface CommandTest {
  name: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  stdin?: string;
  expectedExitCode: number;
  expectedOutput?: { exact?: string; contains?: string[]; pattern?: string };
  expectedStderr?: { empty?: boolean; contains?: string[]; pattern?: string };
  timeout?: number;
  createsFiles?: { path: string; contains?: string[] }[];
}
```

### 5.4 VM Environment Validation Module (`src/modules/vm/`)

**Capabilities:**
- **Tool Installation Checks**: Verify binaries exist on PATH via `which`/`command -v`
- **Version Validation**: Extract version strings and compare against semver ranges
- **Dependency Checks**: Run arbitrary version commands and validate output
- **Config File Validation**: Check file existence, permissions, content patterns
- **Service Status**: Verify system services are running (systemctl, service, etc.)

**Key Types:**
```typescript
interface ToolCheck {
  name: string;
  binary: string;
  versionFlag?: string;
  expectedVersion?: string;  // semver range
}

interface ConfigFileCheck {
  path: string;
  exists: boolean;
  contains?: string[];
  permissions?: string;  // e.g., "644"
}

interface ServiceCheck {
  name: string;
  command: string;
  expectedOutput: string;
}
```

### 5.5 WordPress Testing Module (`src/modules/wordpress/`)

**Capabilities:**
- **Plugin Validation**: Check plugin installation and activation status via WP-CLI or HTTP
- **Theme Validation**: Verify active theme, check template rendering
- **Page Content Testing**: Verify pages load, contain expected content, shortcodes render
- **WP-CLI Integration**: Run WP-CLI commands for deeper inspection when available
- **Database Checks**: Verify options, post counts, etc. via WP-CLI

**Key Types:**
```typescript
interface PluginTest {
  slug: string;
  expectedState: "active" | "inactive" | "installed";
  testUrl?: string;
  testContent?: string[];
}

interface ThemeTest {
  slug: string;
  expectedState: "active" | "installed";
}

interface WPPageTest {
  name: string;
  path: string;
  expectedStatus: number;
  contentChecks?: string[];
}
```

### 5.6 Integration Testing Module (`src/modules/integration/`)

**Capabilities:**
- **Cross-Module Orchestration**: Run tests that span multiple modules in sequence (e.g., API creates data, then Web verifies it appears)
- **Shared State**: Pass data between test steps across modules
- **Dependency Ordering**: Define which tests must pass before others run

### 5.7 Performance Testing Module (`src/modules/performance/`)

**Capabilities:**
- **Load Testing**: Send concurrent HTTP requests, measure throughput and error rates
- **Response Time Validation**: Assert response times stay under configurable thresholds
- **Percentile Reporting**: Report p50, p90, p95, p99 response times
- **Ramp-Up Support**: Gradually increase concurrent connections

---

## 6. CLI Tool Specification

### Installation

```bash
# After cloning and building:
npm install -g .

# Or during development:
npm link
```

This registers `mcp-qa` as a global command via `package.json` `bin` field.

### Commands

#### `mcp-qa init`

Interactive initialization that creates `.mcp-qa-config.json` in the current working directory.

**Flow:**

```
$ cd /path/to/my-project
$ mcp-qa init

🔧 MCP QA Server — Project Initialization
──────────────────────────────────────────

? Project name: (my-project)           ← defaults to directory name
? Project type:
  ❯ Web Application
    API Service
    CLI Tool
    VM Environment
    WordPress Site

? Base URL: (http://localhost:3000)     ← shown for web/api/wordpress types

? Which testing modules do you need?   ← pre-selects based on project type
  ◉ Web/UI Testing
  ◉ API Testing
  ◯ CLI Testing
  ◯ VM Environment Validation
  ◯ WordPress Testing
  ◯ Integration Testing
  ◯ Performance Testing

? Report format:
  ❯ Console (human-readable with colors)
    JSON (machine-readable)
    GitHub Actions (annotation format)

✅ Created .mcp-qa-config.json

Summary:
  Project:  my-project
  Type:     web-app
  Modules:  web, api
  Base URL: http://localhost:3000
  Report:   console

Next steps:
  1. Edit .mcp-qa-config.json to add your specific test targets
  2. Add the MCP server to your Claude Desktop config:
     {
       "mcpServers": {
         "qa": {
           "command": "node",
           "args": ["/path/to/mcp-qa-server/dist/index.js"]
         }
       }
     }
  3. Ask Claude to run your QA tests!
```

**Prompt Logic by Project Type:**

| Project Type | Pre-selected Modules | Extra Prompts |
|-------------|---------------------|---------------|
| Web Application | web, api | Base URL |
| API Service | api | Base URL |
| CLI Tool | cli | Binary path |
| VM Environment | vm | (none extra) |
| WordPress Site | wordpress, web | Base URL, WP install path, WP-CLI available? |

#### `mcp-qa validate`

Validates an existing `.mcp-qa-config.json` in the current directory.

```
$ mcp-qa validate

✅ Config is valid
  Project:  my-project
  Type:     web-app
  Modules:  web, api (2 active)
  Issues:   none
```

Or with errors:

```
$ mcp-qa validate

❌ Config validation failed:
  ✗ moduleConfig.web.pages[0].expectedStatus — must be a number (line 15)
  ✗ moduleConfig.api.endpoints — required field missing
  ✗ modules[2] "invalid-module" — unknown module name
```

#### `mcp-qa list-modules`

Lists all available testing modules with descriptions.

```
$ mcp-qa list-modules

Available Modules:
  web          Web/UI testing (page loads, forms, workflows)
  api          API endpoint testing (REST, response validation)
  cli          CLI tool testing (command execution, output validation)
  vm           VM environment validation (tools, deps, configs)
  wordpress    WordPress testing (plugins, themes, pages)
  integration  Integration testing (cross-module orchestration)
  performance  Performance testing (load, response times)
```

---

## 7. Implementation Steps

Build order is designed so each step produces something testable before moving on.

### Phase 1: Foundation

1. **Initialize npm project** — `package.json` with dependencies, `tsconfig.json`, `.gitignore`
2. **Create shared types** — `src/types.ts` with all core interfaces (`TestResult`, `TestReport`, `ProjectConfig`, etc.)
3. **Build config system** — `src/config/schema.ts` (Zod schema), `src/config/defaults.ts` (defaults per type), `src/config/loader.ts` (file loading + validation)
4. **Create error utilities** — `src/utils/errors.ts` with `TestError`, `ConfigError` classes including `file`, `line`, `column` fields
5. **Create logging utility** — `src/utils/logger.ts`

### Phase 2: Module Framework

6. **Build base module** — `src/modules/base-module.ts` abstract class with `run()`, `name`, `description`
7. **Build module registry** — `src/modules/index.ts` that maps module names to implementations
8. **Build test runner** — `src/runner/index.ts`, `src/runner/context.ts`, `src/runner/lifecycle.ts`
9. **Build console reporter** — `src/reporter/console.ts` with file:line error formatting
10. **Build reporter dispatcher** — `src/reporter/index.ts` + `src/reporter/json.ts` + `src/reporter/github-annotations.ts`

### Phase 3: MCP Server

11. **Build MCP server** — `src/server.ts` registering all 5 tools (`qa_run_tests`, `qa_run_module`, `qa_list_modules`, `qa_check_config`, `qa_get_report`)
12. **Build server entry point** — `src/index.ts` connecting server to stdio transport
13. **Verify server starts** — Test that `node dist/index.js` starts and responds to MCP protocol

### Phase 4: Testing Modules

14. **Build VM module** — `src/modules/vm/*` (simplest module, no browser needed — good first module to validate the framework)
15. **Build CLI module** — `src/modules/cli/*` (second simplest — process execution and output matching)
16. **Build API module** — `src/modules/api/*` (HTTP-based, moderate complexity)
17. **Build Web module** — `src/modules/web/*` (most complex — requires Playwright)
18. **Build WordPress module** — `src/modules/wordpress/*` (extends web + WP-CLI)
19. **Build Performance module** — `src/modules/performance/*` (concurrent HTTP testing)
20. **Build Integration module** — `src/modules/integration/*` (cross-module orchestration)

### Phase 5: CLI Tool

21. **Build CLI entry point** — `bin/mcp-qa.ts` with Commander.js
22. **Build `init` command** — Interactive prompts with Inquirer.js, template config generation
23. **Build `validate` command** — Loads and validates config, reports errors
24. **Build `list-modules` command** — Lists available modules
25. **Create config templates** — `templates/*.json` for each project type

### Phase 6: Polish & Testing

26. **Write unit tests** — Config loader, module registry, individual modules
27. **Write integration test** — Full MCP server tool call round-trip
28. **Add README** — Installation, usage, config reference

---

## 8. Recommended Next Steps

After approval, here are the exact first files to create and their initial content:

### File 1: `package.json`

```json
{
  "name": "mcp-qa-server",
  "version": "0.1.0",
  "description": "Reusable MCP server for QA automation testing across multiple project types",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "mcp-qa": "dist/bin/mcp-qa.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0",
    "playwright": "^1.40.0",
    "commander": "^12.0.0",
    "inquirer": "^9.2.0",
    "semver": "^7.5.0",
    "chalk": "^5.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/semver": "^7.5.0",
    "@types/inquirer": "^9.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "eslint": "^8.50.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0"
  }
}
```

### File 2: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*", "bin/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### File 3: `src/types.ts` (first ~50 lines)

```typescript
export type ProjectType = "web-app" | "cli-tool" | "vm-environment" | "wordpress-site" | "api-service";
export type ModuleName = "web" | "api" | "cli" | "vm" | "wordpress" | "integration" | "performance";
export type ReportFormat = "console" | "json" | "github";

export type TestStatus = "passed" | "failed" | "skipped" | "error";

export interface TestResult {
  name: string;
  module: ModuleName;
  status: TestStatus;
  duration: number;           // ms
  message?: string;
  error?: {
    message: string;
    file?: string;
    line?: number;
    column?: number;
    stack?: string;
  };
}

export interface TestReport {
  projectName: string;
  timestamp: string;
  duration: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    errors: number;
  };
  results: TestResult[];
}

export interface ProjectConfig {
  projectName: string;
  projectType: ProjectType;
  modules: ModuleName[];
  reportFormat: ReportFormat;
  baseUrl?: string;
  timeout: number;
  env?: Record<string, string>;
  moduleConfig: Record<string, unknown>;
}
```

### Build Priority

Create files in this order to get a working system as fast as possible:

1. `package.json` + `tsconfig.json` + `.gitignore` → `npm install`
2. `src/types.ts` → shared types
3. `src/config/*` → config loading works
4. `src/utils/*` → error handling and logging
5. `src/modules/base-module.ts` + `src/modules/index.ts` → module framework
6. `src/modules/vm/*` → first working module (no browser deps)
7. `src/runner/*` → can execute modules
8. `src/reporter/console.ts` → can see results
9. `src/server.ts` + `src/index.ts` → MCP server works end-to-end
10. Remaining modules one at a time
11. CLI tool last (depends on config + templates)

---

## 9. Potential Challenges

### Challenge 1: Playwright Browser Dependencies

**Problem:** Playwright requires browser binaries (~400MB+ per browser). Installing on CI or new machines adds significant setup time and disk usage.

**Solution:**
- Default to Chromium only (not all 3 browsers)
- Make the web module lazy-load Playwright — only install/import when web tests are actually configured
- Provide clear error messages: `"Web module requires Playwright. Run: npx playwright install chromium"`
- Document the install step in the CLI `init` output when web module is selected

### Challenge 2: Config Schema Evolution

**Problem:** As modules gain features, the config schema will change. Existing `.mcp-qa-config.json` files in projects could become invalid.

**Solution:**
- Add a `"configVersion": 1` field to the schema from day one
- Build a simple migration system: `src/config/migrations/` with versioned upgrade functions
- The `validate` CLI command should suggest fixes for outdated configs
- Use Zod's `.passthrough()` to be lenient about unknown fields (forward-compatible)

### Challenge 3: Authentication for Web/API Tests

**Problem:** Many tests need authentication (login flows, bearer tokens, API keys). Credentials shouldn't live in config files.

**Solution:**
- Auth tokens/credentials referenced via environment variable names in config (e.g., `"tokenEnvVar": "API_TEST_TOKEN"`)
- Support `.env` file loading from the project directory (via `dotenv`)
- For web auth flows, support a `"setupScript"` field that runs before tests to establish browser session state
- Never log or report credential values

### Challenge 4: Test Isolation and Ordering

**Problem:** Some tests create state that other tests depend on (e.g., API creates a user, then another test lists users). But tests should ideally be independent.

**Solution:**
- Default behavior: modules run in parallel, tests within a module run in sequence
- Support explicit `dependsOn` field for tests that need ordering
- Integration module handles cross-module sequencing
- Runner provides `context.store` for passing data between tests (like a created user ID)

### Challenge 5: Cross-Platform Compatibility

**Problem:** VM module uses Unix commands (`which`, `systemctl`). CLI module uses shell execution. Behavior differs between Linux, macOS, and WSL.

**Solution:**
- VM module: use `command -v` (POSIX) instead of `which` as primary binary lookup
- Detect platform in context and adjust commands accordingly
- Document platform-specific config options (e.g., `"serviceManager": "systemctl" | "launchctl" | "manual"`)
- CLI module: use Node.js `child_process` with `shell: true` and let the OS handle path resolution

### Challenge 6: MCP Server Statefulness

**Problem:** MCP servers persist across tool calls. If the server caches a config and the user edits it mid-session, stale config could cause confusing behavior.

**Solution:**
- Reload config from disk on every `qa_run_tests` and `qa_run_module` call (configs are small, disk read is cheap)
- Cache last test report in memory for `qa_get_report` but include a timestamp so Claude can tell if it's stale
- `qa_check_config` always reads from disk

### Challenge 7: Error Reporting with File:Line References

**Problem:** For config errors, providing file:line info is straightforward (Zod paths map to JSON lines). For runtime test failures, mapping back to specific config lines is harder.

**Solution:**
- Config errors: Parse JSON with a position-tracking parser (or use the Zod error path to compute line numbers from the raw JSON string)
- Runtime errors: Include the test name + module name + config path in every `TestResult.error` so the user can locate the relevant config section
- For code-level errors (e.g., a web page 404), include the URL and the config entry that defined it
- GitHub reporter: Use `::error file=.mcp-qa-config.json,line=25::` format pointing directly to the config line

### Challenge 8: Long-Running Tests and Timeouts

**Problem:** Performance tests, complex workflows, and slow pages can cause MCP tool calls to appear hung.

**Solution:**
- Global timeout in config with per-test override capability
- Runner enforces timeouts and kills stuck tests gracefully
- Return partial results if some tests complete before timeout kills others
- Consider streaming progress (MCP supports progress notifications) for long test suites

---

*This plan was generated for the `mcp-qa-server` project. Review and approve before implementation begins.*
