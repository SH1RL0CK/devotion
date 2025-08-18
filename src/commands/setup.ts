import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import {
    DEFAULT_UNKNOWN_ERROR,
    MSG_CURRENT_CLI_CONFIG,
    MSG_EDIT_CLI_CONFIG,
    MSG_FAILED_READ_SETUP_CONFIG,
    MSG_FAILED_UPDATE_SETUP_CONFIG,
    MSG_FETCHING_USERS,
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
    PROMPT_SELECT_USER,
    PROMPT_USER_ID,
    PROMPT_USER_ID_EDIT,
    VALIDATION_DATABASE_ID,
    VALIDATION_GITHUB_API_KEY,
    VALIDATION_NOTION_API_KEY,
    VALIDATION_USER_ID,
} from "../constants.js";
import { GlobalConfig } from "../models/config.js";
import { GlobalConfigService } from "../services/global-config.service.js";
import { NotionService } from "../services/notion.service.js";

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

    const basicAnswers = await inquirer.prompt(questions);

    // Now fetch users using the Notion API key
    console.log(chalk.blue(MSG_FETCHING_USERS));
    try {
        const notionService = new NotionService(basicAnswers.notionApiKey);
        const users = await notionService.getUsers();

        if (users.length === 0) {
            throw new Error("No users found in your Notion workspace");
        }

        const userChoices = users.map((user) => ({
            name: `${user.name}${user.email ? ` (${user.email})` : ""}`,
            value: user.id,
        }));

        const userSelection = await inquirer.prompt([
            {
                type: "list" as const,
                name: "userId" as const,
                message: PROMPT_SELECT_USER,
                choices: userChoices,
            },
        ]);

        return {
            ...basicAnswers,
            userId: userSelection.userId,
        } as GlobalConfig;
    } catch (error) {
        console.log(
            chalk.red(
                `❌ Failed to fetch users: ${
                    error instanceof Error
                        ? error.message
                        : DEFAULT_UNKNOWN_ERROR
                }`
            )
        );

        // Fallback to manual input
        console.log(chalk.yellow("Falling back to manual user ID input..."));
        const userIdQuestion = await inquirer.prompt([
            {
                type: "input" as const,
                name: "userId" as const,
                message: PROMPT_USER_ID,
                validate: (value: string) => {
                    if (!globalConfigService.validateUserId(value)) {
                        return VALIDATION_USER_ID;
                    }
                    return true;
                },
            },
        ]);

        return {
            ...basicAnswers,
            userId: userIdQuestion.userId,
        } as GlobalConfig;
    }
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

    // Try to get user name from Notion API
    try {
        const notionService = new NotionService(config.notionApiKey);
        const users = await notionService.getUsers();
        const currentUser = users.find((user) => user.id === config.userId);

        if (currentUser) {
            console.log(
                `   User: ${currentUser.name}${
                    currentUser.email ? ` (${currentUser.email})` : ""
                }`
            );
        } else {
            console.log(`   User ID: ${maskedConfig.userId}`);
        }
    } catch {
        console.log(`   User ID: ${maskedConfig.userId}`);
    }
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
        {
            type: "confirm" as const,
            name: "changeUser" as const,
            message: "Do you want to change the assigned user?",
            default: false,
        },
    ];

    try {
        const answers = await inquirer.prompt(questions);

        let selectedUserId = currentConfig.userId;

        if (answers.changeUser) {
            // Use the current or updated Notion API key to fetch users
            const notionApiKey =
                answers.notionApiKey || currentConfig.notionApiKey;

            console.log(chalk.blue(MSG_FETCHING_USERS));
            try {
                const notionService = new NotionService(notionApiKey);
                const users = await notionService.getUsers();

                if (users.length === 0) {
                    throw new Error("No users found in your Notion workspace");
                }

                const userChoices = users.map((user) => ({
                    name: `${user.name}${user.email ? ` (${user.email})` : ""}`,
                    value: user.id,
                }));

                const userSelection = await inquirer.prompt([
                    {
                        type: "list" as const,
                        name: "userId" as const,
                        message: PROMPT_SELECT_USER,
                        choices: userChoices,
                    },
                ]);

                selectedUserId = userSelection.userId;
            } catch (error) {
                console.log(
                    chalk.red(
                        `❌ Failed to fetch users: ${
                            error instanceof Error
                                ? error.message
                                : DEFAULT_UNKNOWN_ERROR
                        }`
                    )
                );

                // Fallback to manual input
                console.log(
                    chalk.yellow("Falling back to manual user ID input...")
                );
                const userIdQuestion = await inquirer.prompt([
                    {
                        type: "input" as const,
                        name: "userId" as const,
                        message: PROMPT_USER_ID_EDIT.replace(
                            "{current}",
                            currentConfig.userId
                        ),
                        validate: (value: string) => {
                            if (value === "") return true; // Allow empty to keep current
                            if (!globalConfigService.validateUserId(value)) {
                                return VALIDATION_USER_ID;
                            }
                            return true;
                        },
                    },
                ]);

                selectedUserId = userIdQuestion.userId || currentConfig.userId;
            }
        }

        // Merge with current config, keeping current values for empty inputs
        const updatedConfig: GlobalConfig = {
            notionApiKey: answers.notionApiKey || currentConfig.notionApiKey,
            githubApiKey: answers.githubApiKey || currentConfig.githubApiKey,
            notionProjectsDbId:
                answers.notionProjectsDbId || currentConfig.notionProjectsDbId,
            userId: selectedUserId,
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
