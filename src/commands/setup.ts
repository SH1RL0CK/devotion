import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import {
    DEFAULT_UNKNOWN_ERROR,
    MSG_CURRENT_CLI_CONFIG,
    MSG_EDIT_CLI_CONFIG,
    MSG_FAILED_READ_SETUP_CONFIG,
    MSG_FAILED_UPDATE_SETUP_CONFIG,
    MSG_LEAVE_BLANK_TO_KEEP,
    MSG_NO_SETUP_CONFIG,
    MSG_PROVIDE_CONFIG_VALUES,
    MSG_SETUP_ALREADY_COMPLETE,
    MSG_SETUP_COMPLETE,
    MSG_SETUP_CONFIG_UPDATED,
    MSG_SETUP_EDIT_HELP,
    MSG_SETUP_FAILED,
    MSG_SETUP_STATUS_HELP,
    MSG_WELCOME_TO_SETUP,
    PROMPT_GITHUB_API_KEY,
    PROMPT_GITHUB_API_KEY_EDIT,
    PROMPT_NOTION_API_KEY,
    PROMPT_NOTION_API_KEY_EDIT,
    PROMPT_NOTION_DB_ID,
    VALIDATION_DATABASE_ID,
    VALIDATION_GITHUB_API_KEY,
    VALIDATION_NOTION_API_KEY,
} from "../constants.js";
import { GlobalConfig } from "../models/config.js";
import { GlobalConfigService } from "../services/global-config.service.js";

const globalConfigService = new GlobalConfigService();

async function promptForConfig(): Promise<GlobalConfig> {
    const questions = [
        {
            type: "password" as const,
            name: "notionApiKey" as const,
            message: PROMPT_NOTION_API_KEY,
            mask: "*",
            validate: (value: string) => {
                if (!globalConfigService.validateNotionApiKey(value)) {
                    return VALIDATION_NOTION_API_KEY;
                }
                return true;
            },
        },
        {
            type: "password" as const,
            name: "githubApiKey" as const,
            message: PROMPT_GITHUB_API_KEY,
            mask: "*",
            validate: (value: string) => {
                if (!globalConfigService.validateGithubApiKey(value)) {
                    return VALIDATION_GITHUB_API_KEY;
                }
                return true;
            },
        },
        {
            type: "input" as const,
            name: "notionProjectsDbId" as const,
            message: PROMPT_NOTION_DB_ID,
            validate: (value: string) => {
                if (!globalConfigService.validateNotionDatabaseId(value)) {
                    return VALIDATION_DATABASE_ID;
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
        console.log(chalk.blue(MSG_SETUP_ALREADY_COMPLETE));
        console.log(chalk.blue(MSG_SETUP_STATUS_HELP));
        console.log(chalk.blue(MSG_SETUP_EDIT_HELP));
        return;
    }

    console.log(chalk.blue(MSG_WELCOME_TO_SETUP));
    console.log(chalk.blue(MSG_PROVIDE_CONFIG_VALUES));

    try {
        const config = await promptForConfig();
        await globalConfigService.write(config);
        console.log(chalk.green(MSG_SETUP_COMPLETE));
    } catch (error) {
        console.log(
            chalk.red(
                `${MSG_SETUP_FAILED}${
                    error instanceof Error
                        ? error.message
                        : DEFAULT_UNKNOWN_ERROR
                }`
            )
        );
        process.exit(1);
    }
}

async function setupStatus(): Promise<void> {
    const configExists = await globalConfigService.exists();

    if (!configExists) {
        console.log(chalk.red(MSG_NO_SETUP_CONFIG));
        return;
    }

    const config = await globalConfigService.read();
    if (!config) {
        console.log(chalk.red(MSG_FAILED_READ_SETUP_CONFIG));
        return;
    }

    const maskedConfig = globalConfigService.maskConfig(config);

    console.log(chalk.blue(MSG_CURRENT_CLI_CONFIG));
    console.log(`   Notion API Key: ${maskedConfig.notionApiKey}`);
    console.log(`   GitHub API Key: ${maskedConfig.githubApiKey}`);
    console.log(`   Notion Projects DB ID: ${maskedConfig.notionProjectsDbId}`);
}

async function setupEdit(): Promise<void> {
    const configExists = await globalConfigService.exists();

    if (!configExists) {
        console.log(chalk.red(MSG_NO_SETUP_CONFIG));
        return;
    }

    const currentConfig = await globalConfigService.read();
    if (!currentConfig) {
        console.log(chalk.red(MSG_FAILED_READ_SETUP_CONFIG));
        return;
    }

    console.log(chalk.blue(MSG_EDIT_CLI_CONFIG));
    console.log(chalk.blue(MSG_LEAVE_BLANK_TO_KEEP));

    const questions = [
        {
            type: "password" as const,
            name: "notionApiKey" as const,
            message: PROMPT_NOTION_API_KEY_EDIT,
            mask: "*",
            validate: (value: string) => {
                if (value === "") return true; // Allow empty to keep current
                if (!globalConfigService.validateNotionApiKey(value)) {
                    return VALIDATION_NOTION_API_KEY;
                }
                return true;
            },
        },
        {
            type: "password" as const,
            name: "githubApiKey" as const,
            message: PROMPT_GITHUB_API_KEY_EDIT,
            mask: "*",
            validate: (value: string) => {
                if (value === "") return true; // Allow empty to keep current
                if (!globalConfigService.validateGithubApiKey(value)) {
                    return VALIDATION_GITHUB_API_KEY;
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
                    return VALIDATION_DATABASE_ID;
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
        console.log(chalk.green(MSG_SETUP_CONFIG_UPDATED));
    } catch (error) {
        console.log(
            chalk.red(
                `${MSG_FAILED_UPDATE_SETUP_CONFIG}${
                    error instanceof Error
                        ? error.message
                        : DEFAULT_UNKNOWN_ERROR
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
