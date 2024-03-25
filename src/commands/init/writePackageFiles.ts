import { Manifest, Compose, getImageTag, releaseFiles } from "@dappnode/types";
import path from "path";
import fs from "fs";
import { getManifestPath, writeManifest, getComposePath, writeCompose } from "../../files/index.js";
import { writeFileIfNotExists } from "../../files/common/writeFileIfNotExists.js";
import { FlexibleCompose } from "../../files/compose/writeCompose.js";
import { YargsError, defaultManifestFormat, defaultVariantsDir } from "../../params.js";
import { avatarData, avatarPath, defaultEnvName, dockerfileData, dockerfilePath, gitignoreCheck, gitignoreData, gitignorePath } from "./params.js";
import { UserAnswers } from "./types.js";
import inquirer from "inquirer";
import { validateDnpName } from "./validateDnpName.js";

export function writePackageFiles({
    dir,
    answers,
    templateMode,
    force,
    rootManifest,
    rootCompose,
    composeFileName,
    serviceName
}: {
    dir: string,
    answers: UserAnswers,
    templateMode: boolean,
    force: boolean,
    rootManifest: Manifest,
    rootCompose: Compose,
    composeFileName: string,
    serviceName: string
}): void {
    const rootManifestPath = getManifestPath(defaultManifestFormat, { dir });
    confirmManifestOverwrite(rootManifestPath, force);

    if (!templateMode)
        writeSinglePackageFiles({ dir, rootManifest, rootCompose, composeFileName });
    else
        writeTemplatePackageFiles({ dir, rootManifest, rootCompose, composeFileName, answers, serviceName });

    writeDefaultAvatar(dir);

    writeFileIfNotExists(path.join(dir, dockerfilePath), dockerfileData);

    // Initialize .gitignore
    writeGitIgnore(path.join(dir, gitignorePath));
}


function writeSinglePackageFiles({
    dir,
    rootManifest,
    rootCompose,
    composeFileName
}: {
    dir: string,
    rootManifest: Manifest,
    rootCompose: Compose,
    composeFileName: string
}): void {
    writeManifest<Manifest>(rootManifest, defaultManifestFormat, { dir });

    // Only write a compose if it doesn't exist
    if (!fs.existsSync(getComposePath({ dir }))) {
        writeCompose(rootCompose, { dir, composeFileName });
    }
}

function writeTemplatePackageFiles({
    dir,
    rootManifest,
    rootCompose,
    composeFileName,
    answers,
    serviceName
}: {
    dir: string,
    rootManifest: Manifest,
    rootCompose: Compose,
    composeFileName: string,
    answers: UserAnswers,
    serviceName: string
}): void {
    // All except name and version
    const templateRootManifest = { ...rootManifest, name: undefined, version: undefined };

    // Write the root manifest
    writeManifest<Partial<Manifest>>(templateRootManifest, defaultManifestFormat, { dir });

    // Write the root compose
    writeCompose<FlexibleCompose>(removeImageFromCompose(rootCompose, serviceName), { dir, composeFileName });

    for (const variant of answers.variants || []) {
        writeVariantFiles({ dir, rootManifest, composeFileName, variant, serviceName, answers });
    }
}

function writeVariantFiles({
    dir,
    rootManifest,
    composeFileName,
    variant,
    serviceName,
    answers
}: {
    dir: string,
    rootManifest: Manifest,
    composeFileName: string,
    variant: string,
    serviceName: string,
    answers: UserAnswers
}) {
    const envName = answers.envName || defaultEnvName;
    const variantsDir = answers.variantsDir || defaultVariantsDir;

    const variantDir = path.join(dir, variantsDir, variant);
    const variantName = addVariantToDnpName({ dnpName: rootManifest.name, variant });
    const variantManifest: Partial<Manifest> = { name: variantName, version: rootManifest.version };
    const variantCompose: Compose = {
        version: "3.5",
        services: {
            [serviceName]: {
                image: getImageTag({ dnpName: variantName, serviceName, version: rootManifest.version }),
                environment: {
                    [envName]: variant
                }
            }
        }
    };
    writeManifest<Partial<Manifest>>(variantManifest, defaultManifestFormat, { dir: variantDir });
    writeCompose<Compose>(variantCompose, { dir: variantDir, composeFileName });
}

function writeDefaultAvatar(dir: string): void {
    const files = fs.readdirSync(dir);
    const avatarFile = files.find(file => releaseFiles.avatar.regex.test(file));
    if (!avatarFile) {
        fs.writeFileSync(
            path.join(dir, avatarPath),
            Buffer.from(avatarData, "base64")
        );
    }
}

/**
 * Make sure there's a gitignore for the builds or create it
 */
function writeGitIgnore(filepath: string) {
    const currentGitIgnore = fs.existsSync(filepath)
        ? fs.readFileSync(filepath, "utf8")
        : "";

    if (currentGitIgnore.includes(gitignoreCheck)) return;

    fs.writeFileSync(filepath, currentGitIgnore + gitignoreData);
}



function removeImageFromCompose(compose: Compose, serviceName: string): FlexibleCompose {
    return {
        ...compose,
        services: {
            ...compose.services,
            [serviceName]: {
                ...compose.services[serviceName],
                image: undefined
            }
        }
    };
}

/**
 * Check if the manifest already exists and ask for confirmation if it does
 * 
 * @param manifestPath
 * @param force
 * @throws YargsError if the user doesn't want to overwrite the manifest
 * @returns void
 */
async function confirmManifestOverwrite(manifestPath: string, force: boolean): Promise<void> {
    if (fs.existsSync(manifestPath) && !force) {
        const continueAnswer = await inquirer.prompt([
            {
                type: "confirm",
                name: "continue",
                message:
                    "This directory is already initialized. Are you sure you want to overwrite the existing manifest?"
            }
        ]);
        if (!continueAnswer.continue) {
            throw new YargsError("Stopping");
        }
    }
}


/**
 * Adds a variant suffix to a DAppNode package (DNP) name, ensuring the variant is inserted
 * right before the domain part of the DNP name.
 *
 * @param {Object} params - The function parameters.
 * @param {string} params.dnpName - The original DNP name.
 * @param {string} params.variant - The variant to be added to the DNP name.
 * @returns {string} - The modified DNP name including the variant.
 *
 * @example
 * 
 * --> Adds the 'mainnet' variant to the DNP name
 * 
 * const modifiedDnpName = addVariantToDnpName({ dnpName: "geth.dnp.dappnode.eth", variant: "mainnet" });
 * console.log(modifiedDnpName);
 * 
 * --> Output: "geth-mainnet.dnp.dappnode.eth"
 */
function addVariantToDnpName({ dnpName, variant }: { dnpName: string, variant: string }): string {
    validateDnpName(dnpName);

    const firstDotAt = dnpName.indexOf(".");
    return `${dnpName.substring(0, firstDotAt)}-${variant}${dnpName.substring(firstDotAt)}`;
}