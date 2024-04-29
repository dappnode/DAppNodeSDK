import chalk from "chalk";
import { getAllVariantsInPath } from "../../files/variants/getAllPackageVariants.js";

/**
 * Main function to retrieve the valid variant names based on the specified variants and available directories.
 */
export function getVariantNames({ variantsDirPath, variants }: { variantsDirPath: string; variants?: string }): string[] {
    const allVariantNames = getAllVariantsInPath(variantsDirPath);

    if (!variants) {
        console.log(chalk.dim(`Building all available variants: ${allVariantNames.join(", ")}`));
        return allVariantNames;
    }

    const specifiedVariantNames = parseVariants(variants);
    const { validVariants, invalidVariants } = validateVariants(specifiedVariantNames, allVariantNames);

    if (invalidVariants.length > 0)
        console.error(chalk.red(`Warning: Some specified variants are not valid and will be ignored. Allowed variants: ${allVariantNames.join(", ")}`));

    return validVariants;
}

/**
 * Parses and trims the comma-separated variant names from the input.
 */
function parseVariants(variants: string): string[] {
    return variants.split(",").map(name => name.trim());
}

/**
 * Validates the specified variants against the available variants.
 */
function validateVariants(specifiedVariantNames: string[], allVariantNames: string[]): { validVariants: string[]; invalidVariants: string[] } {
    return specifiedVariantNames.reduce<{ validVariants: string[]; invalidVariants: string[] }>(
        (acc, name) => {
            if (allVariantNames.includes(name)) {
                acc.validVariants.push(name);
            } else {
                acc.invalidVariants.push(name);
            }
            return acc;
        }, { validVariants: [], invalidVariants: [] }
    );
}