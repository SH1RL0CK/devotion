import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import {
    DEFAULT_UNKNOWN_ERROR,
    MSG_ADDING_LABEL,
    MSG_COULD_NOT_DETERMINE_BRANCH,
    MSG_COULD_NOT_DETERMINE_REPO,
    MSG_COULD_NOT_EXTRACT_TICKET_ID,
    MSG_COULD_NOT_FIND_TICKET,
    MSG_COULD_NOT_OPEN_PR,
    MSG_CREATING_LABEL,
    MSG_CREATING_PR,
    MSG_CURRENT_BRANCH,
    MSG_EXTRACTED_TICKET_ID,
    MSG_FAILED_READ_CONFIG,
    MSG_FOUND_TICKET,
    MSG_GLOBAL_CONFIG_NOT_FOUND,
    MSG_LABEL_ADDED,
    MSG_NOT_GIT_REPOSITORY,
    MSG_OPENED_PR,
    MSG_PR_ALREADY_EXISTS,
    MSG_PR_URL,
    MSG_PROJECT_NOT_INITIALIZED,
    MSG_PUSHING_CURRENT_BRANCH,
    MSG_REPOSITORY_INFO,
    MSG_TICKET_SET_TO_IN_REVIEW,
    MSG_UPDATING_TICKET_STATUS,
    MSG_UPDATING_TO_IN_REVIEW,
    NOTION_PROPERTY_TYPE,
    TICKET_STATUS_IN_REVIEW,
} from "../constants.js";
import { GitService } from "../services/git.service.js";
import { GitHubService } from "../services/github.service.js";
import { GlobalConfigService } from "../services/global-config.service.js";
import { LocalConfigService } from "../services/local-config.service.js";
import { NotionService } from "../services/notion.service.js";
import { extractTicketIdFromBranchName } from "../utils.js";

const localConfigService = new LocalConfigService();
const globalConfigService = new GlobalConfigService();

async function promptForPrDescription(
    defaultDescription: string = ""
): Promise<string> {
    const answer = await inquirer.prompt([
        {
            type: "input" as const,
            name: "description" as const,
            message: "PR description:",
            default: defaultDescription,
        },
    ]);

    return answer.description;
}

