import chalk from "chalk";
import { Command } from "commander";
import {
    DEFAULT_UNKNOWN_ERROR,
    MSG_COULD_NOT_DETERMINE_BRANCH,
    MSG_COULD_NOT_DETERMINE_REPO,
    MSG_COULD_NOT_EXTRACT_TICKET_ID,
    MSG_COULD_NOT_FIND_TICKET,
    MSG_COULD_NOT_OPEN_PR,
    MSG_CREATING_PR,
    MSG_CURRENT_BRANCH,
    MSG_EXTRACTED_TICKET_ID,
    MSG_FAILED_READ_CONFIG,
    MSG_FOUND_TICKET,
    MSG_GLOBAL_CONFIG_NOT_FOUND,
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

        // Prepare PR data
        const prTitle = `${ticketId}: ${ticket.title}`;
        const prBody = `**Ticket ID:** ${ticketId}\n**Title:** ${ticket.title}`;

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

export function registerMrCommand(program: Command): void {
    program
        .command("mr")
        .description("Open a Pull Request for the current ticket")
        .action(mrMain);
}
