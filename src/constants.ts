// Global constants for the Devotion CLI

// Validation patterns
export const NOTION_API_KEY_PATTERN = /^ntn_[a-zA-Z0-9]+$/;
export const GITHUB_API_KEY_PATTERN = /^ghp_[a-zA-Z0-9]+$/;
export const NOTION_DATABASE_ID_PATTERN = /^[a-f0-9]{32}$/;

// File paths
export const GLOBAL_CONFIG_DIR = "~/.config";
export const GLOBAL_CONFIG_FILE = "devotion.global.json";
export const LOCAL_CONFIG_FILE = ".devotion.json";

// Notion status values
export const PROJECT_STATUS_IN_PROGRESS = "🏗 In progress";
export const TICKET_STATUS_BACKLOG = "📋 Backlog";
export const TICKET_STATUS_IN_PROGRESS = "🏗 In progress";
export const TICKET_STATUS_IN_REVIEW = "👀 In review";

// Notion property names
export const NOTION_PROPERTY_STATUS = "Status";
export const NOTION_PROPERTY_DEVELOPMENT = "Development";
export const NOTION_PROPERTY_ENTWICKLUNG = "Entwicklung";
export const NOTION_PROPERTY_TYPE = "Type";
export const NOTION_PROPERTY_GITHUB_PULL_REQUEST = "GitHub Pull Request";

// Notion property types
export const NOTION_TYPE_TITLE = "title";
export const NOTION_TYPE_STATUS = "status";
export const NOTION_TYPE_RELATION = "relation";
export const NOTION_TYPE_SELECT = "select";
export const NOTION_TYPE_UNIQUE_ID = "unique_id";
export const NOTION_TYPE_CHILD_DATABASE = "child_database";

// Default values
export const DEFAULT_UNTITLED = "Untitled";
export const DEFAULT_UNKNOWN_STATUS = "Unknown";
export const DEFAULT_UNTITLED_DATABASE = "Untitled Database";
export const DEFAULT_UNKNOWN_ERROR = "Unknown error";

export const DEFAULT_DEVELOPMENT_BRANCH = "develop";

// User messages and prompts
export const MSG_PROJECT_NOT_INITIALIZED =
    "❌ Project not initialized. Run 'devotion init' first.";
export const MSG_FAILED_READ_CONFIG =
    "❌ Failed to read project configuration.";
export const MSG_NOT_GIT_REPOSITORY =
    "❌ Current directory is not a git repository.";
export const MSG_GLOBAL_CONFIG_NOT_FOUND =
    "❌ Global configuration not found. Run 'devotion setup' first.";
export const MSG_LOADING_TICKETS = "ℹ️  Loading tickets from Notion...";
export const MSG_NO_TICKETS_FOUND =
    "⚠️  No tickets found with status '📋 Backlog' or '🏗 In progress'.";
export const MSG_TICKET_NO_ID = "❌ Selected ticket does not have a ticket ID.";
export const MSG_CHECKING_BRANCHES = "ℹ️  Checking for existing branches...";
export const MSG_PULLING_CHANGES = "ℹ️  Pulling latest changes...";
export const MSG_NO_EXISTING_BRANCH =
    "ℹ️  No existing branch found. Creating new branch...";
export const MSG_PUSHING_BRANCH = "ℹ️  Pushing branch to remote...";
export const MSG_UPDATING_TICKET_STATUS = "ℹ️  Updating ticket status...";
export const MSG_READY_TO_DEVELOP = "✅ Ready to start development!";

// Init command messages
export const MSG_PROJECT_ALREADY_INITIALIZED =
    "ℹ️  Project is already initialized!";
export const MSG_INIT_STATUS_HELP =
    "   Use 'devotion init status' to view current configuration";
export const MSG_INIT_EDIT_HELP =
    "   Use 'devotion init edit' to modify configuration";
export const MSG_FAILED_READ_GLOBAL_CONFIG =
    "❌ Failed to read global configuration.";
export const MSG_INITIALIZING_PROJECT =
    "ℹ️  Initializing project configuration...";
export const MSG_FETCHING_PROJECTS = "   Fetching projects from Notion...";
export const MSG_NO_IN_PROGRESS_PROJECTS =
    "⚠️  No projects with status '🏗 In progress' found.";
export const MSG_FINDING_TICKETS_DB = "   Finding tickets database...";
export const MSG_NO_TICKETS_DB_FOUND =
    "❌ Could not find tickets database in Development or Entwicklung relation.";
export const MSG_ANALYZING_TICKETS_DB =
    "   Analyzing tickets database schema...";
export const MSG_NO_UNIQUE_ID_PREFIX =
    "❌ Could not find unique_id property with prefix in tickets database.";
export const MSG_INIT_COMPLETE = "✅ Project initialization complete!";
export const MSG_NO_PROJECT_CONFIG =
    "❌ No project configuration found. Run 'devotion init' first.";
export const MSG_FAILED_READ_PROJECT_CONFIG =
    "❌ Failed to read project configuration file.";
export const MSG_CURRENT_PROJECT_CONFIG = "ℹ️  Current project configuration:";
export const MSG_EDIT_PROJECT_CONFIG = "ℹ️  Edit project configuration";
export const MSG_LEAVE_BLANK_TO_KEEP =
    "   Leave blank to keep current value:\n";
