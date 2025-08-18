import chalk from "chalk";
import { Command } from "commander";
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
        console.log(
            chalk.red("❌ Project not initialized. Run 'devotion init' first.")
        );
        return;
    }

    const localConfig = await localConfigService.read();
    if (!localConfig) {
        console.log(chalk.red("❌ Failed to read project configuration."));
        return;
    }

    // Check if we're in a git repository
    const gitService = new GitService();
    const isGitRepo = await gitService.isGitRepository();
    if (!isGitRepo) {
        console.log(chalk.red("❌ Current directory is not a git repository."));
        return;
    }

    // Get global config for API keys
    const globalConfig = await globalConfigService.read();
    if (!globalConfig) {
        console.log(
            chalk.red(
                "❌ Global configuration not found. Run 'devotion setup' first."
            )
        );
        return;
    }

    try {
        // Get current branch
        const currentBranch = await gitService.getCurrentBranch();
        if (!currentBranch) {
            console.log(chalk.red("❌ Could not determine current branch."));
            return;
        }

        console.log(chalk.blue(`ℹ️  Current branch: ${currentBranch}`));

        // Extract ticket ID from branch name
        const ticketId = extractTicketIdFromBranchName(currentBranch);
        if (!ticketId) {
            console.log(
                chalk.red(
                    "❌ Could not extract ticket ID from branch name. Expected format: <prefix>/<TICKET_ID>_<description>"
                )
            );
            return;
        }

        console.log(chalk.blue(`ℹ️  Extracted ticket ID: ${ticketId}`));

        // Find ticket in Notion
        const notionService = new NotionService(globalConfig.notionApiKey);
        const ticket = await notionService.findTicketByTicketId(
            localConfig.ticketsDatabaseId,
            ticketId
        );

        if (!ticket) {
            console.log(
                chalk.red(`❌ Could not find ticket with ID: ${ticketId}`)
            );
            return;
        }

        console.log(chalk.blue(`ℹ️  Found ticket: ${ticket.title}`));

        // Push current branch to remote
        console.log(chalk.blue("ℹ️  Pushing current branch to remote..."));
        await gitService.pushCurrentBranch();

        // Create GitHub service and get repository info
        const githubService = new GitHubService(globalConfig.githubApiKey);
        const repoInfo = await githubService.getRepositoryInfo();

        if (!repoInfo) {
            console.log(
                chalk.red(
                    "❌ Could not determine GitHub repository information."
                )
            );
            return;
        }

        console.log(
            chalk.blue(`ℹ️  Repository: ${repoInfo.owner}/${repoInfo.repo}`)
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
                chalk.yellow(
                    `⚠️  Pull request already exists: ${existingPR.url}`
                )
            );
            console.log(
                chalk.blue(`ℹ️  Updating ticket status to In review...`)
            );

            // Update ticket status to "In review" if not already
            if (ticket.status !== "📋 In review") {
                await notionService.updateTicketStatus(
                    ticket.id,
                    "📋 In review"
                );
                console.log(
                    chalk.blue(`ℹ️  Ticket ${ticketId} set to In review`)
                );
            }
            return;
        }

        // Prepare PR data
        const prTitle = `${ticketId}: ${ticket.title}`;
        const prBody = `**Ticket ID:** ${ticketId}\n**Title:** ${ticket.title}`;

        // Create Pull Request
        console.log(chalk.blue("ℹ️  Creating pull request..."));
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

        console.log(chalk.green(`✅ Opened PR: ${pullRequest.title}`));
        console.log(chalk.blue(`   URL: ${pullRequest.url}`));

        // Update ticket status to "In review"
        console.log(chalk.blue("ℹ️  Updating ticket status..."));
        await notionService.updateTicketStatus(ticket.id, "📋 In review");
        console.log(chalk.blue(`ℹ️  Ticket ${ticketId} set to In review`));
    } catch (error) {
        console.log(
            chalk.red(
                `❌ Could not open PR: ${
                    error instanceof Error ? error.message : "Unknown error"
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
