import { promises as fs } from "fs";
import { homedir } from "os";
import { join } from "path";
import {
    GITHUB_API_KEY_PATTERN,
    GLOBAL_CONFIG_DIR,
    GLOBAL_CONFIG_FILE,
    NOTION_API_KEY_PATTERN,
    NOTION_DATABASE_ID_PATTERN,
    NOTION_USER_ID_PATTERN,
} from "../constants.js";
import { GlobalConfig, MaskedGlobalConfig } from "../models/config.js";

export class GlobalConfigService {
    private configPath: string;

    constructor() {
        const configDir = GLOBAL_CONFIG_DIR.replace("~", homedir());
        this.configPath = join(configDir, GLOBAL_CONFIG_FILE);
    }

    async exists(): Promise<boolean> {
        try {
            await fs.access(this.configPath);
            return true;
        } catch {
            return false;
        }
    }

    async read(): Promise<GlobalConfig | null> {
        try {
            const content = await fs.readFile(this.configPath, "utf-8");
            const config = JSON.parse(content) as any;

            // Handle backward compatibility for configs without userId
            if (!config.userId) {
                return {
                    notionApiKey: config.notionApiKey || "",
                    githubApiKey: config.githubApiKey || "",
                    notionProjectsDbId: config.notionProjectsDbId || "",
                    userId: "", // Default empty value - user will need to set this
                } as GlobalConfig;
            }

            return config as GlobalConfig;
        } catch {
            return null;
        }
    }

    async write(config: GlobalConfig): Promise<void> {
        const configDir = join(this.configPath, "..");
        await fs.mkdir(configDir, { recursive: true });
        await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
    }

    validateNotionApiKey(key: string): boolean {
        return NOTION_API_KEY_PATTERN.test(key);
    }

    validateGithubApiKey(key: string): boolean {
        return GITHUB_API_KEY_PATTERN.test(key);
    }

    validateNotionDatabaseId(id: string): boolean {
        return NOTION_DATABASE_ID_PATTERN.test(id);
    }

    validateUserId(id: string): boolean {
        return NOTION_USER_ID_PATTERN.test(id);
    }

    maskConfig(config: GlobalConfig): MaskedGlobalConfig {
        return {
            notionApiKey: this.maskApiKey(config.notionApiKey),
            githubApiKey: this.maskApiKey(config.githubApiKey),
            notionProjectsDbId: config.notionProjectsDbId,
            userId: config.userId,
        };
    }

    private maskApiKey(key: string): string {
        if (key.length <= 8) return key;
        const prefix = key.substring(0, 4);
        const suffix = key.substring(key.length - 4);
        const masked = "*".repeat(key.length - 8);
        return `${prefix}${masked}${suffix}`;
    }
}
