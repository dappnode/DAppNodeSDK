import { defaultManifestFileName, defaultVariantsDir } from "../../params";
import { VariantManifestMap } from "./types";
import path from "path";
import fs from "fs";
import { readManifest } from "./readManifest";

export function readVariantManifests({
    dir,
    variantsDir = defaultVariantsDir,
    variants,
    manifestFileName = defaultManifestFileName
}: {
    dir: string;
    variantsDir: string;
    variants?: string[];
    manifestFileName?: string;
}): VariantManifestMap {
    const variantsMap: VariantManifestMap = {};
    const fullVariantsDirPath = path.join(dir, variantsDir);
    const allVariants = getAllDirectoryNamesInPath(fullVariantsDirPath);

    const { validVariants, invalidVariants } = validateVariants(variants, allVariants);

    if (invalidVariants.length)
        throw new Error(`Invalid variants: ${invalidVariants.join(", ")}`);

    validVariants.forEach(variant => {
        const variantManifestPath = path.join(fullVariantsDirPath, variant, manifestFileName);

        if (!fs.existsSync(variantManifestPath))
            throw new Error(`Manifest not found for variant '${variant}' at ${variantManifestPath}`);

        variantsMap[variant] = readManifest({ dir: path.dirname(variantManifestPath), manifestFileName });
    });

    return variantsMap;
}

function validateVariants(variants: string[] | undefined, allVariants: string[]): { validVariants: string[], invalidVariants: string[] } {
    if (!variants) {
        return { validVariants: allVariants, invalidVariants: [] };
    }

    // We could use reduce here, but it's much less readable
    const validVariants = variants.filter(variant => allVariants.includes(variant));
    const invalidVariants = variants.filter(variant => !allVariants.includes(variant));

    return { validVariants, invalidVariants };
}

function getAllDirectoryNamesInPath(directoryPath: string): string[] {
    try {
        return fs.readdirSync(directoryPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
    } catch (error) {
        console.error(`Error reading directory at ${directoryPath}: `, error);
        throw error;
    }
}
