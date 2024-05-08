import fs from "fs";
import path from "path";
import {
  YargsError,
  defaultManifestFormat,
  defaultVariantsDirName,
  defaultVariantsEnvName
} from "../../params.js";
import { UserAnswers } from "./types.js";
import { Compose, Manifest, getImageTag, releaseFiles } from "@dappnode/types";
import {
  getComposePath,
  getManifestPath,
  writeCompose,
  writeManifest
} from "../../files/index.js";
import inquirer from "inquirer";
import {
  avatarData,
  avatarName,
  dockerfileData,
  dockerfileName,
  gitignoreCheck,
  gitignoreData,
  gitignoreName
} from "./params.js";
import { FlexibleCompose } from "../../files/compose/types.js";
import { addVariantToDnpName } from "./naming.js";

export function createPackageDirectories(
  dir: string,
  answers: UserAnswers,
  useVariants: boolean
): void {
  // Create package root dir
  fs.mkdirSync(dir, { recursive: true });

  // Create all variant dirs
  if (useVariants && answers.variants) {
    const variantsDir = answers.variantsDir || defaultVariantsDirName;

    fs.mkdirSync(path.join(dir, variantsDir), { recursive: true });

    for (const variant of answers.variants) {
      fs.mkdirSync(path.join(dir, variantsDir, variant), { recursive: true });
    }
  }
}

export function writePackageFiles({
  dir,
  answers,
  useVariants,
  force,
  rootManifest,
  rootCompose,
  composeFileName,
  serviceName
}: {
  dir: string;
  answers: UserAnswers;
  useVariants: boolean;
  force: boolean;
  rootManifest: Manifest;
  rootCompose: Compose;
  composeFileName: string;
  serviceName: string;
}): void {
  const rootManifestPath = getManifestPath(defaultManifestFormat, { dir });
  confirmManifestOverwrite(rootManifestPath, force);

  if (useVariants)
    writeMultiVariantPackageFiles({
      dir,
      rootManifest,
      rootCompose,
      composeFileName,
      answers,
      serviceName
    });
  else
    writeSinglePackageFiles({
      dir,
      rootManifest,
      rootCompose,
      composeFileName
    });

  addDefaultAvatar(dir);

  addDockerfile(dir);

  addGitignore(dir);
}

function writeSinglePackageFiles({
  dir,
  rootManifest,
  rootCompose,
  composeFileName
}: {
  dir: string;
  rootManifest: Manifest;
  rootCompose: Compose;
  composeFileName: string;
}): void {
  writeManifest<Manifest>(rootManifest, defaultManifestFormat, { dir });

  // Only write a compose if it doesn't exist
  if (!fs.existsSync(getComposePath({ dir }))) {
    writeCompose(rootCompose, { dir, composeFileName });
  }
}

function writeMultiVariantPackageFiles({
  dir,
  rootManifest,
  rootCompose,
  composeFileName,
  answers,
  serviceName
}: {
  dir: string;
  rootManifest: Manifest;
  rootCompose: Compose;
  composeFileName: string;
  answers: UserAnswers;
  serviceName: string;
}): void {
  const envName = answers.envName || defaultVariantsEnvName;

  // All except name and version
  const templateRootManifest = {
    ...rootManifest,
    name: undefined,
    version: undefined
  };

  // Write the root manifest
  writeManifest<Partial<Manifest>>(
    templateRootManifest,
    defaultManifestFormat,
    { dir }
  );

  // Write the root compose
  writeCompose<FlexibleCompose>(
    removeImageFromCompose(rootCompose, serviceName),
    { dir, composeFileName }
  );

  // Write the variants
  const variantsDir = answers.variantsDir || defaultVariantsDirName;

  for (const variant of answers.variants || []) {
    const variantDir = path.join(dir, variantsDir, variant);
    const variantName = addVariantToDnpName({
      dnpName: rootManifest.name,
      variant
    });
    const variantManifest: Partial<Manifest> = {
      name: variantName,
      version: rootManifest.version
    };
    const variantCompose: Compose = {
      version: "3.5",
      services: {
        [serviceName]: {
          image: getImageTag({
            dnpName: variantName,
            serviceName,
            version: rootManifest.version
          }),
          environment: {
            [envName]: variant
          }
        }
      }
    };
    writeManifest<Partial<Manifest>>(variantManifest, defaultManifestFormat, {
      dir: variantDir
    });
    writeCompose<Compose>(variantCompose, { dir: variantDir, composeFileName });
  }
}

function addDefaultAvatar(dir: string) {
  const files = fs.readdirSync(dir);
  const avatarFile = files.find(file => releaseFiles.avatar.regex.test(file));
  if (!avatarFile) {
    fs.writeFileSync(
      path.join(dir, avatarName),
      Buffer.from(avatarData, "base64")
    );
  }
}

function addDockerfile(dir: string) {
  fs.writeFileSync(path.join(dir, dockerfileName), dockerfileData);
}

/**
 * Make sure there's a gitignore for the builds or create it
 */
function addGitignore(dir: string) {
  const gitignorePath = path.join(dir, gitignoreName);

  if (fs.existsSync(gitignorePath)) {
    const currentGitignore = fs.readFileSync(gitignorePath, "utf8");
    if (!currentGitignore.includes(gitignoreCheck))
      fs.writeFileSync(gitignorePath, currentGitignore + gitignoreData);
  } else {
    fs.writeFileSync(gitignorePath, gitignoreData);
  }
}

function removeImageFromCompose(
  compose: Compose,
  serviceName: string
): FlexibleCompose {
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
async function confirmManifestOverwrite(
  manifestPath: string,
  force: boolean
): Promise<void> {
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
