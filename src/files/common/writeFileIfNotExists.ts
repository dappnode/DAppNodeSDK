import fs from "fs";

export function writeFileIfNotExists(filePath: string, data: string): void {
    if (!fs.existsSync(filePath))
        fs.writeFileSync(filePath, data);
}
