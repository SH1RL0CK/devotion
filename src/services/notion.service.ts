import { Client } from "@notionhq/client";
import { PROJECT_STATUS_IN_PROGRESS } from "../constants.js";
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
                    property: "Status",
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
                    error instanceof Error ? error.message : "Unknown error"
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
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    }

    findUniqueIdPrefix(database: NotionDatabase): string | null {
        for (const [key, property] of Object.entries(database.properties)) {
            if (property.type === "unique_id" && property.unique_id?.prefix) {
                return property.unique_id.prefix;
            }
        }
        return null;
    }

    private mapPageToProject(page: any): NotionProject {
        const properties = page.properties;

        // Extract title
        let title = "Untitled";
        for (const [key, prop] of Object.entries(properties)) {
            if (
                (prop as any).type === "title" &&
                (prop as any).title?.[0]?.plain_text
            ) {
                title = (prop as any).title[0].plain_text;
                break;
            }
        }

        // Extract development database ID from Development or Entwicklung relation
        let developmentDbId: string | undefined;
        const developmentProp =
            properties.Development || properties.Entwicklung;
        if (
            developmentProp?.type === "relation" &&
            developmentProp.relation?.[0]?.id
        ) {
            // We need to get the database ID from the relation, not the page ID
            // This will be handled when we fetch the actual relation target
            developmentDbId = developmentProp.relation[0].id;
        }

        return {
            id: page.id,
            title,
            status: PROJECT_STATUS_IN_PROGRESS,
            developmentDbId,
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
                if (typedBlock.type === "child_database") {
                    const title = typedBlock.child_database?.title;
                    if (title === "Development" || title === "Entwicklung") {
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
                            property: "Status",
                            status: {
                                equals: "📋 Backlog",
                            },
                        },
                        {
                            property: "Status",
                            status: {
                                equals: "🏗 In progress",
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
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    }

    async findTicketByTicketId(
        databaseId: string,
        ticketId: string
    ): Promise<NotionTicket | null> {
        try {
            // Get all tickets from the database and find the one with matching ticketId
            const response = await this.client.databases.query({
                database_id: databaseId,
            });

            const tickets = response.results.map((page) =>
                this.mapPageToTicket(page as any)
            );

            return (
                tickets.find((ticket) => ticket.ticketId === ticketId) || null
            );
        } catch (error) {
            throw new Error(
                `Failed to find ticket: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    }

    async updateTicketStatus(ticketId: string, status: string): Promise<void> {
        try {
            await this.client.pages.update({
                page_id: ticketId,
                properties: {
                    Status: {
                        status: {
                            name: status,
                        },
                    },
                },
            });
        } catch (error) {
            throw new Error(
                `Failed to update ticket status: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    }

    private mapPageToTicket(page: any): NotionTicket {
        const properties = page.properties;

        // Extract title
        let title = "Untitled";
        for (const [key, prop] of Object.entries(properties)) {
            if (
                (prop as any).type === "title" &&
                (prop as any).title?.[0]?.plain_text
            ) {
                title = (prop as any).title[0].plain_text;
                break;
            }
        }

        // Extract status
        let status = "Unknown";
        if (
            properties.Status?.type === "status" &&
            properties.Status.status?.name
        ) {
            status = properties.Status.status.name;
        }

        // Extract type
        let type: string | undefined;
        if (
            properties.Type?.type === "select" &&
            properties.Type.select?.name
        ) {
            type = properties.Type.select.name;
        }

        // Extract ticket ID from unique_id
        let ticketId: string | undefined;
        for (const [key, prop] of Object.entries(properties)) {
            if (
                (prop as any).type === "unique_id" &&
                (prop as any).unique_id?.number &&
                (prop as any).unique_id?.prefix
            ) {
                ticketId = `${(prop as any).unique_id.prefix}${
                    (prop as any).unique_id.number
                }`;
                break;
            }
        }

        return {
            id: page.id,
            title,
            status,
            type,
            ticketId,
        };
    }

    private extractTitle(database: any): string {
        if (database.title?.[0]?.plain_text) {
            return database.title[0].plain_text;
        }
        return "Untitled Database";
    }
}