async function mrMain(): Promise<void> {
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

    // Get global config for API keys
    const globalConfig = await globalConfigService.read();
    if (!globalConfig) {
        console.log(chalk.red(MSG_GLOBAL_CONFIG_NOT_FOUND));
        return;
    }

    try {
        // Get current branch
        const currentBranch = await gitService.getCurrentBranch();
        if (!currentBranch) {
            console.log(chalk.red(MSG_COULD_NOT_DETERMINE_BRANCH));
            return;
        }

        console.log(chalk.blue(`${MSG_CURRENT_BRANCH}${currentBranch}`));

        // Extract ticket ID from branch name
        const ticketId = extractTicketIdFromBranchName(currentBranch);
        if (!ticketId) {
            console.log(chalk.red(MSG_COULD_NOT_EXTRACT_TICKET_ID));
            return;
        }

        console.log(chalk.blue(`${MSG_EXTRACTED_TICKET_ID}${ticketId}`));

        // Find ticket in Notion
        const notionService = new NotionService(globalConfig.notionApiKey);
        const ticket = await notionService.findTicketByTicketId(
            localConfig.ticketsDatabaseId,
            ticketId
        );

        if (!ticket) {
            console.log(chalk.red(`${MSG_COULD_NOT_FIND_TICKET}${ticketId}`));
            return;
        }

        console.log(chalk.blue(`${MSG_FOUND_TICKET}${ticket.title}`));

        // Push current branch to remote
        console.log(chalk.blue(MSG_PUSHING_CURRENT_BRANCH));
        await gitService.pushCurrentBranch();

        // Create GitHub service and get repository info
        const githubService = new GitHubService(globalConfig.githubApiKey);
        const repoInfo = await githubService.getRepositoryInfo();

        if (!repoInfo) {
            console.log(chalk.red(MSG_COULD_NOT_DETERMINE_REPO));
            return;
        }

        console.log(
            chalk.blue(
                `${MSG_REPOSITORY_INFO}${repoInfo.owner}/${repoInfo.repo}`
            )
        );

        // Get authenticated user for assignee
        const authenticatedUser = await githubService.getAuthenticatedUser();

        // Check if PR already exists
        const existingPR = await githubService.checkIfPullRequestExists(
            repoInfo.owner,
            repoInfo.repo,
            currentBranch,
            localConfig.developmentBranch
        );

        if (existingPR) {
            console.log(
                chalk.yellow(`${MSG_PR_ALREADY_EXISTS}${existingPR.url}`)
            );
            console.log(chalk.blue(MSG_UPDATING_TO_IN_REVIEW));

            // Update ticket status to "In review" if not already
            if (ticket.status !== TICKET_STATUS_IN_REVIEW) {
                await notionService.updateTicketStatus(
                    ticket.id,
                    TICKET_STATUS_IN_REVIEW
                );
                console.log(
                    chalk.blue(
                        MSG_TICKET_SET_TO_IN_REVIEW.replace(
                            "${ticketId}",
                            ticketId
                        )
                    )
                );
            }
            return;
        }

        // Ask for PR description
        const description = await promptForPrDescription(ticket.title);

        // Prepare PR data
        const prTitle = description
            ? `${ticketId}: ${description}`
            : `${ticketId}: ${ticket.title}`;

        // Create Notion link for PR body
        const notionTicketUrl = `https://notion.so/${ticket.id.replace(
            /-/g,
            ""
        )}`;
        const prBody = `[${ticketId}: ${ticket.title}](${notionTicketUrl})`;

        // Create Pull Request
        console.log(chalk.blue(MSG_CREATING_PR));
        const pullRequest = await githubService.createPullRequest(
            repoInfo.owner,
            repoInfo.repo,
            {
                title: prTitle,
                body: prBody,
                head: currentBranch,
                base: localConfig.developmentBranch,
            }
        );

        console.log(chalk.green(`${MSG_OPENED_PR}${pullRequest.title}`));
        console.log(chalk.blue(`${MSG_PR_URL}${pullRequest.url}`));

        // Add ticket type as a label if available
        if (ticket.type) {
            console.log(chalk.blue(`${MSG_ADDING_LABEL}${ticket.type}`));

            // Get the database schema to find the color for this type
            let labelColor = "ededed"; // Default light gray color
            try {
                const databaseSchema = await notionService.getDatabaseSchema(
                    localConfig.ticketsDatabaseId
                );
                const typeColor = notionService.findSelectOptionColor(
                    databaseSchema,
                    NOTION_PROPERTY_TYPE,
                    ticket.type
                );

                if (typeColor) {
                    // Convert Notion color to GitHub color format
                    const { convertNotionColorToGitHub } = await import(
                        "../utils.js"
                    );
                    labelColor = convertNotionColorToGitHub(typeColor);
                }
            } catch (error) {
                // If there's an error getting the color, we'll use the default
                console.log(
                    chalk.yellow(
                        `Could not fetch color for type ${ticket.type}, using default`
                    )
                );
            }

            // Check if label already exists
            const labelCheck = await githubService.checkIfLabelExists(
                repoInfo.owner,
                repoInfo.repo,
                ticket.type
            );

            // Create label if it doesn't exist
            if (!labelCheck.exists) {
                console.log(chalk.blue(`${MSG_CREATING_LABEL}${ticket.type}`));
                await githubService.createLabel(
                    repoInfo.owner,
                    repoInfo.repo,
                    ticket.type,
                    labelColor
                );
            }

            // Add label to PR
            await githubService.addLabelToPullRequest(
                repoInfo.owner,
                repoInfo.repo,
                pullRequest.number,
                [ticket.type]
            );

            console.log(chalk.blue(`${MSG_LABEL_ADDED}${ticket.type}`));
        }

        // Assign authenticated user to the PR
        if (authenticatedUser) {
            await githubService.assignUserToPullRequest(
                repoInfo.owner,
                repoInfo.repo,
                pullRequest.number,
                [authenticatedUser]
            );
        }

        // Update the Notion ticket with the GitHub Pull Request URL
        await notionService.updateTicketGitHubPullRequest(
            ticket.id,
            pullRequest.url
        );

        // Update ticket status to "In review"
        console.log(chalk.blue(MSG_UPDATING_TICKET_STATUS));
        await notionService.updateTicketStatus(
            ticket.id,
            TICKET_STATUS_IN_REVIEW
        );
        console.log(
            chalk.blue(
                MSG_TICKET_SET_TO_IN_REVIEW.replace("${ticketId}", ticketId)
            )
        );
    } catch (error) {
        console.log(
            chalk.red(
                `${MSG_COULD_NOT_OPEN_PR}${
                    error instanceof Error
                        ? error.message
                        : DEFAULT_UNKNOWN_ERROR
                }`
            )
        );
        process.exit(1);
    }
}

export function registerPrCommand(program: Command): void {
    program
        .command("pr")
        .description("Open a Pull Request for the current ticket")
        .action(mrMain);
}
