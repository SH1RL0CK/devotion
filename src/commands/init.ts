import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import {
    DEFAULT_DEVELOPMENT_BRANCH,
    DEFAULT_UNKNOWN_ERROR,
    MSG_ANALYZING_TICKETS_DB,
    MSG_CURRENT_PROJECT_CONFIG,
    MSG_EDIT_PROJECT_CONFIG,
    MSG_FAILED_READ_GLOBAL_CONFIG,
    MSG_FAILED_READ_PROJECT_CONFIG,
    MSG_FAILED_UPDATE_CONFIG,
    MSG_FETCHING_PROJECTS,
    MSG_FINDING_TICKETS_DB,
    MSG_GLOBAL_CONFIG_NOT_FOUND,
    MSG_INITIALIZATION_FAILED,
    MSG_INITIALIZING_PROJECT,
    MSG_INIT_COMPLETE,
    MSG_INIT_EDIT_HELP,
    MSG_INIT_STATUS_HELP,
    MSG_LEAVE_BLANK_TO_KEEP,
    MSG_NO_IN_PROGRESS_PROJECTS,
    MSG_NO_PROJECT_CONFIG,
    MSG_NO_TICKETS_DB_FOUND,
    MSG_NO_UNIQUE_ID_PREFIX,
    MSG_PROJECT_ALREADY_INITIALIZED,
    MSG_PROJECT_CONFIG_UPDATED,
    PROMPT_DEVELOPMENT_BRANCH,
    PROMPT_SELECT_PROJECT,
} from "../constants.js";
import { LocalConfig } from "../models/config.js";
import { NotionProject } from "../models/notion.js";
import { GlobalConfigService } from "../services/global-config.service.js";
import { LocalConfigService } from "../services/local-config.service.js";
import { NotionService } from "../services/notion.service.js";

const localConfigService = new LocalConfigService();
const globalConfigService = new GlobalConfigService();

async function promptForProjectSelection(
    projects: NotionProject[]
): Promise<string> {
    const choices = projects.map((project) => ({
        name: project.title,
        value: project.id,
    }));

    const answer = await inquirer.prompt([
        {
            type: "list" as const,
            name: "projectId" as const,
            message: PROMPT_SELECT_PROJECT,
            choices,
        },
    ]);

    return answer.projectId;
}

async function promptForDevelopmentBranch(): Promise<string> {
    const answer = await inquirer.prompt([
        {
            type: "input" as const,
            name: "developmentBranch" as const,
            message: PROMPT_DEVELOPMENT_BRANCH,
            default: DEFAULT_DEVELOPMENT_BRANCH,
        },
    ]);

    return answer.developmentBranch;
}

async function initMain(): Promise<void> {
    const configExists = await localConfigService.exists();

    if (configExists) {
        console.log(chalk.blue(MSG_PROJECT_ALREADY_INITIALIZED));
        console.log(chalk.blue(MSG_INIT_STATUS_HELP));
        console.log(chalk.blue(MSG_INIT_EDIT_HELP));
        return;
    }

    // Check if global config exists
    const globalConfigExists = await globalConfigService.exists();
    if (!globalConfigExists) {
        console.log(chalk.red(MSG_GLOBAL_CONFIG_NOT_FOUND));
        return;
    }

    const globalConfig = await globalConfigService.read();
    if (!globalConfig) {
        console.log(chalk.red(MSG_FAILED_READ_GLOBAL_CONFIG));
        return;
    }

    console.log(chalk.blue(MSG_INITIALIZING_PROJECT));

    try {
        const notionService = new NotionService(globalConfig.notionApiKey);

        // Fetch in-progress projects
        console.log(chalk.blue(MSG_FETCHING_PROJECTS));
        const projects = await notionService.getInProgressProjects(
            globalConfig.notionProjectsDbId
        );

        if (projects.length === 0) {
            console.log(chalk.yellow(MSG_NO_IN_PROGRESS_PROJECTS));
            return;
        }

        // Let user select project
        const selectedProjectId = await promptForProjectSelection(projects);
        const selectedProject = projects.find(
            (p) => p.id === selectedProjectId
        )!;

        // Get tickets database ID from Development/Entwicklung relation
        console.log(chalk.blue(MSG_FINDING_TICKETS_DB));
        let ticketsDatabaseId = await notionService.getRelationDatabaseId(
            selectedProjectId,
            "Development"
        );

        if (!ticketsDatabaseId) {
            ticketsDatabaseId = await notionService.getRelationDatabaseId(
                selectedProjectId,
                "Entwicklung"
            );
        }

        if (!ticketsDatabaseId) {
            console.log(chalk.red(MSG_NO_TICKETS_DB_FOUND));
            return;
        }

        // Get ticket prefix from unique_id property
        console.log(chalk.blue(MSG_ANALYZING_TICKETS_DB));
        const ticketsDatabase = await notionService.getDatabaseSchema(
            ticketsDatabaseId
        );
        const ticketPrefix = notionService.findUniqueIdPrefix(ticketsDatabase);

        if (!ticketPrefix) {
            console.log(chalk.red(MSG_NO_UNIQUE_ID_PREFIX));
            return;
        }

        // Ask for development branch
        const developmentBranch = await promptForDevelopmentBranch();

        // Save configuration
        const localConfig: LocalConfig = {
            projectId: selectedProjectId,
            ticketsDatabaseId,
            ticketPrefix,
            developmentBranch,
        };

        await localConfigService.write(localConfig);
        console.log(chalk.green(MSG_INIT_COMPLETE));
        console.log(chalk.green(`   Project: ${selectedProject.title}`));
        console.log(chalk.green(`   Ticket prefix: ${ticketPrefix}`));
        console.log(chalk.green(`   Development branch: ${developmentBranch}`));
    } catch (error) {
        console.log(
            chalk.red(
                `${MSG_INITIALIZATION_FAILED}${
                    error instanceof Error
                        ? error.message
                        : DEFAULT_UNKNOWN_ERROR
                }`
            )
        );
        process.exit(1);
    }
}

