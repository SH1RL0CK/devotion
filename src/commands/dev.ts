import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import {
    DEFAULT_UNKNOWN,
    DEFAULT_UNKNOWN_ERROR,
    MSG_CHECKING_BRANCHES,
    MSG_FAILED_READ_CONFIG,
    MSG_GLOBAL_CONFIG_NOT_FOUND,
    MSG_LOADING_TICKETS,
    MSG_NOT_GIT_REPOSITORY,
    MSG_NO_EXISTING_BRANCH,
    MSG_NO_TICKETS_FOUND,
    MSG_PROJECT_NOT_INITIALIZED,
    MSG_PULLING_CHANGES,
    MSG_PUSHING_BRANCH,
    MSG_READY_TO_DEVELOP,
    MSG_TICKET_NO_ID,
    MSG_UPDATING_TICKET_STATUS,
    TICKET_STATUS_IN_PROGRESS,
    VALIDATION_DESCRIPTION_EMPTY,
} from "../constants.js";
import { NotionTicket } from "../models/notion.js";
import { GitService } from "../services/git.service.js";
import { GlobalConfigService } from "../services/global-config.service.js";
import { LocalConfigService } from "../services/local-config.service.js";
import { NotionService } from "../services/notion.service.js";
import { buildBranchPrefix, sanitizeDescription } from "../utils.js";

const localConfigService = new LocalConfigService();
const globalConfigService = new GlobalConfigService();

async function promptForTicketSelection(
    tickets: NotionTicket[]
): Promise<string> {
    const choices = tickets.map((ticket) => ({
        name: `${ticket.ticketId || DEFAULT_UNKNOWN} - ${ticket.title} (${
            ticket.status
        })`,
        value: ticket.id,
    }));

    const answer = await inquirer.prompt([
        {
            type: "list" as const,
            name: "ticketId" as const,
            message: "Select a ticket to work on:",
            choices,
        },
    ]);

    return answer.ticketId;
}

async function promptForBranchDescription(
    branchPrefix: string,
    suggestedDescription: string
): Promise<string> {
    console.log(chalk.blue(`ℹ️  Branch will be: ${branchPrefix}<description>`));

    const answer = await inquirer.prompt([
        {
            type: "input" as const,
            name: "description" as const,
            message: "Branch description:",
            default: suggestedDescription,
            validate: (input: string) => {
                if (!input.trim()) {
                    return VALIDATION_DESCRIPTION_EMPTY;
                }
                return true;
            },
        },
    ]);

    return sanitizeDescription(answer.description);
}

async function devMain(): Promise<void> {
    // Check if project is initialized
    const configExists = await localConfigService.exists();
    if (!configExists) {
        console.log(chalk.red(MSG_PROJECT_NOT_INITIALIZED));
        return;
    }

    const localConfig = await localConfigService.read();
    if (!localConfig) {
        console.log(chalk.red(MSG_FAILED_READ_CONFIG));
        return;
    }

    // Check if we're in a git repository
    const gitService = new GitService();
    const isGitRepo = await gitService.isGitRepository();
    if (!isGitRepo) {
        console.log(chalk.red(MSG_NOT_GIT_REPOSITORY));
        return;
    }

    // Get global config for Notion API
    const globalConfig = await globalConfigService.read();
    if (!globalConfig) {
        console.log(chalk.red(MSG_GLOBAL_CONFIG_NOT_FOUND));
        return;
    }

    console.log(chalk.blue(MSG_LOADING_TICKETS));

    try {
        const notionService = new NotionService(globalConfig.notionApiKey);

        // Fetch tickets that are in Backlog or In Progress
        const tickets = await notionService.getTicketsForDev(
            localConfig.ticketsDatabaseId
        );

        if (tickets.length === 0) {
            console.log(chalk.yellow(MSG_NO_TICKETS_FOUND));
            return;
        }

        // Let user select a ticket
        const selectedTicketId = await promptForTicketSelection(tickets);
        const selectedTicket = tickets.find((t) => t.id === selectedTicketId)!;

        if (!selectedTicket.ticketId) {
            console.log(chalk.red(MSG_TICKET_NO_ID));
            return;
        }

        console.log(
            chalk.blue(
                `ℹ️  Working on ticket ${selectedTicket.ticketId}: ${selectedTicket.title}`
            )
        );

        // Check if a branch already exists for this ticket
        console.log(chalk.blue(MSG_CHECKING_BRANCHES));
        const existingBranch = await gitService.findBranchWithTicketId(
            selectedTicket.ticketId
        );

        if (existingBranch) {
            // Switch to existing branch and pull latest changes
            console.log(
                chalk.blue(`ℹ️  Found existing branch: ${existingBranch}`)
            );
            await gitService.switchToBranch(existingBranch);
            console.log(chalk.blue(MSG_PULLING_CHANGES));
            await gitService.pullLatestChanges();
            console.log(
                chalk.green(`✅ Switched to existing branch ${existingBranch}`)
            );
        } else {
            // Create new branch
            console.log(chalk.blue(MSG_NO_EXISTING_BRANCH));

            // Generate branch prefix and suggested description
            const branchPrefix = buildBranchPrefix(
                selectedTicket.type,
                selectedTicket.ticketId
            );

            // Extract suggested description from title
            const suggestedDescription = selectedTicket.title
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, "")
                .replace(/\s+/g, "_")
                .substring(0, 30);

            // Let user edit only the description part
            const description = await promptForBranchDescription(
                branchPrefix,
                suggestedDescription
            );
            const branchName = `${branchPrefix}${description}`;

            console.log(chalk.blue(`ℹ️  Creating branch: ${branchName}`));
            console.log(
                chalk.blue(
                    `ℹ️  Switching to development branch: ${localConfig.developmentBranch}`
                )
            );

            // Create and switch to new branch from development branch
            await gitService.createAndSwitchToBranch(
                branchName,
                localConfig.developmentBranch
            );

            console.log(chalk.blue(MSG_PUSHING_BRANCH));
            await gitService.pushBranchToRemote(branchName);

            console.log(
                chalk.green(
                    `✅ Created and switched to new branch ${branchName}`
                )
            );
        }

        // Update ticket status to "In progress" if it's not already
        if (selectedTicket.status !== TICKET_STATUS_IN_PROGRESS) {
            console.log(chalk.blue(MSG_UPDATING_TICKET_STATUS));
            await notionService.updateTicketStatus(
                selectedTicket.id,
                TICKET_STATUS_IN_PROGRESS
            );
            console.log(
                chalk.blue(
                    `ℹ️  Ticket ${selectedTicket.ticketId} is now ${TICKET_STATUS_IN_PROGRESS}`
                )
            );
        } else {
            console.log(
                chalk.blue(
                    `ℹ️  Ticket ${selectedTicket.ticketId} is already ${TICKET_STATUS_IN_PROGRESS}`
                )
            );
        }

        console.log(chalk.green(MSG_READY_TO_DEVELOP));
    } catch (error) {
        console.log(
            chalk.red(
                `❌ Failed to start development: ${
                    error instanceof Error
                        ? error.message
                        : DEFAULT_UNKNOWN_ERROR
                }`
            )
        );
        process.exit(1);
    }
}

export function registerDevCommand(program: Command): void {
    program
        .command("dev")
        .description("Start or resume work on a ticket")
        .action(devMain);
}
