import { Manifest, Compose, getImageTag } from "@dappnode/types";
import { defaultDir, defaultComposeFileName } from "../../params.js";
import { shell } from "../../utils/shell.js";
import { defaultVersion } from "./params.js";
import { InitCommandOptions, UserAnswers } from "./types.js";
import { getDnpName, getShortDnpName } from "./naming.js";
import { getUserAnswers } from "./prompt.js";
import {
  createPackageDirectories,
  writePackageFiles
} from "./fileOperations.js";

export async function initHandler({
  rootDir: dir = defaultDir,
  compose_file_name: composeFileName = defaultComposeFileName,
  yes,
  force,
  use_variants
}: InitCommandOptions): Promise<Manifest> {
  const useVariants = !!use_variants;
  const useDefaults = !!yes;

  // shell outputs tend to include trailing spaces and new lines
  const directoryName = await shell('echo "${PWD##*/}"');
  const defaultName = getDnpName(directoryName);

  const answers = await getUserAnswers({
    useVariants,
    useDefaults,
    defaultName
  });

  // Construct DNP
  const dnpName = answers.name ? getDnpName(answers.name) : defaultName;
  const serviceName = getShortDnpName(dnpName);

  const rootManifest = buildManifest(dnpName, answers);

  const rootCompose = buildCompose({
    serviceName,
    dnpName,
    version: rootManifest.version
  });

  createPackageDirectories(dir, answers, useVariants);
  writePackageFiles({
    dir,
    answers,
    useVariants,
    force: !!force,
    rootManifest,
    rootCompose,
    composeFileName,
    serviceName
  });

  return rootManifest;
}

function buildManifest(dnpName: string, answers: UserAnswers): Manifest {
  const version = answers.version || defaultVersion;

  return {
    name: dnpName,
    version: version,
    description: answers.description,
    type: "service",
    author: answers.author,
    categories: ["Developer tools"],
    links: {
      homepage: "https://your-project-homepage-or-docs.io"
    },
    license: answers.license
  };
}

function buildCompose({
  serviceName,
  dnpName,
  version
}: {
  serviceName: string;
  dnpName: string;
  version: string;
}): Compose {
  return {
    version: "3.5",
    services: {
      [serviceName]: {
        build: ".", // Dockerfile is in root dir
        image: getImageTag({ dnpName, serviceName, version }),
        restart: "unless-stopped"
      }
    }
  };
}
