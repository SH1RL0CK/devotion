import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import { DEFAULT_DEVELOPMENT_BRANCH } from "../constants.js";
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
            message: "Select a project:",
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
            message: "Development branch name:",
            default: DEFAULT_DEVELOPMENT_BRANCH,
        },
    ]);

    return answer.developmentBranch;
}

async function initMain(): Promise<void> {
    const configExists = await localConfigService.exists();

    if (configExists) {
        console.log(chalk.blue("ℹ️  Project is already initialized!"));
        console.log(
            chalk.blue(
                "   Use 'devotion init status' to view current configuration"
            )
        );
        console.log(
            chalk.blue("   Use 'devotion init edit' to modify configuration")
        );
        return;
    }

    // Check if global config exists
    const globalConfigExists = await globalConfigService.exists();
    if (!globalConfigExists) {
        console.log(
            chalk.red(
                "❌ Global configuration not found. Run 'devotion setup' first."
            )
        );
        return;
    }

    const globalConfig = await globalConfigService.read();
    if (!globalConfig) {
        console.log(chalk.red("❌ Failed to read global configuration."));
        return;
    }

    console.log(chalk.blue("ℹ️  Initializing project configuration..."));

    try {
        const notionService = new NotionService(globalConfig.notionApiKey);

        // Fetch in-progress projects
        console.log(chalk.blue("   Fetching projects from Notion..."));
        const projects = await notionService.getInProgressProjects(
            globalConfig.notionProjectsDbId
        );

        if (projects.length === 0) {
            console.log(
                chalk.yellow(
                    "⚠️  No projects with status '🏗 In progress' found."
                )
            );
            return;
        }

        // Let user select project
        const selectedProjectId = await promptForProjectSelection(projects);
        const selectedProject = projects.find(
            (p) => p.id === selectedProjectId
        )!;

        // Get tickets database ID from Development/Entwicklung relation
        console.log(chalk.blue("   Finding tickets database..."));
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
            console.log(
                chalk.red(
                    "❌ Could not find tickets database in Development or Entwicklung relation."
                )
            );
            return;
        }

        // Get ticket prefix from unique_id property
        console.log(chalk.blue("   Analyzing tickets database schema..."));
        const ticketsDatabase = await notionService.getDatabaseSchema(
            ticketsDatabaseId
        );
        const ticketPrefix = notionService.findUniqueIdPrefix(ticketsDatabase);

        if (!ticketPrefix) {
            console.log(
                chalk.red(
                    "❌ Could not find unique_id property with prefix in tickets database."
                )
            );
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
        console.log(chalk.green("✅ Project initialization complete!"));
        console.log(chalk.green(`   Project: ${selectedProject.title}`));
        console.log(chalk.green(`   Ticket prefix: ${ticketPrefix}`));
        console.log(chalk.green(`   Development branch: ${developmentBranch}`));
    } catch (error) {
        console.log(
            chalk.red(
                `❌ Initialization failed: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            )
        );
        process.exit(1);
    }
}

async function initStatus(): Promise<void> {
    const configExists = await localConfigService.exists();

    if (!configExists) {
        console.log(
            chalk.red(
                "❌ No project configuration found. Run 'devotion init' first."
            )
        );
        return;
    }

    const config = await localConfigService.read();
    if (!config) {
        console.log(chalk.red("❌ Failed to read project configuration file."));
        return;
    }

    console.log(chalk.blue("ℹ️  Current project configuration:"));
    console.log(`   Project ID: ${config.projectId}`);
    console.log(`   Tickets Database ID: ${config.ticketsDatabaseId}`);
    console.log(`   Ticket Prefix: ${config.ticketPrefix}`);
    console.log(`   Development Branch: ${config.developmentBranch}`);
}

async function initEdit(): Promise<void> {
    const configExists = await localConfigService.exists();

    if (!configExists) {
        console.log(
            chalk.red(
                "❌ No project configuration found. Run 'devotion init' first."
            )
        );
        return;
    }

    const currentConfig = await localConfigService.read();
    if (!currentConfig) {
        console.log(chalk.red("❌ Failed to read project configuration file."));
        return;
    }

    console.log(chalk.blue("ℹ️  Edit project configuration"));
    console.log(chalk.blue("   Leave blank to keep current value:\n"));

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
        console.log(
            chalk.green("✅ Project configuration updated successfully!")
        );
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
