import type { TestResult, WpThemeTest } from "../../types.js";
import { exec } from "../../utils/process.js";

/**
 * Test WordPress theme installation and activation status via WP-CLI.
 */
export async function runThemeTests(
  themes: WpThemeTest[],
  wpPath: string | undefined,
  wpCliAvailable: boolean,
  timeout: number
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  if (!wpCliAvailable || !wpPath) {
    for (const theme of themes) {
      results.push({
        name: `wordpress:theme:${theme.slug}`,
        module: "wordpress",
        status: "skipped",
        duration: 0,
        message: `Cannot check theme "${theme.slug}" — WP-CLI not available`,
      });
    }
    return results;
  }

  // Get the active theme slug once
  const activeResult = await exec(
    "wp",
    ["theme", "list", "--status=active", "--field=name", `--path=${wpPath}`],
    { timeout }
  );
  const activeTheme = activeResult.stdout.trim();

  // Get all installed theme slugs
  const installedResult = await exec(
    "wp",
    ["theme", "list", "--field=name", `--path=${wpPath}`],
    { timeout }
  );
  const installedThemes = new Set(
    installedResult.stdout
      .trim()
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  for (const theme of themes) {
    const start = Date.now();
    const isInstalled = installedThemes.has(theme.slug);
    const isActive = activeTheme === theme.slug;
    const duration = Date.now() - start;

    let passed = false;
    switch (theme.expectedState) {
      case "active":
        passed = isActive;
        break;
      case "installed":
        passed = isInstalled;
        break;
    }

    if (passed) {
      results.push({
        name: `wordpress:theme:${theme.slug}`,
        module: "wordpress",
        status: "passed",
        duration,
        message: `Theme "${theme.slug}" is ${theme.expectedState}`,
      });
    } else {
      const actual = isActive
        ? "active"
        : isInstalled
          ? "installed (not active)"
          : "not installed";
      results.push({
        name: `wordpress:theme:${theme.slug}`,
        module: "wordpress",
        status: "failed",
        duration,
        message: `Theme "${theme.slug}" expected ${theme.expectedState}, got: ${actual}`,
        error: {
          message: `Expected "${theme.expectedState}", actual: ${actual}`,
        },
      });
    }
  }

  return results;
}
