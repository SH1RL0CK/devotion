import { Client } from "@notionhq/client";
import {
    DEFAULT_UNKNOWN_ERROR,
    DEFAULT_UNKNOWN_STATUS,
    DEFAULT_UNTITLED,
    DEFAULT_UNTITLED_DATABASE,
    NOTION_PROPERTY_ASSIGN,
    NOTION_PROPERTY_DEVELOPMENT,
    NOTION_PROPERTY_ENTWICKLUNG,
    NOTION_PROPERTY_GITHUB_PULL_REQUEST,
    NOTION_PROPERTY_STATUS,
    NOTION_PROPERTY_TYPE,
    NOTION_TYPE_CHILD_DATABASE,
    NOTION_TYPE_SELECT,
    NOTION_TYPE_STATUS,
    NOTION_TYPE_TITLE,
    NOTION_TYPE_UNIQUE_ID,
    PROJECT_STATUS_IN_PROGRESS,
    TICKET_STATUS_BACKLOG,
    TICKET_STATUS_IN_PROGRESS,
} from "../constants.js";
import {
    NotionDatabase,
    NotionProject,
    NotionTicket,
} from "../models/notion.js";

export class NotionService {
    private client: Client;

    constructor(apiKey: string) {
        this.client = new Client({ auth: apiKey });
    }

    async getInProgressProjects(databaseId: string): Promise<NotionProject[]> {
        try {
            const response = await this.client.databases.query({
                database_id: databaseId,
                filter: {
                    property: NOTION_PROPERTY_STATUS,
                    status: {
                        equals: PROJECT_STATUS_IN_PROGRESS,
                    },
                },
            });

            return response.results.map((page) =>
                this.mapPageToProject(page as any)
            );
        } catch (error) {
            throw new Error(
                `Failed to fetch projects: ${
                    error instanceof Error
                        ? error.message
                        : DEFAULT_UNKNOWN_ERROR
                }`
            );
        }
    }

    async getDatabaseSchema(databaseId: string): Promise<NotionDatabase> {
        try {
            const response = await this.client.databases.retrieve({
                database_id: databaseId,
            });

            return {
                id: response.id,
                title: this.extractTitle(response),
                properties: response.properties as any,
            };
        } catch (error) {
            throw new Error(
                `Failed to fetch database schema: ${
                    error instanceof Error
                        ? error.message
                        : DEFAULT_UNKNOWN_ERROR
                }`
            );
        }
    }

    findUniqueIdPrefix(database: NotionDatabase): string | null {
        for (const [key, property] of Object.entries(database.properties)) {
            if (
                property.type === NOTION_TYPE_UNIQUE_ID &&
                property.unique_id?.prefix
            ) {
                return property.unique_id.prefix;
            }
        }
        return null;
    }

    findSelectOptionColor(
        database: NotionDatabase,
        propertyName: string,
        optionName: string
    ): string | null {
        // Find the property by name
        const property = database.properties[propertyName];

        // Check if it's a select property with options
        if (
            property &&
            property.type === NOTION_TYPE_SELECT &&
            property.select?.options
        ) {
            // Find the option with matching name
            const option = property.select.options.find(
                (option) =>
                    option.name.toLowerCase() === optionName.toLowerCase()
            );

            // Return the color if found
            if (option) {
                return option.color;
            }
        }

        return null;
    }

    private mapPageToProject(page: any): NotionProject {
        const properties = page.properties;

        // Extract title
        let title = DEFAULT_UNTITLED;
        for (const [key, prop] of Object.entries(properties)) {
            if (
                (prop as any).type === NOTION_TYPE_TITLE &&
                (prop as any).title?.[0]?.plain_text
            ) {
                title = (prop as any).title[0].plain_text;
                break;
            }
        }

        return {
            id: page.id,
            title,
            status: PROJECT_STATUS_IN_PROGRESS,
            developmentDbId: undefined, // This will be populated by getRelationDatabaseId when needed
        };
    }

    async getRelationDatabaseId(
        pageId: string,
        relationProperty: string
    ): Promise<string | null> {
        try {
            // Get the page content to look for child databases
            const blocks = await this.client.blocks.children.list({
                block_id: pageId,
            });

            // Look for child_database with title "Development" or "Entwicklung"
            for (const block of blocks.results) {
                const typedBlock = block as any;
                if (typedBlock.type === NOTION_TYPE_CHILD_DATABASE) {
                    const title = typedBlock.child_database?.title;
                    if (
                        title === NOTION_PROPERTY_DEVELOPMENT ||
                        title === NOTION_PROPERTY_ENTWICKLUNG
                    ) {
                        return typedBlock.id;
                    }
                }
            }

            return null;
        } catch (error) {
            console.error(
                "Error getting database ID from page content:",
                error
            );
            return null;
        }
    }

