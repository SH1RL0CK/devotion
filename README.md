# Devotion

A powerful CLI tool that seamlessly connects Notion, GitHub, and local Git projects to streamline my development workflow.

## 🚀 Features

- **Notion Integration**: Manage tickets and projects directly from your Notion workspace
- **GitHub Integration**: Automatically create and manage pull requests
- **Git Workflow**: Streamlined branch management and ticket tracking
- **User Assignment**: Automatically assign tickets to users during development
- **Status Synchronization**: Keep ticket statuses in sync across platforms

## 📋 Prerequisites

Before using Devotion, you'll need:

1. **Notion API Key**: Create an integration at [Notion Developers](https://developers.notion.com/)
2. **GitHub API Token**: Generate a personal access token in your [GitHub Settings](https://github.com/settings/tokens)
3. **Notion Database Structure**: A two-level database setup in Notion

### Notion Database Setup

Devotion uses a two-level database structure:

#### 1. Projects Database (Main Database)

This is the main database that contains all your projects. Configure it during global setup (`devotion setup`).

#### 2. Tickets Databases (Per Project)

Each project has its own tickets database, typically embedded as a child database within the project page. These are configured during project initialization (`devotion init`).

**Tickets Database Properties:**

- **Status** (Status type): For tracking ticket progress
- **Type** (Select type): For categorizing tickets (e.g., Bug, Feature)
- **Assign** (People type): For user assignment
- **GitHub Pull Request** (URL type): For linking PRs
- **ID** (Unique ID type): For ticket identification

## 🛠️ Installation

Clone the repository and build the project:

```bash
git clone https://github.com/SH1RL0CK/devotion.git
cd devotion
pnpm install
pnpm build
```

Install globally for system-wide usage:

```bash
npm install -g .
```

After global installation, use the CLI directly:

```bash
devotion [command]
```

Or run directly without global installation:

```bash
node dist/index.js [command]
```

## ⚙️ Configuration

### Global Setup

Configure your global settings (API keys, user account):

```bash
devotion setup
```

This will prompt you to:

1. Enter your Notion API key
2. Enter your GitHub API token
3. Enter your Notion projects database ID
4. Select your user account from your Notion workspace

View current configuration:

```bash
devotion setup status
```

Edit existing configuration:

```bash
devotion setup edit
```

### Project Initialization

For each project repository, initialize project-specific settings:

```bash
devotion init
```

This will:

1. Connect to your Notion workspace
2. Let you select a project
3. Configure the tickets database
4. Set up the development branch

View project configuration:

```bash
devotion init status
```

Edit project configuration:

```bash
devotion init edit
```

## 🎯 Workflow Commands

### Start Development

Begin working on a ticket:

```bash
devotion dev
```

This command will:

1. Fetch available tickets from Notion
2. Let you select a ticket to work on
3. Create or switch to the appropriate Git branch
4. Update ticket status to "In Progress"
5. Assign the ticket to your configured user
6. Pull latest changes if switching to existing branch

### Create Pull Request

Open a pull request for your current work:

```bash
devotion pr
```

This command will:

1. Identify the current ticket from the branch name
2. Push your changes to the remote repository
3. Create a GitHub pull request
4. Update the Notion ticket with the PR link

### View Ticket Content

Read and display the contents and description of a ticket:

```bash
# View ticket associated with the current branch
devotion ticket

# View a specific ticket by ID
devotion ticket PROJ-123

# Aliases: show, view
devotion show PROJ-123
devotion view

# Options:
# -j, --json: Output as JSON
# -r, --raw:  Output in plain text/markdown without ANSI colors
# -o, --open: Open ticket directly in browser
devotion ticket PROJ-123 --open
```

This command will:

1. Identify the ticket (from argument, current Git branch, or interactive selection)
2. Fetch ticket properties (Title, Status, Type, Assignee, Notion URL, PR URL)
3. Recursively fetch and render Notion blocks (Headings, Paragraphs, Lists, To-dos, Code blocks, Quotes, Callouts, etc.) formatted for the terminal

### Finish Work

Complete your work and clean up:

```bash
devotion finish
```

This command will:

1. Merge the pull request
2. Clean up local and remote branches
3. Mark the ticket as "Done" in Notion
4. Switch back to the development branch

## 🏗️ Project Structure

```
devotion/
├── src/
│   ├── commands/          # CLI command implementations
│   │   ├── setup.ts       # Global configuration
│   │   ├── init.ts        # Project initialization
│   │   ├── dev.ts         # Development workflow
│   │   ├── ticket.ts      # Ticket content viewer
│   │   ├── pr.ts          # Pull request creation
│   │   └── finish.ts      # Work completion
│   ├── services/          # External service integrations
│   │   ├── notion.service.ts       # Notion API integration
│   │   ├── github.service.ts       # GitHub API integration
│   │   ├── git.service.ts          # Git operations
│   │   ├── global-config.service.ts # Global settings
│   │   └── local-config.service.ts  # Project settings
│   ├── models/            # Type definitions
│   │   ├── config.ts      # Configuration interfaces
│   │   ├── notion.ts      # Notion data models
│   │   └── github.ts      # GitHub data models
│   ├── constants.ts       # Application constants
│   ├── utils.ts           # Utility functions
│   └── index.ts           # CLI entry point
├── package.json
└── README.md
```

## 🔧 Configuration Files

Devotion stores configuration in the following locations:

- **Global Config**: `~/.devotion/config.json` - Contains API keys and user settings
- **Local Config**: `.devotion/config.json` - Project-specific settings (in your repo)

## 🎨 Branch Naming Convention

Devotion automatically creates branches following this pattern:

```
{type}/{ticket-id}_{description}
```

Examples:

- `feature/PROJ-123_user_authentication`
- `bugfix/PROJ-456_fix_login_issue`
- `doc/PROJ-789_update_documentation`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Troubleshooting

### Common Issues

**"Global configuration not found"**

- Run `devotion setup` to configure your API keys and user settings

**"User ID not configured"**

- Run `devotion setup edit` and select your user from the list

**"Project not initialized"**

- Run `devotion init` in your project repository

**"No tickets found"**

- Ensure your Notion database has tickets with "Backlog" or "In Progress" status
- Verify your Notion API integration has access to the database

**API Connection Issues**

- Verify your API keys are correct and have appropriate permissions
- Check that your Notion integration is connected to the right workspace
- Ensure your GitHub token has repo permissions

### Getting Help

If you encounter issues:

1. Check the configuration with `devotion setup status` and `devotion init status`
2. Verify your Notion database structure matches the requirements
3. Ensure your API keys have the necessary permissions
4. Check that you're in a Git repository when running commands

## 📚 API References

- [Notion API Documentation](https://developers.notion.com/reference)
- [GitHub REST API](https://docs.github.com/en/rest)
- [Git Documentation](https://git-scm.com/doc)

---

[![Vibe coded with GitHub Copilot](https://img.shields.io/badge/Vibe%20coded%20with-GitHub%20Copilot-000000?style=for-the-badge&logo=githubcopilot&logoColor=white&labelColor=000000&color=blue)](https://github.com/features/copilot)
