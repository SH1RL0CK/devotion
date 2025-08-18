export interface GlobalConfig {
    notionApiKey: string;
    githubApiKey: string;
    notionProjectsDbId: string;
    userId: string;
}

export interface MaskedGlobalConfig {
    notionApiKey: string;
    githubApiKey: string;
    notionProjectsDbId: string;
    userId: string;
}

export interface LocalConfig {
    projectId: string;
    ticketsDatabaseId: string;
    ticketPrefix: string;
    developmentBranch: string;
}
