export interface NotionProject {
    id: string;
    title: string;
    status: string;
    developmentDbId?: string;
}

export interface NotionTicket {
    id: string;
    title: string;
    status: string;
    type?: string;
    ticketId?: string; // e.g., "CAGW-19"
}

export interface NotionDatabase {
    id: string;
    title: string;
    properties: Record<string, NotionProperty>;
}

export interface NotionProperty {
    type: string;
    unique_id?: {
        prefix?: string;
    };
}

export interface NotionPage {
    id: string;
    properties: Record<string, any>;
}
