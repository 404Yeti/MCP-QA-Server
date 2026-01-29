import type { TestResult, TestContext, WpPluginTest } from "../../types.js";
import { exec } from "../../utils/process.js";
import { httpRequest } from "../../utils/http.js";

/**
 * Test WordPress plugin installation and activation status.
 * Uses WP-CLI when available, falls back to HTTP checks.
 */
export async function runPluginTests(
  plugins: WpPluginTest[],
  wpPath: string | undefined,
  wpCliAvailable: boolean,
  baseUrl: string | undefined,
  timeout: number
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const plugin of plugins) {
    const start = Date.now();

    if (wpCliAvailable && wpPath) {
      // Use WP-CLI for precise status checking
      const result = await exec(
        "wp",
        ["plugin", "status", plugin.slug, `--path=${wpPath}`],
        { timeout }
      );

      const output = result.stdout.trim().toLowerCase();
      const duration = Date.now() - start;

      if (result.exitCode !== 0) {
        results.push({
          name: `wordpress:plugin:${plugin.slug}`,
          module: "wordpress",
          status: "failed",
          duration,
          message: `WP-CLI failed to check plugin "${plugin.slug}": ${result.stderr}`,
          error: { message: result.stderr || result.stdout },
        });
        continue;
      }

      const isActive = output.includes("active");
      const isInstalled =
        output.includes("inactive") || output.includes("active");

      let passed = false;
      switch (plugin.expectedState) {
        case "active":
          passed = isActive;
          break;
        case "inactive":
          passed = isInstalled && !isActive;
          break;
        case "installed":
          passed = isInstalled;
          break;
      }

      if (passed) {
        results.push({
          name: `wordpress:plugin:${plugin.slug}`,
          module: "wordpress",
          status: "passed",
          duration,
          message: `Plugin "${plugin.slug}" is ${plugin.expectedState}`,
        });
      } else {
        results.push({
          name: `wordpress:plugin:${plugin.slug}`,
          module: "wordpress",
          status: "failed",
          duration,
          message: `Plugin "${plugin.slug}" expected to be ${plugin.expectedState}, got: ${output}`,
          error: {
            message: `Expected state "${plugin.expectedState}", actual output: ${output}`,
          },
        });
      }
    } else if (plugin.testUrl && baseUrl) {
      // Fallback: check if the plugin's test URL is reachable
      try {
        const url = new URL(plugin.testUrl, baseUrl).toString();
        const response = await httpRequest(url, { timeout });
        const duration = Date.now() - start;

        if (response.status === 200) {
          // If testContent is specified, check for it
          if (plugin.testContent && plugin.testContent.length > 0) {
            const missing = plugin.testContent.filter(
              (t) => !response.body.includes(t)
            );
            if (missing.length > 0) {
              results.push({
                name: `wordpress:plugin:${plugin.slug}`,
                module: "wordpress",
                status: "failed",
                duration,
                message: `Plugin page ${plugin.testUrl} missing content: ${missing.join(", ")}`,
                error: { message: `Missing content: ${missing.join(", ")}` },
              });
              continue;
            }
          }

          results.push({
            name: `wordpress:plugin:${plugin.slug}`,
            module: "wordpress",
            status: "passed",
            duration,
            message: `Plugin "${plugin.slug}" test URL ${plugin.testUrl} responds OK`,
          });
        } else {
          results.push({
            name: `wordpress:plugin:${plugin.slug}`,
            module: "wordpress",
            status: "failed",
            duration,
            message: `Plugin test URL ${plugin.testUrl} returned ${response.status}`,
            error: { message: `HTTP ${response.status} at ${plugin.testUrl}` },
          });
        }
      } catch (err) {
        results.push({
          name: `wordpress:plugin:${plugin.slug}`,
          module: "wordpress",
          status: "error",
          duration: Date.now() - start,
          message: err instanceof Error ? err.message : String(err),
          error: {
            message: err instanceof Error ? err.message : String(err),
          },
        });
      }
    } else {
      results.push({
        name: `wordpress:plugin:${plugin.slug}`,
        module: "wordpress",
        status: "skipped",
        duration: 0,
        message: `Cannot check plugin "${plugin.slug}" — no WP-CLI and no testUrl configured`,
      });
    }
  }

  return results;
}
