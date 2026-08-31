import { exec } from "node:child_process";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import {
    DEFAULT_UNKNOWN,
    DEFAULT_UNKNOWN_ERROR,
    MSG_FAILED_READ_CONFIG,
    MSG_FETCHING_TICKET,
    MSG_GLOBAL_CONFIG_NOT_FOUND,
    MSG_NO_TICKETS_AVAILABLE,
    MSG_PROJECT_NOT_INITIALIZED,
    MSG_TICKET_NOT_FOUND,
    PROMPT_SELECT_TICKET_TO_VIEW,
} from "../constants.js";
import { NotionTicket } from "../models/notion.js";
import { GitService } from "../services/git.service.js";
import { GlobalConfigService } from "../services/global-config.service.js";
import { LocalConfigService } from "../services/local-config.service.js";
import { NotionService } from "../services/notion.service.js";
import { extractTicketIdFromBranchName } from "../utils.js";

const localConfigService = new LocalConfigService();
const globalConfigService = new GlobalConfigService();

function openInBrowser(url: string): void {
    const start =
        process.platform === "darwin"
            ? "open"
            : process.platform === "win32"
            ? "start"
            : "xdg-open";
    exec(`${start} "${url}"`, (error) => {
        if (error) {
            console.error(chalk.yellow(`Could not open browser: ${error.message}`));
        }
    });
}

function renderRichText(richText: any[], raw: boolean = false): string {
    if (!richText || !Array.isArray(richText)) return "";
    return richText
        .map((item) => {
            const text = item.plain_text || item.text?.content || "";
            if (raw) return text;
            let formatted = text;
            if (item.annotations) {
                if (item.annotations.bold) formatted = chalk.bold(formatted);
                if (item.annotations.italic) formatted = chalk.italic(formatted);
                if (item.annotations.strikethrough)
                    formatted = chalk.strikethrough(formatted);
                if (item.annotations.underline)
                    formatted = chalk.underline(formatted);
                if (item.annotations.code)
                    formatted = chalk.bgGray.black(` ${formatted} `);
            }
            if (item.href) {
                formatted = chalk.cyan.underline(formatted);
            }
            return formatted;
        })
        .join("");
}

function renderBlocks(
    blocks: any[],
    indentLevel: number = 0,
    raw: boolean = false
): string {
    const lines: string[] = [];
    const indent = "  ".repeat(indentLevel);
    let numberedIndex = 1;

    for (const block of blocks) {
        const type = block.type;

        if (type !== "numbered_list_item") {
            numberedIndex = 1;
        }

        switch (type) {
            case "paragraph": {
                const text = renderRichText(block.paragraph?.rich_text, raw);
                lines.push(`${indent}${text}`);
                break;
            }
            case "heading_1": {
                const text = renderRichText(block.heading_1?.rich_text, raw);
                lines.push("");
                lines.push(raw ? `# ${text}` : chalk.bold.cyan(`# ${text}`));
                break;
            }
            case "heading_2": {
                const text = renderRichText(block.heading_2?.rich_text, raw);
                lines.push("");
                lines.push(raw ? `## ${text}` : chalk.bold.blue(`## ${text}`));
                break;
            }
            case "heading_3": {
                const text = renderRichText(block.heading_3?.rich_text, raw);
                lines.push("");
                lines.push(raw ? `### ${text}` : chalk.bold.magenta(`### ${text}`));
                break;
            }
            case "bulleted_list_item": {
                const text = renderRichText(
                    block.bulleted_list_item?.rich_text,
                    raw
                );
                const bullet = raw ? "-" : chalk.cyan("•");
                lines.push(`${indent}${bullet} ${text}`);
                break;
            }
            case "numbered_list_item": {
                const text = renderRichText(
                    block.numbered_list_item?.rich_text,
                    raw
                );
                const num = raw
                    ? `${numberedIndex}.`
                    : chalk.yellow(`${numberedIndex}.`);
                lines.push(`${indent}${num} ${text}`);
                numberedIndex++;
                break;
            }
            case "to_do": {
                const checked = block.to_do?.checked;
                const text = renderRichText(block.to_do?.rich_text, raw);
                const box = raw
                    ? checked
                        ? "[x]"
                        : "[ ]"
                    : checked
                    ? chalk.green("✔ [x]")
                    : chalk.gray("☐ [ ]");
                const formattedText =
                    checked && !raw ? chalk.strikethrough.gray(text) : text;
                lines.push(`${indent}${box} ${formattedText}`);
                break;
            }
            case "toggle": {
                const text = renderRichText(block.toggle?.rich_text, raw);
                const icon = raw ? ">" : chalk.blue("▼");
                lines.push(`${indent}${icon} ${text}`);
                break;
            }
            case "code": {
                const text = renderRichText(block.code?.rich_text, true);
                const lang = block.code?.language || "";
                lines.push("");
                if (raw) {
                    lines.push(`\`\`\`${lang}\n${text}\n\`\`\``);
                } else {
                    lines.push(
                        chalk.gray(
                            `┌─ [${lang || "code"}] ─────────────────────────`
                        )
                    );
                    lines.push(chalk.hex("#e0e0e0")(text));
                    lines.push(
                        chalk.gray(
                            "└────────────────────────────────────────"
                        )
                    );
                }
                break;
            }
            case "quote": {
                const text = renderRichText(block.quote?.rich_text, raw);
                lines.push(
                    raw
                        ? `> ${text}`
                        : `${indent}${chalk.gray("│")} ${chalk.italic(text)}`
                );
                break;
            }
            case "callout": {
                const icon = block.callout?.icon?.emoji || "💡";
                const text = renderRichText(block.callout?.rich_text, raw);
                lines.push("");
                if (raw) {
                    lines.push(`[${icon}] ${text}`);
                } else {
                    lines.push(
                        chalk.bgBlue.black(` ${icon} `) + ` ${text}`
                    );
                }
                break;
            }
            case "divider": {
                lines.push("");
                lines.push(
                    raw
                        ? "---"
                        : chalk.gray(
                              "──────────────────────────────────────────────────"
                          )
                );
                break;
            }
            case "bookmark": {
                const url = block.bookmark?.url || "";
                lines.push(
                    `${indent}🔗 ${raw ? url : chalk.underline.cyan(url)}`
                );
                break;
            }
            case "image": {
                const url =
                    block.image?.file?.url ||
                    block.image?.external?.url ||
                    "";
                lines.push(`${indent}🖼️  [Image: ${url}]`);
                break;
            }
            case "table_row": {
                const cells =
                    block.table_row?.cells
                        ?.map((c: any[]) => renderRichText(c, raw))
                        .join(" | ") || "";
                lines.push(`${indent}| ${cells} |`);
                break;
            }
            default: {
                if (block[type]?.rich_text) {
                    const text = renderRichText(block[type].rich_text, raw);
                    if (text) lines.push(`${indent}${text}`);
                }
                break;
            }
        }

        if (block.children && block.children.length > 0) {
            const childText = renderBlocks(
                block.children,
                indentLevel + 1,
                raw
            );
            if (childText) {
                lines.push(childText);
            }
        }
    }

    return lines.join("\n");
}

