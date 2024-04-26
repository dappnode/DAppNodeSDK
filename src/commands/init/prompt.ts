import inquirer from "inquirer";
import semver from "semver";
import { defaultVariantsEnvName, defaultVariantsDir, defaultVariantsEnvValues } from "../../params.js";
import { shell } from "../../utils/shell.js";
import { defaultVersion } from "./params.js";
import { UserAnswers, TemplateAnswers, DefaultAnswers } from "./types.js";
import { validateVariantsInput } from "./validation.js";

export async function getUserAnswers({ useVariants, useDefaults, defaultName }: { useVariants: boolean, useDefaults: boolean, defaultName: string }): Promise<UserAnswers> {
    const defaultAuthor = await shell("whoami");

    const defaultVariantAnswers: TemplateAnswers = {
        envName: defaultVariantsEnvName,
        variantsDir: defaultVariantsDir,
        variants: defaultVariantsEnvValues
    };

    const defaultAnswers: UserAnswers = {
        name: defaultName,
        version: defaultVersion,
        description: `${defaultName} description`,
        avatar: "",
        type: "service",
        author: defaultAuthor,
        license: "GPL-3.0",
        ...useVariants ? defaultVariantAnswers : {}
    };

    if (useDefaults) return defaultAnswers;

    console.log(`This utility will walk you through creating a dappnode_package.json file.
  It only covers the most common items, and tries to guess sensible defaults.
  `);

    const answers: UserAnswers = await getSinglePackageAnswers(defaultAnswers);

    if (useVariants) {
        const templateAnswers = await getVariantAnswers();
        return { ...answers, ...templateAnswers };
    }

    return answers;
}

async function getSinglePackageAnswers(defaultAnswers: DefaultAnswers): Promise<UserAnswers> {
    return inquirer.prompt([
        {
            type: "input",
            name: "name",
            default: defaultAnswers.name,
            message: "DAppNodePackage name"
        },
        {
            type: "input",
            name: "version",
            default: defaultAnswers.version,
            message: "Version",
            validate: (val: string | semver.SemVer) =>
                !semver.valid(val) ||
                    !(
                        semver.eq(val, "1.0.0") ||
                        semver.eq(val, "0.1.0") ||
                        semver.eq(val, "0.0.1")
                    )
                    ? "the version needs to be valid semver. If this is the first release, the version must be 1.0.0, 0.1.0 or 0.0.1 "
                    : true
        },
        {
            type: "input",
            name: "description",
            message: "Description",
            default: defaultAnswers.description
        },
        {
            type: "input",
            message: "Author",
            name: "author",
            default: defaultAnswers.author
        },
        {
            type: "input",
            message: "License",
            name: "license",
            default: defaultAnswers.license
        }
    ]
    );
}

async function getVariantAnswers(): Promise<TemplateAnswers> {
    const templateAnswers = await inquirer.prompt(
        [{
            type: "input",
            name: "variantsDir",
            default: defaultVariantsDir,
            message: "Variants directory, where the different package variants are located",
        },
        {
            type: "input",
            name: "variants",
            message: "Variants (comma separated)",
            default: defaultVariantsEnvValues,
            validate: (input: string) => validateVariantsInput(input),
        },
        {
            type: "input",
            name: "envName",
            message: "Environment variable name to differentiate the variants (Example: NETWORK)",
            default: defaultVariantsEnvName
        }
        ]);

    return {
        ...templateAnswers,
        variants: templateAnswers.variants.split(",").map((s: string) => s.trim())
    }
}