import chalk from "chalk";
import { getAllVariantsInPath } from "../../files/variants/getAllPackageVariants.js";
import { PackageToBuildProps } from "../../types.js";
import { generatePackagesProps } from "../../tasks/buildAndUpload/buildVariantMap.js";

export function getPackagesToBuildProps({
  allVariants,
  variantsStr,
  rootDir,
  variantsDirPath,
  composeFileName
}: {
  allVariants: boolean;
  variantsStr?: string;
  rootDir: string;
  variantsDirPath: string;
  composeFileName: string;
}): PackageToBuildProps[] {

  const buildVariantMapArgs = { rootDir, variantsDirPath, composeFileName };

  if (!allVariants && !variantsStr)
    return generatePackagesProps({ ...buildVariantMapArgs, variants: null });

  const validVariantNames = getValidVariantNames({
    variantsDirPath,
    variants: variantsStr
  });

  if (validVariantNames.length === 0)
    throw new Error(
      `No valid variants specified. They must be included in: ${variantsDirPath}`
    );

  console.log(
    `${chalk.dim(
      `Building package from template for variant(s) ${variantsStr}...`
    )}`
  );

  return generatePackagesProps({
    ...buildVariantMapArgs,
    variants: validVariantNames
  });
}

/**
 * Main function to retrieve the valid variant names based on the specified variants and available directories.
 */
export function getValidVariantNames({
  variantsDirPath,
  variants
}: {
  variantsDirPath: string;
  variants?: string;
}): string[] {
  const allVariantNames = getAllVariantsInPath(variantsDirPath);

  if (!variants) {
    console.log(
      chalk.dim(
        `Building all available variants: ${allVariantNames.join(", ")}`
      )
    );
    return allVariantNames;
  }

  const specifiedVariantNames = parseVariants(variants);
  const { validVariants, invalidVariants } = validateVariants(
    specifiedVariantNames,
    allVariantNames
  );

  if (invalidVariants.length > 0)
    console.error(
      chalk.red(
        `Warning: Some specified variants are not valid and will be ignored. Allowed variants: ${allVariantNames.join(
          ", "
        )}`
      )
    );

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
function validateVariants(
  specifiedVariantNames: string[],
  allVariantNames: string[]
): { validVariants: string[]; invalidVariants: string[] } {
  return specifiedVariantNames.reduce<{
    validVariants: string[];
    invalidVariants: string[];
  }>(
    (acc, name) => {
      if (allVariantNames.includes(name)) {
        acc.validVariants.push(name);
      } else {
        acc.invalidVariants.push(name);
      }
      return acc;
    },
    { validVariants: [], invalidVariants: [] }
  );
}
