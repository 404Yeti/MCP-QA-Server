# MCP QA Server

A reusable [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for QA automation testing. Works across multiple project types — web apps, API services, CLI tools, VM environments, and WordPress sites.

The server itself is project-agnostic. All project-specific test targets live in a `.mcp-qa-config.json` file inside each project's repository.

## Quick Start

```bash
# Clone and install
git clone <repo-url> mcp-qa-server
cd mcp-qa-server
npm install
npm run build

# Install CLI globally
npm link

# In any project directory:
mcp-qa init
```

## Adding to Claude Desktop

Add to your Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "qa": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-qa-server/dist/src/index.js"]
    }
  }
}
```

Then ask Claude: *"Run QA tests for this project"* — Claude will use the `qa_run_tests` tool with your project path.

## CLI Commands

### `mcp-qa init`

Interactive initialization. Creates `.mcp-qa-config.json` in the current directory with sensible defaults based on your project type.

```
$ mcp-qa init

  MCP QA Server — Project Initialization
  ──────────────────────────────────────────

? Project name: my-web-app
? Project type: Web Application
? Base URL: http://localhost:3000
? Which testing modules do you need? Web/UI Testing, API Testing
? Report format: Console
```

### `mcp-qa validate`

Validates the config file in the current directory. Reports specific errors with field paths.

```
$ mcp-qa validate

  Config is valid
    Project:  my-web-app
    Type:     web-app
    Modules:  web, api (2 active)
    Issues:   none
```

### `mcp-qa list-modules`

Lists all available testing modules.

```
$ mcp-qa list-modules

  Available Modules:
    web            Web/UI testing (page loads, forms, workflows)
    api            API endpoint testing (REST, response validation)
    cli            CLI tool testing (command execution, output validation)
    vm             VM environment validation (tools, deps, configs)
    wordpress      WordPress testing (plugins, themes, pages)
    integration    Integration testing (cross-module orchestration)
    performance    Performance testing (load, response times)
```

## MCP Tools

The server exposes 5 tools to Claude:

| Tool | Description |
|------|-------------|
| `qa_run_tests` | Run all (or filtered) tests for a project |
| `qa_run_module` | Run a single testing module |
| `qa_list_modules` | List available modules and their status |
| `qa_check_config` | Validate the project config file |
| `qa_get_report` | Retrieve the last test report |

## Testing Modules

### Web/UI (`web`)

Browser-based testing via Playwright (headless Chromium).

- **Page loads** — URL reachability, status codes, load timing, content checks
- **Forms** — Field filling, submission, redirect/content/error validation
- **Workflows** — Multi-step browser interactions (navigate, click, fill, wait, assert)

Requires: `npx playwright install chromium`

### API (`api`)

HTTP endpoint testing.

- **REST requests** — All HTTP methods, headers, query params, request bodies
- **Response validation** — Status codes, body type, key presence, value matching
- **Authentication** — Bearer token, API key, Basic auth via environment variables
- **Chaining** — Capture response values for use in subsequent requests

### CLI (`cli`)

Command-line tool testing.

- **Execution** — Spawn processes with args, env vars, stdin, timeout
- **Output validation** — stdout/stderr exact match, contains, regex patterns
- **Exit codes** — Assert specific exit codes
- **File creation** — Verify commands create expected files with expected content

### VM Environment (`vm`)

Validate development environment setup.

- **Tool checks** — Binary existence on PATH via `command -v`
- **Version validation** — Semver range checking (e.g., `>=20.0.0`)
- **Dependencies** — Arbitrary command-based version checks
- **Config files** — Existence, permissions, content pattern matching
- **Services** — Systemd/launchd service status checks

### WordPress (`wordpress`)

WordPress-specific testing.

- **Plugins** — Installation and activation status via WP-CLI or HTTP fallback
- **Themes** — Active theme validation
- **Pages** — Content loading, status codes, content checks

### Performance (`performance`)

Basic load and response time testing.

- **Timing** — Single-request response time thresholds
- **Load testing** — Concurrent request bursts with p50/p95/p99 percentiles
- **Error rates** — Track failures under load

### Integration (`integration`)

Cross-module test orchestration.

- **Scenarios** — Sequential steps spanning multiple modules
- **Shared state** — Pass data between modules via `context.store`
- **Stop on failure** — Abort scenario when a step fails

## Configuration

Config files live in each project as `.mcp-qa-config.json`. Run `mcp-qa init` to generate one, or create manually.

### Schema

```jsonc
{
  "configVersion": 1,
  "projectName": "my-project",
  "projectType": "web-app",        // web-app | api-service | cli-tool | vm-environment | wordpress-site
  "modules": ["web", "api"],       // Which modules to enable
  "reportFormat": "console",       // console | json | github
  "baseUrl": "http://localhost:3000",
  "timeout": 30000,                // Global timeout in ms
  "env": {},                       // Environment variables for test runs
  "moduleConfig": {                // Per-module config (see below)
    "web": { ... },
    "api": { ... }
  }
}
```

### Module Config Examples

See the `templates/` directory for complete examples:

- [`templates/web-app.json`](templates/web-app.json) — Web app with page loads, forms, workflows, API endpoints, performance targets
- [`templates/api-service.json`](templates/api-service.json) — API service with auth, CRUD endpoints, performance
- [`templates/cli-tool.json`](templates/cli-tool.json) — CLI with version, help, file processing, error handling commands
- [`templates/vm-environment.json`](templates/vm-environment.json) — VM with tools, dependencies, config files, services
- [`templates/wordpress-site.json`](templates/wordpress-site.json) — WordPress with plugins, themes, pages, performance

## Report Formats

### Console

Human-readable with `[PASS]`/`[FAIL]`/`[SKIP]`/`[ERR!]` indicators, file:line error locations, module grouping, and summary.

### JSON

Machine-readable structured output. Full `TestReport` object with all results, timing, and error details.

### GitHub Actions

Annotation format for CI. Produces `::error file=X,line=Y::message` output that creates inline annotations on pull requests.

## Error Reporting

All errors include location information when available:

- **Config errors** — File path + line number pointing to the invalid field
- **Test failures** — Test name, module, and the config entry that defined the test
- **Runtime errors** — Stack traces with source locations

Console format: `.mcp-qa-config.json:25 — Expected redirect to /dashboard`
GitHub format: `::error file=.mcp-qa-config.json,line=25::Expected redirect to /dashboard`

## Development

```bash
npm run build     # Compile TypeScript
npm run dev       # Watch mode
npm test          # Run tests
npm run lint      # Lint
```

## Architecture

```
.mcp-qa-config.json (per project)
        │
        ▼
┌─── MCP QA Server ──────────────┐
│  Config Loader → Module Registry│
│       │              │          │
│  Test Runner ← Base Module      │
│       │              │          │
│  Reporter       7 Modules       │
│  (console/json/github)          │
└─────────────────────────────────┘
        │
        ▼
  Claude Desktop (via stdio)
```

The server reads `.mcp-qa-config.json` from disk on every tool call (never cached) so edits are picked up immediately.
