import chalk from "chalk";
import { ALL_MODULES } from "../../src/modules/index.js";

export async function runListModules(): Promise<void> {
  console.log("");
  console.log(chalk.bold("  Available Modules:"));
  console.log("");

  for (const mod of ALL_MODULES) {
    console.log(
      `    ${chalk.cyan(mod.name.padEnd(14))} ${mod.description}`
    );
  }

  console.log("");
}