    async getTicketsForDev(databaseId: string): Promise<NotionTicket[]> {
        try {
            const response = await this.client.databases.query({
                database_id: databaseId,
                filter: {
                    or: [
                        {
                            property: NOTION_PROPERTY_STATUS,
                            status: {
                                equals: TICKET_STATUS_BACKLOG,
                            },
                        },
                        {
                            property: NOTION_PROPERTY_STATUS,
                            status: {
                                equals: TICKET_STATUS_IN_PROGRESS,
                            },
                        },
                    ],
                },
            });

            return response.results.map((page) =>
                this.mapPageToTicket(page as any)
            );
        } catch (error) {
            throw new Error(
                `Failed to fetch tickets: ${
                    error instanceof Error
                        ? error.message
                        : DEFAULT_UNKNOWN_ERROR
                }`
            );
        }
    }

    async getAllTickets(databaseId: string): Promise<NotionTicket[]> {
        try {
            const tickets: NotionTicket[] = [];
            let cursor: string | undefined;

            do {
                const response: any = await this.client.databases.query({
                    database_id: databaseId,
                    start_cursor: cursor,
                });

                tickets.push(
                    ...response.results.map((page: any) =>
                        this.mapPageToTicket(page)
                    )
                );

                cursor = response.has_more
                    ? response.next_cursor ?? undefined
                    : undefined;
            } while (cursor);

            return tickets;
        } catch (error) {
            throw new Error(
                `Failed to fetch tickets: ${
                    error instanceof Error
                        ? error.message
                        : DEFAULT_UNKNOWN_ERROR
                }`
            );
        }
    }

    async findTicketByTicketId(
        databaseId: string,
        ticketId: string
    ): Promise<NotionTicket | null> {
        try {
            const normalized = ticketId.trim().toLowerCase();
            const tickets = await this.getAllTickets(databaseId);

            // Match exact ticketId, case-insensitive, or numeric suffix, or page id
            return (
                tickets.find((ticket) => {
                    if (!ticket.ticketId) {
                        return (
                            ticket.id.replace(/-/g, "").toLowerCase() ===
                            normalized.replace(/-/g, "")
                        );
                    }
                    const tId = ticket.ticketId.toLowerCase();
                    return (
                        tId === normalized ||
                        tId === `${normalized}` ||
                        ticket.id.replace(/-/g, "").toLowerCase() ===
                            normalized.replace(/-/g, "") ||
                        tId.endsWith(`-${normalized}`)
                    );
                }) || null
            );
        } catch (error) {
            throw new Error(
                `Failed to find ticket: ${
                    error instanceof Error
                        ? error.message
                        : DEFAULT_UNKNOWN_ERROR
                }`
            );
        }
    }

    async getTicketPage(pageId: string): Promise<NotionTicket | null> {
        try {
            const page = await this.client.pages.retrieve({
                page_id: pageId,
            });
            return this.mapPageToTicket(page as any);
        } catch {
            return null;
        }
    }

    async getPageBlocks(
        blockId: string,
        depth: number = 0,
        maxDepth: number = 3
    ): Promise<any[]> {
        try {
            const blocks: any[] = [];
            let cursor: string | undefined;

            do {
                const response: any = await this.client.blocks.children.list({
                    block_id: blockId,
                    start_cursor: cursor,
                    page_size: 100,
                });

                for (const block of response.results) {
                    if (block.has_children && depth < maxDepth) {
                        const children = await this.getPageBlocks(
                            block.id,
                            depth + 1,
                            maxDepth
                        );
                        block.children = children;
                    }
                    blocks.push(block);
                }

                cursor = response.has_more
                    ? response.next_cursor ?? undefined
                    : undefined;
            } while (cursor);

            return blocks;
        } catch (error) {
            return [];
        }
    }

    async updateTicketStatus(ticketId: string, status: string): Promise<void> {
        try {
            await this.client.pages.update({
                page_id: ticketId,
                properties: {
                    [NOTION_PROPERTY_STATUS]: {
                        status: {
                            name: status,
                        },
                    },
                },
            });
        } catch (error) {
            throw new Error(
                `Failed to update ticket status: ${
                    error instanceof Error
                        ? error.message
                        : DEFAULT_UNKNOWN_ERROR
                }`
            );
        }
    }

    async updateTicketGitHubPullRequest(
        ticketId: string,
        pullRequestUrl: string
    ): Promise<void> {
        try {
            await this.client.pages.update({
                page_id: ticketId,
                properties: {
                    [NOTION_PROPERTY_GITHUB_PULL_REQUEST]: {
                        url: pullRequestUrl,
                    },
                },
            });
        } catch (error) {
            throw new Error(
                `Failed to update ticket GitHub Pull Request URL: ${
                    error instanceof Error
                        ? error.message
                        : DEFAULT_UNKNOWN_ERROR
                }`
            );
        }
    }

