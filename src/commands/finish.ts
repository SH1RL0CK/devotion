import editor from "@inquirer/editor";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import {
    DEFAULT_UNKNOWN_ERROR,
    ERROR_DELETING_BRANCH,
    ERROR_MERGE_PR,
    ERROR_UPDATING_TICKET,
    MSG_BRANCH_CLEANUP,
    MSG_COULD_NOT_EXTRACT_TICKET_ID_FINISH,
    MSG_FAILED_READ_CONFIG,
    MSG_GLOBAL_CONFIG_NOT_FOUND,
    MSG_NO_CURRENT_BRANCH,
    MSG_NO_OPEN_PR,
    MSG_NOT_GIT_REPOSITORY,
    MSG_PR_MERGED_SUCCESS,
    MSG_PR_NOT_MERGEABLE,
    MSG_PROJECT_NOT_INITIALIZED,
    MSG_SET_TO_DONE,
    MSG_SWITCHED_AND_PULLED,
    MSG_TICKET_UPDATED_DONE,
    TICKET_STATUS_DONE,
} from "../constants.js";
import { GitService } from "../services/git.service.js";
import { GitHubService } from "../services/github.service.js";
import { GlobalConfigService } from "../services/global-config.service.js";
import { LocalConfigService } from "../services/local-config.service.js";
import { NotionService } from "../services/notion.service.js";
import { extractTicketIdFromBranchName } from "../utils.js";

const localConfigService = new LocalConfigService();
const globalConfigService = new GlobalConfigService();

