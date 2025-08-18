import { promises as fs } from "fs";
import { join } from "path";
import { LOCAL_CONFIG_FILE } from "../constants.js";
import { LocalConfig } from "../models/config.js";

export class LocalConfigService {
    private configPath: string;

    constructor(projectRoot: string = process.cwd()) {
        this.configPath = join(projectRoot, LOCAL_CONFIG_FILE);
    }

    async exists(): Promise<boolean> {
        try {
            await fs.access(this.configPath);
            return true;
        } catch {
            return false;
        }
    }

    async read(): Promise<LocalConfig | null> {
        try {
            const content = await fs.readFile(this.configPath, "utf-8");
            return JSON.parse(content) as LocalConfig;
        } catch {
            return null;
        }
    }

    async write(config: LocalConfig): Promise<void> {
        await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
    }
}
