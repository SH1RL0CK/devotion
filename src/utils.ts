// Utility functions and helpers

export function extractTicketIdFromBranchName(
    branchName: string
): string | null {
    // Extract ticket ID between / and _
    // Example: feature/CAGW-19_page_projects -> CAGW-19
    // Specifically looking for pattern like prefix-number (e.g., CAGW-19)
    const match = branchName.match(/\/([A-Za-z]+-\d+)_/);
    return match ? match[1] : null;
}

// Convert Notion colors to GitHub label colors
export function convertNotionColorToGitHub(notionColor: string): string {
    // GitHub uses hex colors without the # prefix
    const colorMap: Record<string, string> = {
        // Default colors in Notion
        blue: "0075ca",
        brown: "a52a2a",
        default: "ededed",
        gray: "949494",
        green: "0e8a16",
        orange: "ff6b00",
        pink: "ff5eb4",
        purple: "6f42c1",
        red: "ca3431",
        yellow: "fbca04",
    };

    return colorMap[notionColor.toLowerCase()] || "ededed"; // Default to light gray if color not found
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
