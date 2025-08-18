# Copilot Repository Instructions

These are the global instructions for working on the **Devotion CLI** project.  
Copilot must always follow these conventions and rules when generating code for this repository.

---

## General Rules

- Only implement the **explicitly requested requirements and code**.  
- **Do not invent or add features** beyond the given requirements.  
- Do not generate tests or placeholder code. Only production code is required.  
- All outputs in the CLI must be colorful and enhanced with emojis.  

---

## Libraries to Use

The following libraries must always be used where appropriate:

- `commander` (for CLI command handling)
- `chalk` (for colored CLI output)
- `inquirer` (for interactive prompts)
- `@notionhq/client` (for Notion API access)
- `octokit` (for GitHub API access)
- `simple-git` (for local Git operations)

---

## Project Structure

The repository must follow this structure:

- `index.ts`: Entry point of the CLI
- `utils.ts`: Utility/helper functions
- `constants.ts`: Global constants (statuses, branch prefixes, emojis, etc.)
- `models/`: Contains all TypeScript types and classes
- `services/`: Contains the following services:
  - `github.service.ts`
  - `notion.service.ts`
  - `git.service.ts`
  - `global-config.service.ts`
  - `local-config.service.ts`
- `commands/`: Each CLI command in its own file (e.g. `setup.ts`, `init.ts`, `dev.ts`, `review.ts`, `finish.ts`, `status.ts`)

---

## TypeScript Conventions

- Enable **strict mode** in `tsconfig.json`.
- Always use **async/await** (no `.then()` chains).
- All functions must be **fully typed** (no `any`).
- Functions returning asynchronous logic must return `Promise<...>`.
- Command handlers should always return `Promise<void>`.
- No magic strings → All statuses, branch prefixes, emojis, etc. must come from `constants.ts`.
- Prefer classes for services (e.g. `GitHubService`, `NotionService`).
- Utility functions belong in `utils.ts`.

---

## Naming Conventions

- **File names**: `kebab-case.ts` (e.g. `global-config.service.ts`).
- **Classes**: `PascalCase` (e.g. `GitHubService`).
- **Interfaces & Types**: `PascalCase` (e.g. `Ticket`, not `ITicket`).
- **Constants**: `UPPER_SNAKE_CASE`.

---

## CLI Output Conventions

- Success: `chalk.green("✅ Success message")`
- Info: `chalk.blue("ℹ️ Info message")`
- Warning: `chalk.yellow("⚠️ Warning")`
- Error: `chalk.red("❌ Error message")`

All command outputs must follow this style for consistency.

---

## Imports

- Always use **explicit imports** (no wildcard imports).
- Relative imports only within the project (`./` and `../`).
- **No index.ts files** inside folders - import directly from individual files.
- Import from files directly: `./services/github.service.ts` not `./services/index.ts`.

---

By following these rules, Copilot will generate consistent, clean, and production-ready TypeScript CLI code for the Devotion project.
