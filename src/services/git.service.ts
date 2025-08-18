import { simpleGit, SimpleGit } from "simple-git";

export class GitService {
    private git: SimpleGit;

    constructor(workingDir?: string) {
        this.git = simpleGit(workingDir);
    }

    async getCurrentBranch(): Promise<string> {
        const status = await this.git.status();
        return status.current || "";
    }

    async getAllBranches(): Promise<{ local: string[]; remote: string[] }> {
        const branches = await this.git.branch(["-a"]);

        const local = branches.all
            .filter((branch) => !branch.startsWith("remotes/"))
            .filter((branch) => branch !== "HEAD");

        const remote = branches.all
            .filter((branch) => branch.startsWith("remotes/origin/"))
            .map((branch) => branch.replace("remotes/origin/", ""))
            .filter((branch) => branch !== "HEAD");

        return { local, remote };
    }

    async findBranchWithTicketId(ticketId: string): Promise<string | null> {
        const { local, remote } = await this.getAllBranches();
        const allBranches = [...new Set([...local, ...remote])];

        console.log(`Looking for branches containing ticket ID: ${ticketId}`);
        console.log(`All branches:`, allBranches);

        // Look for branches that contain the ticket ID followed by underscore
        // Example: feature/CAGW-19_page_projects
        // We escape the ticket ID to handle special regex characters
        const escapedTicketId = ticketId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        for (const branch of allBranches) {
            // Check if branch contains the ticket ID followed by underscore
            if (branch.includes(`${ticketId}_`)) {
                console.log(`Found matching branch: ${branch}`);
                return branch;
            }
        }

        console.log(`No branch found containing ticket ID: ${ticketId}`);
        return null;
    }

    async switchToBranch(branchName: string): Promise<void> {
        // Check if branch exists locally
        const { local } = await this.getAllBranches();

        if (local.includes(branchName)) {
            // Switch to existing local branch
            await this.git.checkout(branchName);
        } else {
            // Check if it exists on remote and create local tracking branch
            const { remote } = await this.getAllBranches();
            if (remote.includes(branchName)) {
                await this.git.checkout([
                    "-b",
                    branchName,
                    `origin/${branchName}`,
                ]);
            } else {
                throw new Error(
                    `Branch ${branchName} does not exist locally or remotely`
                );
            }
        }
    }

    async pullLatestChanges(): Promise<void> {
        await this.git.pull();
    }

    async createAndSwitchToBranch(
        branchName: string,
        fromBranch: string
    ): Promise<void> {
        // Ensure we're on the base branch
        await this.switchToBranch(fromBranch);
        await this.pullLatestChanges();

        // Create and switch to new branch
        await this.git.checkout(["-b", branchName]);
    }

    async pushBranchToRemote(branchName: string): Promise<void> {
        await this.git.push("origin", branchName, ["--set-upstream"]);
    }

    async pushCurrentBranch(): Promise<void> {
        const currentBranch = await this.getCurrentBranch();
        if (!currentBranch) {
            throw new Error("No current branch found");
        }
        await this.git.push("origin", currentBranch);
    }

    async isGitRepository(): Promise<boolean> {
        try {
            await this.git.status();
            return true;
        } catch {
            return false;
        }
    }

    async deleteLocalBranch(branchName: string): Promise<void> {
        await this.git.deleteLocalBranch(branchName, true); // force delete
    }

    async deleteRemoteBranch(branchName: string): Promise<void> {
        await this.git.push("origin", `:${branchName}`);
    }
}
