import { ListrTask } from "listr";
import { BuildVariantsMap, ListrContextPublish, ReleaseType } from "../../../types.js";
import {
  writeManifest,
  readCompose,
  updateComposeImageTags,
  writeCompose,
  readManifest
} from "../../../files/index.js";
import { getNextVersionFromApm } from "../../../utils/versions/getNextVersionFromApm.js";
import path from "path";
import { Manifest } from "@dappnode/types";

export function getFetchApmVersionsTask({
  releaseType,
  ethProvider,
  rootDir,
  variantsDirPath,
  composeFileName,
  variantsMap
}: {
  releaseType: ReleaseType;
  ethProvider: string;
  rootDir: string;
  variantsDirPath: string;
  composeFileName: string;
  variantsMap: BuildVariantsMap;
}): ListrTask<ListrContextPublish> {
  return {
    title: "Fetch current versions from APM",
    task: async ctx => {
      for (const [variant, { manifest }] of Object.entries(variantsMap))
        await setNextVersionToContext({
          ctx,
          releaseType,
          ethProvider,
          dir: rootDir,
          variantsDirPath,
          composeFileName,
          variant: variant === "default" ? null : variant,
          manifest
        });
    }
  };
}

async function setNextVersionToContext({
  ctx,
  releaseType,
  ethProvider,
  dir,
  variantsDirPath,
  composeFileName,
  variant,
  manifest
}: {
  ctx: ListrContextPublish;
  releaseType: ReleaseType;
  ethProvider: string;
  dir: string;
  variantsDirPath: string;
  composeFileName: string;
  variant: string | null;
  manifest: Manifest;
}): Promise<void> {
  const { name, version } = manifest
  ctx[name] = ctx[name] || {};

  try {
    const nextVersion = await increaseFromApmVersion({
      type: releaseType,
      ethProvider,
      dir,
      composeFileName,
      variant,
      variantsDirPath,
      ensName: name
    });

    ctx[name].nextVersion = nextVersion;
    manifest.version = nextVersion;
  } catch (e) {
    if (e.message.includes("NOREPO")) ctx[name].nextVersion = version;
    else throw e;
  }
}

// TODO: Try to test this without exporting the function (not used anywhere else)
export async function increaseFromApmVersion({
  type,
  ethProvider,
  dir,
  composeFileName,
  variant,
  variantsDirPath,
  ensName
}: {
  type: ReleaseType;
  ethProvider: string;
  dir: string;
  composeFileName: string;
  variant: string | null;
  variantsDirPath: string;
  ensName: string;
}): Promise<string> {
  const variantDir = variant ? path.join(variantsDirPath, variant) : dir;

  // Check variables
  const nextVersion = await getNextVersionFromApm({
    type,
    ethProvider,
    ensName
  });

  const { manifest, format } = readManifest([{ dir: variantDir }]);

  // Increase the version
  manifest.version = nextVersion;

  // Modify and write the manifest and docker-compose
  writeManifest(manifest, format, { dir: variantDir });

  const compose = readCompose([{ dir: variantDir, composeFileName }]);
  const newCompose = updateComposeImageTags(compose, {
    name: ensName,
    version: nextVersion
  });
  writeCompose(newCompose, {
    dir: variantDir,
    composeFileName
  });

  return nextVersion;
}
