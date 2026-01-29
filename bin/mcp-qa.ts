#!/usr/bin/env node

import { Command } from "commander";
import { runInit } from "./commands/init.js";
import { runValidate } from "./commands/validate.js";
import { runListModules } from "./commands/list-modules.js";

const program = new Command();

program
  .name("mcp-qa")
  .description("MCP QA Server — CLI tools for QA automation testing")
  .version("0.1.0");

program
  .command("init")
  .description(
    "Initialize a new .mcp-qa-config.json in the current directory"
  )
  .action(async () => {
    try {
      await runInit();
    } catch (err) {
      console.error(
        "Error:",
        err instanceof Error ? err.message : String(err)
      );
      process.exitCode = 1;
    }
  });

program
  .command("validate")
  .description(
    "Validate the .mcp-qa-config.json in the current directory"
  )
  .action(async () => {
    try {
      await runValidate();
    } catch (err) {
      console.error(
        "Error:",
        err instanceof Error ? err.message : String(err)
      );
      process.exitCode = 1;
    }
  });

program
  .command("list-modules")
  .description("List all available QA testing modules")
  .action(async () => {
    try {
      await runListModules();
    } catch (err) {
      console.error(
        "Error:",
        err instanceof Error ? err.message : String(err)
      );
      process.exitCode = 1;
    }
  });

program.parse();
