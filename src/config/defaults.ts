import type { ProjectType, ModuleName, ReportFormat } from "../types.js";

interface ProjectDefaults {
  modules: ModuleName[];
  reportFormat: ReportFormat;
  timeout: number;
  baseUrl?: string;
  moduleConfig: Record<string, unknown>;
}

const defaultsByType: Record<ProjectType, ProjectDefaults> = {
  "web-app": {
    modules: ["web", "api"],
    reportFormat: "console",
    timeout: 30000,
    baseUrl: "http://localhost:3000",
    moduleConfig: {
      web: {
        pages: [
          { name: "Homepage", path: "/", expectedStatus: 200 },
        ],
      },
      api: {
        endpoints: [
          { name: "Health Check", method: "GET", path: "/api/health", expectedStatus: 200 },
        ],
      },
    },
  },

  "api-service": {
    modules: ["api"],
    reportFormat: "console",
    timeout: 15000,
    baseUrl: "http://localhost:4000",
    moduleConfig: {
      api: {
        endpoints: [
          { name: "Health Check", method: "GET", path: "/health", expectedStatus: 200 },
        ],
      },
    },
  },

  "cli-tool": {
    modules: ["cli"],
    reportFormat: "console",
    timeout: 30000,
    moduleConfig: {
      cli: {
        binaryPath: "./dist/index.js",
        commands: [
          { name: "Version flag", args: ["--version"], expectedExitCode: 0 },
          { name: "Help flag", args: ["--help"], expectedExitCode: 0 },
        ],
      },
    },
  },

  "vm-environment": {
    modules: ["vm"],
    reportFormat: "console",
    timeout: 60000,
    moduleConfig: {
      vm: {
        tools: [
          { name: "Node.js", binary: "node", versionFlag: "--version" },
          { name: "Git", binary: "git", versionFlag: "--version" },
        ],
        configFiles: [],
        services: [],
      },
    },
  },

  "wordpress-site": {
    modules: ["wordpress", "web"],
    reportFormat: "console",
    timeout: 30000,
    baseUrl: "http://localhost:8080",
    moduleConfig: {
      wordpress: {
        wpCliAvailable: false,
        plugins: [],
        themes: [],
        pages: [
          { name: "Homepage", path: "/", expectedStatus: 200 },
        ],
      },
      web: {
        pages: [
          { name: "Homepage", path: "/", expectedStatus: 200 },
        ],
      },
    },
  },
};

export function getDefaults(projectType: ProjectType): ProjectDefaults {
  return defaultsByType[projectType];
}

export function getDefaultModules(projectType: ProjectType): ModuleName[] {
  return defaultsByType[projectType].modules;
}
