// Utility functions and helpers

export function extractTicketIdFromBranchName(
    branchName: string
): string | null {
    // Extract ticket ID between / and _
    // Example: feature/CAGW-19_page_projects -> CAGW-19
    const match = branchName.match(/\/([^/_]+)_/);
    return match ? match[1] : null;
}

export function buildBranchPrefix(
    ticketType: string | undefined,
    ticketId: string
): string {
    // Determine prefix based on type
    let prefix = "feature";
    if (ticketType) {
        const lowerType = ticketType.toLowerCase();
        if (lowerType.includes("bug")) {
            prefix = "bugfix";
        } else if (
            lowerType.includes("documentation") ||
            lowerType.includes("dokumentation")
        ) {
            prefix = "doc";
        }
    }

    return `${prefix}/${ticketId}_`;
}

export function buildBranchName(
    ticketType: string | undefined,
    ticketId: string,
    title: string
): string {
    const prefix = buildBranchPrefix(ticketType, ticketId);

    // Convert title to valid branch name part
    const titlePart = title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "") // Remove special characters
        .replace(/\s+/g, "_") // Replace spaces with underscores
        .substring(0, 30); // Limit length

    return `${prefix}${titlePart}`;
}

export function sanitizeDescription(description: string): string {
    return description
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "") // Remove special characters
        .replace(/\s+/g, "_") // Replace spaces with underscores
        .replace(/_{2,}/g, "_") // Replace multiple underscores with single
        .replace(/^_+|_+$/g, "") // Remove leading/trailing underscores
        .substring(0, 50); // Limit length
}

export function sanitizeBranchName(branchName: string): string {
    return branchName
        .replace(/[^a-zA-Z0-9\-_\/]/g, "_") // Replace invalid characters
        .replace(/_{2,}/g, "_") // Replace multiple underscores with single
        .replace(/^_+|_+$/g, ""); // Remove leading/trailing underscores
}

export {};
