import fs from 'fs';
import path from 'path';

export function createPackageDirectories(dir: string, variants: string[], variantsDir: string, templateMode: boolean): void {
    // Create package root dir
    fs.mkdirSync(dir, { recursive: true });

    // Create all variant dirs
    if (templateMode && variants) {
        fs.mkdirSync(path.join(dir, variantsDir), { recursive: true });

        for (const variant of variants) {
            fs.mkdirSync(path.join(dir, variantsDir, variant), { recursive: true });
        }
    }
}