export const MSG_PROJECT_CONFIG_UPDATED =
    "✅ Project configuration updated successfully!";

// MR command messages
export const MSG_CURRENT_BRANCH = "ℹ️  Current branch: ";
export const MSG_COULD_NOT_DETERMINE_BRANCH =
    "❌ Could not determine current branch.";
export const MSG_COULD_NOT_EXTRACT_TICKET_ID =
    "❌ Could not extract ticket ID from branch name. Expected format: <prefix>/<TICKET_ID>_<description>";
export const MSG_EXTRACTED_TICKET_ID = "ℹ️  Extracted ticket ID: ";
export const MSG_COULD_NOT_FIND_TICKET = "❌ Could not find ticket with ID: ";
export const MSG_FOUND_TICKET = "ℹ️  Found ticket: ";
export const MSG_PUSHING_CURRENT_BRANCH =
    "ℹ️  Pushing current branch to remote...";
export const MSG_COULD_NOT_DETERMINE_REPO =
    "❌ Could not determine GitHub repository information.";
export const MSG_REPOSITORY_INFO = "ℹ️  Repository: ";
export const MSG_PR_ALREADY_EXISTS = "⚠️  Pull request already exists: ";
export const MSG_UPDATING_TO_IN_REVIEW =
    "ℹ️  Updating ticket status to In review...";
export const MSG_TICKET_SET_TO_IN_REVIEW =
    "ℹ️  Ticket ${ticketId} set to In review";
export const MSG_CREATING_PR = "ℹ️  Creating pull request...";
export const MSG_OPENED_PR = "✅ Opened PR: ";
export const MSG_PR_URL = "   URL: ";
export const MSG_COULD_NOT_OPEN_PR = "❌ Could not open PR: ";

// Setup command messages
export const MSG_SETUP_ALREADY_COMPLETE = "ℹ️  Setup is already complete!";
export const MSG_SETUP_STATUS_HELP =
    "   Use 'devotion setup status' to view current configuration";
export const MSG_SETUP_EDIT_HELP =
    "   Use 'devotion setup edit' to modify configuration";
export const MSG_WELCOME_TO_SETUP = "ℹ️  Welcome to Devotion CLI setup!";
export const MSG_PROVIDE_CONFIG_VALUES =
    "   Please provide the following configuration values:\n";
export const MSG_SETUP_COMPLETE =
    "✅ Setup complete! Configuration saved successfully.";
export const MSG_SETUP_FAILED = "❌ Setup failed: ";
export const MSG_NO_SETUP_CONFIG =
    "❌ No configuration found. Run 'devotion setup' first.";
export const MSG_FAILED_READ_SETUP_CONFIG =
    "❌ Failed to read configuration file.";
export const MSG_CURRENT_CLI_CONFIG = "ℹ️  Current Devotion CLI configuration:";
export const MSG_EDIT_CLI_CONFIG = "ℹ️  Edit Devotion CLI configuration";
export const MSG_SETUP_CONFIG_UPDATED =
    "✅ Configuration updated successfully!";
export const MSG_FAILED_UPDATE_SETUP_CONFIG =
    "❌ Failed to update configuration: ";

// Validation messages
export const VALIDATION_NOTION_API_KEY =
    'Invalid Notion API key. Must start with "ntn_" followed by alphanumeric characters.';
export const VALIDATION_GITHUB_API_KEY =
    'Invalid GitHub API key. Must start with "ghp_".';
export const VALIDATION_DATABASE_ID =
    "Invalid database ID. Must be exactly 32 hexadecimal characters.";
export const VALIDATION_DESCRIPTION_EMPTY = "Description cannot be empty";

// Prompt messages
export const PROMPT_NOTION_API_KEY =
    "Enter your Notion API key (must start with ntn_ followed by alphanumeric characters):";
export const PROMPT_GITHUB_API_KEY =
    "Enter your GitHub API key (must start with ghp_):";
export const PROMPT_NOTION_DB_ID =
    "Enter your Notion projects database ID (32 hexadecimal characters):";
export const PROMPT_SELECT_PROJECT = "Select a project:";
export const PROMPT_DEVELOPMENT_BRANCH = "Development branch name:";
export const PROMPT_NOTION_API_KEY_EDIT = "Notion API key (current: ****):";
export const PROMPT_GITHUB_API_KEY_EDIT = "GitHub API key (current: ****):";

// Generic error messages
export const MSG_INITIALIZATION_FAILED = "❌ Initialization failed: ";
export const MSG_FAILED_UPDATE_CONFIG = "❌ Failed to update configuration: ";

// Default/fallback values
export const DEFAULT_UNKNOWN = "Unknown";

// GitHub service constants
export const GITHUB_HTTPS_PREFIX = "https://github.com/";
export const GITHUB_SSH_PREFIX = "git@github.com:";
export const GIT_REMOTE_COMMAND = "git remote get-url origin";
export const GIT_ENCODING = "utf8";
export const PR_STATE_OPEN = "open";

// GitHub URL patterns
export const GITHUB_HTTPS_PATTERN =
    /https:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/;
export const GITHUB_SSH_PATTERN =
    /git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/;

// GitHub error messages
export const ERROR_GETTING_REPO_INFO = "Error getting repository info:";
export const ERROR_CHECKING_EXISTING_PR = "Error checking for existing PR:";
export const ERROR_CREATE_PR = "Failed to create pull request: ";

export {};