async function initStatus(): Promise<void> {
    const configExists = await localConfigService.exists();

    if (!configExists) {
        console.log(chalk.red(MSG_NO_PROJECT_CONFIG));
        return;
    }

    const config = await localConfigService.read();
    if (!config) {
        console.log(chalk.red(MSG_FAILED_READ_PROJECT_CONFIG));
        return;
    }

    console.log(chalk.blue(MSG_CURRENT_PROJECT_CONFIG));
    console.log(`   Project ID: ${config.projectId}`);
    console.log(`   Tickets Database ID: ${config.ticketsDatabaseId}`);
    console.log(`   Ticket Prefix: ${config.ticketPrefix}`);
    console.log(`   Development Branch: ${config.developmentBranch}`);
}

async function initEdit(): Promise<void> {
    const configExists = await localConfigService.exists();

    if (!configExists) {
        console.log(chalk.red(MSG_NO_PROJECT_CONFIG));
        return;
    }

    const currentConfig = await localConfigService.read();
    if (!currentConfig) {
        console.log(chalk.red(MSG_FAILED_READ_PROJECT_CONFIG));
        return;
    }

    console.log(chalk.blue(MSG_EDIT_PROJECT_CONFIG));
    console.log(chalk.blue(MSG_LEAVE_BLANK_TO_KEEP));

    const questions = [
        {
            type: "input" as const,
            name: "ticketPrefix" as const,
            message: `Ticket prefix (current: ${currentConfig.ticketPrefix}):`,
        },
        {
            type: "input" as const,
            name: "developmentBranch" as const,
            message: `Development branch (current: ${currentConfig.developmentBranch}):`,
        },
    ];

    try {
        const answers = await inquirer.prompt(questions);

        // Merge with current config, keeping current values for empty inputs
        const updatedConfig: LocalConfig = {
            projectId: currentConfig.projectId, // Cannot be changed
            ticketsDatabaseId: currentConfig.ticketsDatabaseId, // Cannot be changed
            ticketPrefix: answers.ticketPrefix || currentConfig.ticketPrefix,
            developmentBranch:
                answers.developmentBranch || currentConfig.developmentBranch,
        };

        await localConfigService.write(updatedConfig);
        console.log(chalk.green(MSG_PROJECT_CONFIG_UPDATED));
    } catch (error) {
        console.log(
            chalk.red(
                `${MSG_FAILED_UPDATE_CONFIG}${
                    error instanceof Error
                        ? error.message
                        : DEFAULT_UNKNOWN_ERROR
                }`
            )
        );
        process.exit(1);
    }
}

export function registerInitCommand(program: Command): void {
    const initCommand = program
        .command("init")
        .description(
            "Initialize project-specific settings for the current repository"
        )
        .action(initMain);

    initCommand
        .command("status")
        .description("Show current project configuration")
        .action(initStatus);

    initCommand
        .command("edit")
        .description("Edit existing project configuration values")
        .action(initEdit);
}