async function promptForTicketSelection(
    tickets: NotionTicket[]
): Promise<string> {
    const choices = tickets.map((ticket) => ({
        name: `${ticket.ticketId || DEFAULT_UNKNOWN} - ${ticket.title} (${
            ticket.status
        })`,
        value: ticket.id,
    }));

    const answer = await inquirer.prompt([
        {
            type: "list" as const,
            name: "ticketId" as const,
            message: PROMPT_SELECT_TICKET_TO_VIEW,
            choices,
            pageSize: 15,
        },
    ]);

    return answer.ticketId;
}

interface TicketCommandOptions {
    json?: boolean;
    raw?: boolean;
    open?: boolean;
}

export async function ticketCommand(
    ticketIdArg?: string,
    options: TicketCommandOptions = {}
): Promise<void> {
    try {
        // 1. Check local project config
        const configExists = await localConfigService.exists();
        if (!configExists) {
            console.error(chalk.red(MSG_PROJECT_NOT_INITIALIZED));
            process.exit(1);
        }

        const localConfig = await localConfigService.read();
        if (!localConfig) {
            console.error(chalk.red(MSG_FAILED_READ_CONFIG));
            process.exit(1);
        }

        // 2. Check global config
        const globalConfig = await globalConfigService.read();
        if (!globalConfig) {
            console.error(chalk.red(MSG_GLOBAL_CONFIG_NOT_FOUND));
            process.exit(1);
        }

        const notionService = new NotionService(globalConfig.notionApiKey);
        let targetTicket: NotionTicket | null = null;

        // 3. Determine ticket
        if (ticketIdArg) {
            if (!options.json) {
                console.log(chalk.blue(MSG_FETCHING_TICKET));
            }
            targetTicket = await notionService.findTicketByTicketId(
                localConfig.ticketsDatabaseId,
                ticketIdArg
            );

            // Fallback: direct page ID lookup if not found in database query
            if (!targetTicket && ticketIdArg.length >= 32) {
                targetTicket = await notionService.getTicketPage(ticketIdArg);
            }

            if (!targetTicket) {
                console.error(
                    chalk.red(`${MSG_TICKET_NOT_FOUND}${ticketIdArg}`)
                );
                process.exit(1);
            }
        } else {
            // Check if current git branch contains a ticket ID
            const gitService = new GitService();
            const isGitRepo = await gitService.isGitRepository();

            if (isGitRepo) {
                const currentBranch = await gitService.getCurrentBranch();
                if (currentBranch) {
                    const branchTicketId =
                        extractTicketIdFromBranchName(currentBranch);
                    if (branchTicketId) {
                        if (!options.json) {
                            console.log(
                                chalk.blue(
                                    `ℹ️  Detected ticket ${branchTicketId} from current branch (${currentBranch})`
                                )
                            );
                            console.log(chalk.blue(MSG_FETCHING_TICKET));
                        }
                        targetTicket =
                            await notionService.findTicketByTicketId(
                                localConfig.ticketsDatabaseId,
                                branchTicketId
                            );
                    }
                }
            }

            // If still no ticket determined, prompt the user
            if (!targetTicket) {
                if (!options.json) {
                    console.log(
                        chalk.blue("ℹ️  Loading tickets from Notion...")
                    );
                }
                const tickets = await notionService.getAllTickets(
                    localConfig.ticketsDatabaseId
                );

                if (tickets.length === 0) {
                    console.error(chalk.yellow(MSG_NO_TICKETS_AVAILABLE));
                    process.exit(1);
                }

                const selectedId = await promptForTicketSelection(tickets);
                targetTicket = tickets.find((t) => t.id === selectedId) || null;

                if (!targetTicket) {
                    console.error(
                        chalk.red("❌ Failed to resolve selected ticket.")
                    );
                    process.exit(1);
                }
            }
        }

        // Open in browser if requested
        if (options.open && targetTicket.url) {
            openInBrowser(targetTicket.url);
            console.log(
                chalk.green(`🌐 Opened ticket in browser: ${targetTicket.url}`)
            );
        }

        // 4. Fetch page blocks (ticket description / body)
        const blocks = await notionService.getPageBlocks(targetTicket.id);

        // 5. Output JSON if requested
        if (options.json) {
            console.log(
                JSON.stringify(
                    {
                        ticket: targetTicket,
                        blocks,
                    },
                    null,
                    2
                )
            );
            return;
        }

        // 6. Display ticket info and formatted content
        const raw = !!options.raw;
        const ticketIdDisplay = targetTicket.ticketId || "No ID";

        console.log("");
        if (raw) {
            console.log(`========================================`);
            console.log(`🎫 [${ticketIdDisplay}] ${targetTicket.title}`);
            console.log(`========================================`);
            console.log(`Status:      ${targetTicket.status}`);
            if (targetTicket.type) {
                console.log(`Type:        ${targetTicket.type}`);
            }
            if (targetTicket.assignee) {
                console.log(`Assignee:    ${targetTicket.assignee}`);
            }
            if (targetTicket.url) {
                console.log(`Notion URL:  ${targetTicket.url}`);
            }
            if (targetTicket.githubPrUrl) {
                console.log(`GitHub PR:   ${targetTicket.githubPrUrl}`);
            }
            console.log(`----------------------------------------\n`);
        } else {
            console.log(
                chalk.bold.hex("#3b82f6")(
                    `┌────────────────────────────────────────────────────────────`
                )
            );
            console.log(
                chalk.bold.hex("#3b82f6")(`│ `) +
                    chalk.bold.white(`🎫 [${ticketIdDisplay}] `) +
                    chalk.bold.cyan(targetTicket.title)
            );
            console.log(
                chalk.bold.hex("#3b82f6")(
                    `└────────────────────────────────────────────────────────────`
                )
            );
            console.log(
                `  ${chalk.gray("Status:")}      ${chalk.yellow(
                    targetTicket.status
                )}`
            );
            if (targetTicket.type) {
                console.log(
                    `  ${chalk.gray("Type:")}        ${chalk.magenta(
                        targetTicket.type
                    )}`
                );
            }
            if (targetTicket.assignee) {
                console.log(
                    `  ${chalk.gray("Assignee:")}    ${chalk.green(
                        targetTicket.assignee
                    )}`
                );
            }
            if (targetTicket.url) {
                console.log(
                    `  ${chalk.gray("Notion URL:")}  ${chalk.underline.cyan(
                        targetTicket.url
                    )}`
                );
            }
            if (targetTicket.githubPrUrl) {
                console.log(
                    `  ${chalk.gray("GitHub PR:")}   ${chalk.underline.blue(
                        targetTicket.githubPrUrl
                    )}`
                );
            }
            console.log(
                chalk.gray(
                    `\n────────────────────────────────────────────────────────────\n`
                )
            );
        }

        // Render description property if present and no blocks
        if (targetTicket.description) {
            console.log(targetTicket.description);
            console.log("");
        }

        // Render page blocks
        if (blocks.length > 0) {
            const renderedContent = renderBlocks(blocks, 0, raw);
            console.log(renderedContent);
        } else if (!targetTicket.description) {
            console.log(
                raw
                    ? "(No description or body content for this ticket)"
                    : chalk.italic.gray(
                          "(No description or body content for this ticket)"
                      )
            );
        }
        console.log("");
    } catch (error) {
        console.error(
            chalk.red(
                `❌ Failed to view ticket: ${
                    error instanceof Error
                        ? error.message
                        : DEFAULT_UNKNOWN_ERROR
                }`
            )
        );
        process.exit(1);
    }
}

export function registerTicketCommand(program: Command): void {
    program
        .command("ticket [ticketId]")
        .alias("show")
        .alias("view")
        .description("Read and display ticket details and description from Notion")
        .option("-j, --json", "Output ticket details and blocks as JSON")
        .option("-r, --raw", "Output without ANSI styles (plain text/markdown)")
        .option("-o, --open", "Open the ticket in the browser")
        .action(
            async (
                ticketId: string | undefined,
                options: TicketCommandOptions
            ) => {
                await ticketCommand(ticketId, options);
            }
        );
}
