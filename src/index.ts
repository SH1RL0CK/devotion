#!/usr/bin/env node

import { Command } from "commander";
import { registerDevCommand } from "./commands/dev.js";
import { registerInitCommand } from "./commands/init.js";
import { registerPrCommand } from "./commands/pr.js";
import { registerSetupCommand } from "./commands/setup.js";

const program = new Command();

program
    .name("devotion")
    .description(
        "CLI tool connecting Notion, GitHub, and local Git projects to manage project workflows"
    )
    .version("1.0.0");

// Register commands
registerSetupCommand(program);
registerInitCommand(program);
registerDevCommand(program);
registerPrCommand(program);

program.parse();
