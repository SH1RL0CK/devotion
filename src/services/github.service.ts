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

export interface PullRequestData {
    title: string;
    body: string;
    head: string;
    base: string;
}

export interface PullRequest {
    number: number;
    url: string;
    title: string;
}

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
}
