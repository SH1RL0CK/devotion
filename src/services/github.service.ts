import { Octokit } from "octokit";

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
            const remoteUrl = execSync("git remote get-url origin", {
                encoding: "utf8",
            }).trim();

            // Parse GitHub URL to extract owner and repo
            // Supports both HTTPS and SSH formats
            let match;
            if (remoteUrl.startsWith("https://github.com/")) {
                match = remoteUrl.match(
                    /https:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/
                );
            } else if (remoteUrl.startsWith("git@github.com:")) {
                match = remoteUrl.match(
                    /git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/
                );
            }

            if (match) {
                return {
                    owner: match[1],
                    repo: match[2],
                };
            }

            return null;
        } catch (error) {
            console.error("Error getting repository info:", error);
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
                `Failed to create pull request: ${
                    error instanceof Error ? error.message : "Unknown error"
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
                state: "open",
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
            console.error("Error checking for existing PR:", error);
            return null;
        }
    }
}