    async assignTicketToUser(ticketId: string, userId: string): Promise<void> {
        try {
            await this.client.pages.update({
                page_id: ticketId,
                properties: {
                    [NOTION_PROPERTY_ASSIGN]: {
                        people: [
                            {
                                id: userId,
                            },
                        ],
                    },
                },
            });
        } catch (error) {
            throw new Error(
                `Failed to assign ticket to user: ${
                    error instanceof Error
                        ? error.message
                        : DEFAULT_UNKNOWN_ERROR
                }`
            );
        }
    }

    async getUsers(): Promise<
        Array<{ id: string; name: string; email?: string }>
    > {
        try {
            const response = await this.client.users.list({});

            return response.results
                .filter((user: any) => user.type === "person") // Only include person users, not bots
                .map((user: any) => ({
                    id: user.id,
                    name: user.name || "Unknown User",
                    email: user.person?.email,
                }));
        } catch (error) {
            throw new Error(
                `Failed to fetch users: ${
                    error instanceof Error
                        ? error.message
                        : DEFAULT_UNKNOWN_ERROR
                }`
            );
        }
    }

    private mapPageToTicket(page: any): NotionTicket {
        const properties = page.properties;

        // Extract title
        let title = DEFAULT_UNTITLED;
        for (const [key, prop] of Object.entries(properties)) {
            if (
                (prop as any).type === NOTION_TYPE_TITLE &&
                (prop as any).title?.[0]?.plain_text
            ) {
                title = (prop as any).title[0].plain_text;
                break;
            }
        }

        // Extract status
        let status = DEFAULT_UNKNOWN_STATUS;
        if (
            properties[NOTION_PROPERTY_STATUS]?.type === NOTION_TYPE_STATUS &&
            properties[NOTION_PROPERTY_STATUS].status?.name
        ) {
            status = properties[NOTION_PROPERTY_STATUS].status.name;
        }

        // Extract type
        let type: string | undefined;
        if (
            properties[NOTION_PROPERTY_TYPE]?.type === NOTION_TYPE_SELECT &&
            properties[NOTION_PROPERTY_TYPE].select?.name
        ) {
            type = properties[NOTION_PROPERTY_TYPE].select.name;
        }

        // Extract ticket ID from unique_id
        let ticketId: string | undefined;
        for (const [key, prop] of Object.entries(properties)) {
            if (
                (prop as any).type === NOTION_TYPE_UNIQUE_ID &&
                (prop as any).unique_id?.number &&
                (prop as any).unique_id?.prefix
            ) {
                ticketId = `${(prop as any).unique_id.prefix}-${
                    (prop as any).unique_id.number
                }`;
                break;
            }
        }

        // Extract assignee
        let assignee: string | undefined;
        if (
            properties[NOTION_PROPERTY_ASSIGN]?.type === "people" &&
            Array.isArray(properties[NOTION_PROPERTY_ASSIGN].people) &&
            properties[NOTION_PROPERTY_ASSIGN].people.length > 0
        ) {
            assignee = properties[NOTION_PROPERTY_ASSIGN].people
                .map((person: any) => person.name || person.id)
                .join(", ");
        }

        // Extract GitHub Pull Request URL
        let githubPrUrl: string | undefined;
        if (
            properties[NOTION_PROPERTY_GITHUB_PULL_REQUEST]?.type === "url" &&
            properties[NOTION_PROPERTY_GITHUB_PULL_REQUEST].url
        ) {
            githubPrUrl = properties[NOTION_PROPERTY_GITHUB_PULL_REQUEST].url;
        }

        // Extract description from rich_text property if present
        let description: string | undefined;
        for (const [key, prop] of Object.entries(properties)) {
            const lowerKey = key.toLowerCase();
            if (
                (lowerKey === "description" || lowerKey === "beschreibung") &&
                (prop as any).type === "rich_text" &&
                Array.isArray((prop as any).rich_text) &&
                (prop as any).rich_text.length > 0
            ) {
                description = (prop as any).rich_text
                    .map((t: any) => t.plain_text)
                    .join("");
                break;
            }
        }

        // Notion URL
        const pageUrl = page.url || `https://notion.so/${page.id.replace(/-/g, "")}`;

        return {
            id: page.id,
            title,
            status,
            type,
            ticketId,
            assignee,
            githubPrUrl,
            url: pageUrl,
            description,
        };
    }

    private extractTitle(database: any): string {
        if (database.title?.[0]?.plain_text) {
            return database.title[0].plain_text;
        }
        return DEFAULT_UNTITLED_DATABASE;
    }
}
