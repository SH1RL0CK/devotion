// Global constants for the Devotion CLI

// Validation patterns
export const NOTION_API_KEY_PATTERN = /^ntn_[a-zA-Z0-9]+$/;
export const GITHUB_API_KEY_PATTERN = /^ghp_[a-zA-Z0-9]+$/;
export const NOTION_DATABASE_ID_PATTERN = /^[a-f0-9]{32}$/;

// File paths
export const GLOBAL_CONFIG_DIR = "~/.config";
export const GLOBAL_CONFIG_FILE = "devotion.global.json";
export const LOCAL_CONFIG_FILE = ".devotion.json";

// Notion constants
export const PROJECT_STATUS_IN_PROGRESS = "🏗 In progress";
export const DEFAULT_DEVELOPMENT_BRANCH = "develop";

export {};
