import { Octokit } from "octokit";
import {
    DEFAULT_UNKNOWN_ERROR,
    ERROR_CHECKING_EXISTING_PR,
    ERROR_CREATE_PR,
    ERROR_GETTING_REPO_INFO,
    GIT_ENCODING,
    GIT_REMOTE_COMMAND,
    GITHUB_HTTPS_PATTERN,
    GITHUB_HTTPS_PREFIX,
    GITHUB_SSH_PATTERN,
    GITHUB_SSH_PREFIX,
    PR_STATE_OPEN,
} from "../constants.js";
import {
    CheckStatus,
    PullRequest,
    PullRequestData,
    PullRequestDetails,
} from "../models/github.js";

export class GitHubService {
    private octokit: Octokit;

    constructor(token: string) {
        this.octokit = new Octokit({ auth: token });
    }

    async getRepositoryInfo(): Promise<{ owner: string; repo: string } | null> {
        try {
            // Get the current repository information from git remote
            const { execSync } = await import("child_process");
            const remoteUrl = execSync(GIT_REMOTE_COMMAND, {
                encoding: GIT_ENCODING,
            }).trim();

            // Parse GitHub URL to extract owner and repo
            // Supports both HTTPS and SSH formats
            let match;
            if (remoteUrl.startsWith(GITHUB_HTTPS_PREFIX)) {
                match = remoteUrl.match(GITHUB_HTTPS_PATTERN);
            } else if (remoteUrl.startsWith(GITHUB_SSH_PREFIX)) {
                match = remoteUrl.match(GITHUB_SSH_PATTERN);
            }

            if (match) {
                return {
                    owner: match[1],
                    repo: match[2],
                };
            }

            return null;
        } catch (error) {
            console.error(ERROR_GETTING_REPO_INFO, error);
            return null;
        }
    }

    async getAuthenticatedUser(): Promise<string | null> {
        try {
            const response = await this.octokit.rest.users.getAuthenticated();
            return response.data.login;
        } catch (error) {
            console.error("Error getting authenticated user:", error);
            return null;
        }
    }

    async createPullRequest(
        owner: string,
        repo: string,
        prData: PullRequestData
    ): Promise<PullRequest> {
        try {
            const response = await this.octokit.rest.pulls.create({
                owner,
                repo,
                title: prData.title,
                body: prData.body,
                head: prData.head,
                base: prData.base,
            });

            return {
                number: response.data.number,
                url: response.data.html_url,
                title: response.data.title,
            };
        } catch (error) {
            throw new Error(
                `${ERROR_CREATE_PR}${
                    error instanceof Error
                        ? error.message
                        : DEFAULT_UNKNOWN_ERROR
                }`
            );
        }
    }

    async assignUserToPullRequest(
        owner: string,
        repo: string,
        pullNumber: number,
        assignees: string[]
    ): Promise<void> {
        try {
            await this.octokit.rest.issues.addAssignees({
                owner,
                repo,
                issue_number: pullNumber,
                assignees,
            });
        } catch (error) {
            console.error("Error assigning users to PR:", error);
            // Don't throw here, assignment failure shouldn't break PR creation
        }
    }

    async checkIfPullRequestExists(
        owner: string,
        repo: string,
        head: string,
        base: string
    ): Promise<PullRequest | null> {
        try {
            const response = await this.octokit.rest.pulls.list({
                owner,
                repo,
                head: `${owner}:${head}`,
                base,
                state: PR_STATE_OPEN,
            });

            if (response.data.length > 0) {
                const pr = response.data[0];
                return {
                    number: pr.number,
                    url: pr.html_url,
                    title: pr.title,
                };
            }

            return null;
        } catch (error) {
            console.error(ERROR_CHECKING_EXISTING_PR, error);
            return null;
        }
    }

    async getPullRequestDetails(
        owner: string,
        repo: string,
        pullNumber: number
    ): Promise<PullRequestDetails | null> {
        try {
            const response = await this.octokit.rest.pulls.get({
                owner,
                repo,
                pull_number: pullNumber,
            });

            const pr = response.data;
            return {
                number: pr.number,
                url: pr.html_url,
                title: pr.title,
                mergeable: pr.mergeable,
                mergeable_state: pr.mergeable_state,
                merged: pr.merged,
                head: {
                    ref: pr.head.ref,
                    sha: pr.head.sha,
                },
                base: {
                    ref: pr.base.ref,
                },
            };
        } catch (error) {
            console.error("Error getting PR details:", error);
            return null;
        }
    }

    async checkPullRequestStatus(
        owner: string,
        repo: string,
        ref: string
    ): Promise<CheckStatus> {
        try {
            // Check combined status
            const statusResponse =
                await this.octokit.rest.repos.getCombinedStatusForRef({
                    owner,
                    repo,
                    ref,
                });

            // Check check runs
            const checkRunsResponse = await this.octokit.rest.checks.listForRef(
                {
                    owner,
                    repo,
                    ref,
                }
            );

            // If there are check runs, check their conclusions
            if (checkRunsResponse.data.check_runs.length > 0) {
                const failedRuns = checkRunsResponse.data.check_runs.filter(
                    (run: any) =>
                        run.conclusion === "failure" ||
                        run.conclusion === "cancelled" ||
                        run.conclusion === "timed_out"
                );

                const pendingRuns = checkRunsResponse.data.check_runs.filter(
                    (run: any) =>
                        run.status === "in_progress" ||
                        run.status === "queued" ||
                        run.conclusion === null
                );

                if (failedRuns.length > 0) {
                    return { state: "failure", conclusion: "failure" };
                }

                if (pendingRuns.length > 0) {
                    return { state: "pending", conclusion: null };
                }

                // All runs are either success, neutral, or skipped
                return { state: "success", conclusion: "success" };
            }

            // Fall back to combined status - if no statuses, consider it success
            const state = statusResponse.data.state;
            if (
                state === "pending" ||
                state === "success" ||
                statusResponse.data.statuses.length === 0
            ) {
                return {
                    state:
                        statusResponse.data.statuses.length === 0
                            ? "success"
                            : (state as "success" | "pending"),
                };
            }

            return { state: state as "failure" | "error" };
        } catch (error) {
            console.error("Error checking PR status:", error);
            return { state: "error" };
        }
    }

    async mergePullRequest(
        owner: string,
        repo: string,
        pullNumber: number,
        commitTitle: string,
        commitMessage?: string
    ): Promise<void> {
        try {
            await this.octokit.rest.pulls.merge({
                owner,
                repo,
                pull_number: pullNumber,
                commit_title: commitTitle,
                commit_message: commitMessage,
                merge_method: "squash",
            });
        } catch (error) {
            throw new Error(
                `Failed to merge PR: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    }

    async getPullRequestCommits(
        owner: string,
        repo: string,
        pullNumber: number
    ): Promise<string[]> {
        try {
            const response = await this.octokit.rest.pulls.listCommits({
                owner,
                repo,
                pull_number: pullNumber,
            });

            return response.data
                .map((commit: any) => commit.commit.message.split("\n")[0]) // Get first line of each commit
                .filter((message: string) => message.trim().length > 0); // Filter empty messages
        } catch (error) {
            console.error("Error getting PR commits:", error);
            return [];
        }
    }
}
