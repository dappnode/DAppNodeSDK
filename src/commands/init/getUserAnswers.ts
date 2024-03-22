import inquirer from "inquirer";
import semver from "semver";
import { defaultVariantsDir } from "../../params.js";
import { shell } from "../../utils/shell.js";
import { UserAnswers, SinglePackageAnswers, TemplatePackageAnswers } from "./types.js";
import { defaultVersion, defaultEnvName, defaultVariants } from "./params.js";

export async function getUserAnswers({ templateMode, useDefaults, defaultName }: { templateMode: boolean, useDefaults: boolean, defaultName: string }): Promise<UserAnswers> {
    const defaultAuthor = await shell("whoami");

    const defaultAnswers: UserAnswers = {
        name: defaultName,
        version: defaultVersion,
        description: `${defaultName} description`,
        avatar: "",
        type: "service",
        author: defaultAuthor,
        license: "GPL-3.0",
        envName: defaultEnvName,
        variants: defaultVariants,
        variantsDir: defaultVariantsDir
    };

    if (useDefaults) return defaultAnswers;

    console.log(`This utility will walk you through creating a dappnode_package.json file.
  It only covers the most common items, and tries to guess sensible defaults.
  `);

    const answers: SinglePackageAnswers = await getSinglePackageAnswers(defaultAnswers);

    if (templateMode) {
        const templateAnswers = await getTemplateAnswers();
        return { ...answers, ...templateAnswers };
    }

    return answers;
}

async function getSinglePackageAnswers(defaultAnswers: SinglePackageAnswers): Promise<SinglePackageAnswers> {
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

async function getTemplateAnswers(): Promise<TemplatePackageAnswers> {
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
            default: "mainnet,testnet",
            validate: (input: string) => validateVariantsInput(input),
            transformer: (input: string) => input.trim()
        },
        {
            type: "input",
            name: "envName",
            message: "Environment variable name to differentiate the variants (Example: NETWORK)",
            default: "NETWORK"
        }
        ]);

    return {
        ...templateAnswers,
        variants: templateAnswers.variants.split(",")
    }
}

function validateVariantsInput(input: string): boolean | string {
    const variants = input.split(",").map(s => s.trim());
    const allNonEmpty = variants.every(variant => variant.length > 0);
    const uniqueVariants = new Set(variants).size === variants.length;

    if (variants.length < 2) {
        return "You need to specify at least two variants, separated by a comma. Example: mainnet,testnet";
    } else if (!allNonEmpty) {
        return "Empty variant detected. Please ensure all variants are non-empty.";
    } else if (!uniqueVariants) {
        return "Duplicate variants detected. Please ensure all variants are unique.";
    }
    return true;
}