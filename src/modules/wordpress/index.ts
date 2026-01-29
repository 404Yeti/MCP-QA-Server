import { BaseModule } from "../base-module.js";
import type {
  ModuleName,
  TestResult,
  TestContext,
  WordPressModuleConfig,
} from "../../types.js";
import { runPluginTests } from "./plugins.js";
import { runThemeTests } from "./themes.js";
import { runWpPageTests } from "./pages.js";

export class WordPressModule extends BaseModule {
  readonly name: ModuleName = "wordpress";
  readonly description = "WordPress testing (plugins, themes, pages)";

  validate(context: TestContext): string[] {
    const errors: string[] = [];
    const cfg = context.config.moduleConfig["wordpress"] as WordPressModuleConfig | undefined;
    if (!cfg) return errors;

    // Need either WP-CLI + wpPath, or baseUrl for HTTP-based checks
    const hasWpCli = cfg.wpCliAvailable && cfg.wpPath;
    const hasBaseUrl = !!context.config.baseUrl;

    if (!hasWpCli && !hasBaseUrl) {
      errors.push(
        "WordPress module needs either WP-CLI (wpCliAvailable + wpPath) or a baseUrl for HTTP checks"
      );
    }
    return errors;
  }

  async run(context: TestContext): Promise<TestResult[]> {
    const cfg = context.config.moduleConfig["wordpress"] as WordPressModuleConfig | undefined;
    if (!cfg) {
      return [this.skip("wordpress", "No WordPress module configuration found")];
    }

    const wpCliAvailable = cfg.wpCliAvailable ?? false;
    const wpPath = cfg.wpPath;
    const baseUrl = context.config.baseUrl;
    const timeout = context.config.timeout;
    const results: TestResult[] = [];

    // Plugin tests
    if (cfg.plugins && cfg.plugins.length > 0) {
      results.push(
        ...(await runPluginTests(cfg.plugins, wpPath, wpCliAvailable, baseUrl, timeout))
      );
    }

    // Theme tests
    if (cfg.themes && cfg.themes.length > 0) {
      results.push(
        ...(await runThemeTests(cfg.themes, wpPath, wpCliAvailable, timeout))
      );
    }

    // Page tests
    if (cfg.pages && cfg.pages.length > 0 && baseUrl) {
      results.push(...(await runWpPageTests(cfg.pages, baseUrl, timeout)));
    } else if (cfg.pages && cfg.pages.length > 0 && !baseUrl) {
      for (const page of cfg.pages) {
        results.push(
          this.skip(
            `wordpress:page:${page.name}`,
            "No baseUrl configured — cannot run page tests"
          )
        );
      }
    }

    return results;
  }
}
