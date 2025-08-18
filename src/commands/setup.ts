import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import { GlobalConfig } from "../models/config.js";
import { GlobalConfigService } from "../services/global-config.service.js";

const globalConfigService = new GlobalConfigService();

async function promptForConfig(): Promise<GlobalConfig> {
    const questions = [
        {
            type: "input" as const,
            name: "notionApiKey" as const,
            message:
                "Enter your Notion API key (must start with ntn_ followed by alphanumeric characters):",
            validate: (value: string) => {
                if (!globalConfigService.validateNotionApiKey(value)) {
                    return 'Invalid Notion API key. Must start with "ntn_" followed by alphanumeric characters.';
                }
                return true;
            },
        },
        {
            type: "input" as const,
            name: "githubApiKey" as const,
            message: "Enter your GitHub API key (must start with ghp_):",
            validate: (value: string) => {
                if (!globalConfigService.validateGithubApiKey(value)) {
                    return 'Invalid GitHub API key. Must start with "ghp_".';
                }
                return true;
            },
        },
        {
            type: "input" as const,
            name: "notionProjectsDbId" as const,
            message:
                "Enter your Notion projects database ID (32 hexadecimal characters):",
            validate: (value: string) => {
                if (!globalConfigService.validateNotionDatabaseId(value)) {
                    return "Invalid database ID. Must be exactly 32 hexadecimal characters.";
                }
                return true;
            },
        },
    ];

    const answers = await inquirer.prompt(questions);
    return answers as GlobalConfig;
}

async function setupMain(): Promise<void> {
    const configExists = await globalConfigService.exists();

    if (configExists) {
        console.log(chalk.blue("ℹ️  Setup is already complete!"));
        console.log(
            chalk.blue(
                "   Use 'devotion setup status' to view current configuration"
            )
        );
        console.log(
            chalk.blue("   Use 'devotion setup edit' to modify configuration")
        );
        return;
    }

    console.log(chalk.blue("ℹ️  Welcome to Devotion CLI setup!"));
    console.log(
        chalk.blue("   Please provide the following configuration values:\n")
    );

    try {
        const config = await promptForConfig();
        await globalConfigService.write(config);
        console.log(
            chalk.green("✅ Setup complete! Configuration saved successfully.")
        );
    } catch (error) {
        console.log(
            chalk.red(
                `❌ Setup failed: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            )
        );
        process.exit(1);
    }
}

async function setupStatus(): Promise<void> {
    const configExists = await globalConfigService.exists();

    if (!configExists) {
        console.log(
            chalk.red("❌ No configuration found. Run 'devotion setup' first.")
        );
        return;
    }

    const config = await globalConfigService.read();
    if (!config) {
        console.log(chalk.red("❌ Failed to read configuration file."));
        return;
    }

    const maskedConfig = globalConfigService.maskConfig(config);

    console.log(chalk.blue("ℹ️  Current Devotion CLI configuration:"));
    console.log(`   Notion API Key: ${maskedConfig.notionApiKey}`);
    console.log(`   GitHub API Key: ${maskedConfig.githubApiKey}`);
    console.log(`   Notion Projects DB ID: ${maskedConfig.notionProjectsDbId}`);
}

async function setupEdit(): Promise<void> {
    const configExists = await globalConfigService.exists();

    if (!configExists) {
        console.log(
            chalk.red("❌ No configuration found. Run 'devotion setup' first.")
        );
        return;
    }

    const currentConfig = await globalConfigService.read();
    if (!currentConfig) {
        console.log(chalk.red("❌ Failed to read configuration file."));
        return;
    }

    console.log(chalk.blue("ℹ️  Edit Devotion CLI configuration"));
    console.log(chalk.blue("   Leave blank to keep current value:\n"));

    const questions = [
        {
            type: "input" as const,
            name: "notionApiKey" as const,
            message: "Notion API key (current: ****):",
            validate: (value: string) => {
                if (value === "") return true; // Allow empty to keep current
                if (!globalConfigService.validateNotionApiKey(value)) {
                    return 'Invalid Notion API key. Must start with "ntn_" followed by alphanumeric characters.';
                }
                return true;
            },
        },
        {
            type: "input" as const,
            name: "githubApiKey" as const,
            message: "GitHub API key (current: ****):",
            validate: (value: string) => {
                if (value === "") return true; // Allow empty to keep current
                if (!globalConfigService.validateGithubApiKey(value)) {
                    return 'Invalid GitHub API key. Must start with "ghp_".';
                }
                return true;
            },
        },
        {
            type: "input" as const,
            name: "notionProjectsDbId" as const,
            message: `Notion projects database ID (current: ${currentConfig.notionProjectsDbId}):`,
            validate: (value: string) => {
                if (value === "") return true; // Allow empty to keep current
                if (!globalConfigService.validateNotionDatabaseId(value)) {
                    return "Invalid database ID. Must be exactly 32 hexadecimal characters.";
                }
                return true;
            },
        },
    ];

    try {
        const answers = await inquirer.prompt(questions);

        // Merge with current config, keeping current values for empty inputs
        const updatedConfig: GlobalConfig = {
            notionApiKey: answers.notionApiKey || currentConfig.notionApiKey,
            githubApiKey: answers.githubApiKey || currentConfig.githubApiKey,
            notionProjectsDbId:
                answers.notionProjectsDbId || currentConfig.notionProjectsDbId,
        };

        await globalConfigService.write(updatedConfig);
        console.log(chalk.green("✅ Configuration updated successfully!"));
    } catch (error) {
        console.log(
            chalk.red(
                `❌ Failed to update configuration: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            )
        );
        process.exit(1);
    }
}

export function registerSetupCommand(program: Command): void {
    const setupCommand = program
        .command("setup")
        .description("Configure global settings for Devotion CLI")
        .action(setupMain);

    setupCommand
        .command("status")
        .description("Show current configuration (with masked API keys)")
        .action(setupStatus);

    setupCommand
        .command("edit")
        .description("Edit existing configuration values")
        .action(setupEdit);
}