export async function finishCommand(): Promise<void> {
    try {
        // 1. Validate git repository
        const gitService = new GitService();
        if (!(await gitService.isGitRepository())) {
            console.error(chalk.red(MSG_NOT_GIT_REPOSITORY));
            process.exit(1);
        }

        // 2. Load local configuration
        if (!(await localConfigService.exists())) {
            console.error(chalk.red(MSG_PROJECT_NOT_INITIALIZED));
            process.exit(1);
        }

        const localConfig = await localConfigService.read();
        if (!localConfig) {
            console.error(chalk.red(MSG_FAILED_READ_CONFIG));
            process.exit(1);
        }

        // 3. Load global configuration
        if (!(await globalConfigService.exists())) {
            console.error(chalk.red(MSG_GLOBAL_CONFIG_NOT_FOUND));
            process.exit(1);
        }

        const globalConfig = await globalConfigService.read();
        if (!globalConfig) {
            console.error(chalk.red(MSG_GLOBAL_CONFIG_NOT_FOUND));
            process.exit(1);
        }

        // 4. Get current branch and extract ticket ID
        const currentBranch = await gitService.getCurrentBranch();
        if (!currentBranch) {
            console.error(chalk.red(MSG_NO_CURRENT_BRANCH));
            process.exit(1);
        }

        const ticketId = extractTicketIdFromBranchName(currentBranch);
        if (!ticketId) {
            console.error(chalk.red(MSG_COULD_NOT_EXTRACT_TICKET_ID_FINISH));
            process.exit(1);
        }

        // 5. Initialize services
        const githubService = new GitHubService(globalConfig.githubApiKey);
        const notionService = new NotionService(globalConfig.notionApiKey);

        // 6. Find ticket in Notion to get the page ID
        const ticket = await notionService.findTicketByTicketId(
            localConfig.ticketsDatabaseId,
            ticketId
        );

        if (!ticket) {
            console.error(
                chalk.red(`❌ Could not find ticket ${ticketId} in Notion`)
            );
            process.exit(1);
        }

        // 7. Get repository info
        const repoInfo = await githubService.getRepositoryInfo();
        if (!repoInfo) {
            console.error(
                chalk.red("❌ Could not determine repository information")
            );
            process.exit(1);
        }

        // 8. Find the pull request for current branch
        const existingPR = await githubService.checkIfPullRequestExists(
            repoInfo.owner,
            repoInfo.repo,
            currentBranch,
            localConfig.developmentBranch
        );

        if (!existingPR) {
            console.error(chalk.red(MSG_NO_OPEN_PR));
            process.exit(1);
        }

        // 9. Get detailed PR information
        const prDetails = await githubService.getPullRequestDetails(
            repoInfo.owner,
            repoInfo.repo,
            existingPR.number
        );

        if (!prDetails) {
            console.error(chalk.red("❌ Could not get PR details"));
            process.exit(1);
        }

        // 10. Check if PR is mergeable and tests pass
        if (prDetails.merged) {
            console.error(chalk.red("❌ PR is already merged"));
            process.exit(1);
        }

        if (prDetails.mergeable === false) {
            console.error(chalk.red("❌ PR has merge conflicts"));
            process.exit(1);
        }

        // 11. Check PR status/checks
        const checkStatus = await githubService.checkPullRequestStatus(
            repoInfo.owner,
            repoInfo.repo,
            prDetails.head.sha
        );

        if (checkStatus.state === "failure" || checkStatus.state === "error") {
            console.error(chalk.red(MSG_PR_NOT_MERGEABLE));
            process.exit(1);
        }

        // 12. Show PR details and ask for confirmation
        console.log(chalk.blue("\n📋 Pull Request Details:"));
        console.log(chalk.white(`   Title: ${prDetails.title}`));
        console.log(chalk.white(`   URL: ${prDetails.url}`));
        console.log(
            chalk.white(
                `   Branch: ${prDetails.head.ref} → ${prDetails.base.ref}`
            )
        );
        console.log(chalk.white(`   Ticket: ${ticketId}`));

        if (checkStatus.state === "pending") {
            console.log(chalk.yellow("   ⚠️ Some checks are still pending"));
        } else if (checkStatus.state === "success") {
            console.log(chalk.green("   ✅ All checks passing"));
        }

        const { confirmMerge } = await inquirer.prompt([
            {
                type: "confirm",
                name: "confirmMerge",
                message: "Do you want to merge this PR with squash commit?",
                default: false,
            },
        ]);

        if (!confirmMerge) {
            console.log(chalk.yellow("❌ Merge cancelled by user"));
            process.exit(0);
        }

        // 13. Get PR commits and prepare commit message body
        console.log(chalk.blue("ℹ️ Fetching PR commits..."));
        const commits = await githubService.getPullRequestCommits(
            repoInfo.owner,
            repoInfo.repo,
            prDetails.number
        );

        // Format commits for the squash commit body
        const formattedCommits = commits
            .map((commit) => `* ${commit}`)
            .join("\n");

        const defaultCommitBody =
            formattedCommits || "* No commit messages found";

        // Let user edit the commit message body
        const commitBody = await editor({
            message: "Edit the squash commit message body:",
            default: defaultCommitBody,
        });

        // 14. Merge the PR with squash
        const commitTitle = `${prDetails.title} (#${prDetails.number})`; // Add PR number to commit title
        try {
            await githubService.mergePullRequest(
                repoInfo.owner,
                repoInfo.repo,
                prDetails.number,
                commitTitle,
                commitBody.trim()
            );
            console.log(chalk.green(`${MSG_PR_MERGED_SUCCESS} ${commitTitle}`));
        } catch (error) {
            console.error(
                chalk.red(
                    `${ERROR_MERGE_PR}${
                        error instanceof Error
                            ? error.message
                            : DEFAULT_UNKNOWN_ERROR
                    }`
                )
            );
            process.exit(1);
        }

        // 15. Switch to development branch first
        try {
            await gitService.switchToBranch(localConfig.developmentBranch);
            await gitService.pullLatestChanges();
            console.log(
                chalk.blue(
                    `${MSG_SWITCHED_AND_PULLED} '${localConfig.developmentBranch}' and pulled latest changes`
                )
            );
        } catch (error) {
            console.error(
                chalk.yellow(
                    `⚠️ Warning: Could not switch to ${localConfig.developmentBranch} or pull changes`
                )
            );
            // Continue execution as this is not critical
        }

        // 16. Git cleanup - delete remote branch first, then local
        try {
            await gitService.deleteRemoteBranch(currentBranch);
            await gitService.deleteLocalBranch(currentBranch);
            console.log(
                chalk.green(
                    `${MSG_BRANCH_CLEANUP} ${currentBranch} locally and on origin`
                )
            );
        } catch (error) {
            console.error(
                chalk.red(
                    `${ERROR_DELETING_BRANCH}${
                        error instanceof Error
                            ? error.message
                            : DEFAULT_UNKNOWN_ERROR
                    }`
                )
            );
            // Continue execution as this is not critical
        }

        // 17. Update ticket status in Notion
        try {
            await notionService.updateTicketStatus(
                ticket.id,
                TICKET_STATUS_DONE
            );
            console.log(
                chalk.blue(
                    `${MSG_TICKET_UPDATED_DONE} ${ticketId} ${MSG_SET_TO_DONE}`
                )
            );
        } catch (error) {
            console.error(
                chalk.red(
                    `${ERROR_UPDATING_TICKET}${
                        error instanceof Error
                            ? error.message
                            : DEFAULT_UNKNOWN_ERROR
                    }`
                )
            );
            // Continue execution as this is not critical
        }

        console.log(chalk.green("🎉 Ticket finished successfully!"));
    } catch (error) {
        console.error(
            chalk.red(
                `❌ Unexpected error: ${
                    error instanceof Error
                        ? error.message
                        : DEFAULT_UNKNOWN_ERROR
                }`
            )
        );
        process.exit(1);
    }
}

export function registerFinishCommand(program: Command): void {
    program
        .command("finish")
        .description(
            "Merge the current ticket's PR, clean up branches, and mark ticket as done"
        )
        .action(finishCommand);
}
