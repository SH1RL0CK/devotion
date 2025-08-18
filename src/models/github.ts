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

export interface PullRequestDetails extends PullRequest {
    mergeable: boolean | null;
    mergeable_state: string;
    merged: boolean;
    head: {
        ref: string;
        sha: string;
    };
    base: {
        ref: string;
    };
}

export interface CheckStatus {
    state: "success" | "pending" | "failure" | "error";
    conclusion?:
        | "success"
        | "failure"
        | "neutral"
        | "cancelled"
        | "timed_out"
        | "action_required"
        | null;
}
