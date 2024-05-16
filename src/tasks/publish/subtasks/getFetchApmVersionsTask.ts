import { ListrTask } from "listr";
import { ListrContextPublish, ReleaseType } from "../../../types.js";
import {
  readManifest,
  writeManifest,
  readCompose,
  updateComposeImageTags,
  writeCompose
} from "../../../files/index.js";
import { getNextVersionFromApm } from "../../../utils/versions/getNextVersionFromApm.js";
import { Manifest } from "@dappnode/types";
import { ManifestFormat } from "../../../files/manifest/types.js";
import path from "path";
import { ManifestsMap } from "../types.js";

export function getFetchApmVersionsTask({
  releaseType,
  ethProvider,
  rootDir,
  composeFileName,
  variants,
  variantsDirPath
}: {
  releaseType: ReleaseType;
  ethProvider: string;
  rootDir: string;
  composeFileName: string;
  variants: string[] | null;
  variantsDirPath: string;
}): ListrTask<ListrContextPublish> {
  return {
    title: "Fetch current versions from APM",
    task: async ctx => {
      const manifestsMap = buildManifestsMap({
        dir: rootDir,
        variants,
        variantsDirPath
      });

      for (const [, { manifest, format }] of Object.entries(manifestsMap)) {
        await setNextVersionToContext({
          ctx,
          manifest,
          manifestFormat: format,
          releaseType,
          ethProvider,
          dir: rootDir,
          composeFileName
        });
      }
    }
  };
}

function buildManifestsMap({
  dir,
  variants,
  variantsDirPath
}: {
  dir: string;
  variants: string[] | null;
  variantsDirPath: string;
}): ManifestsMap {
  if (!variants) return { ["default"]: readManifest([{ dir }]) };

  const manifestsMap: ManifestsMap = {};

  variants.forEach(variant => {
    const variantPath = path.join(variantsDirPath, variant);
    manifestsMap[variant] = readManifest([{ dir }, { dir: variantPath }]);
  });

  return manifestsMap;
}

async function setNextVersionToContext({
  ctx,
  manifest,
  manifestFormat,
  releaseType,
  ethProvider,
  dir,
  composeFileName
}: {
  ctx: ListrContextPublish;
  manifest: Manifest;
  manifestFormat: ManifestFormat;
  releaseType: ReleaseType;
  ethProvider: string;
  dir: string;
  composeFileName: string;
}): Promise<void> {
  const { name, version } = manifest;

  ctx[name] = ctx[name] || {};

  try {
    ctx[name].nextVersion = await increaseFromApmVersion({
      type: releaseType,
      ethProvider,
      dir,
      composeFileName,
      manifest,
      manifestFormat
    });
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
  manifest,
  manifestFormat
}: {
  type: ReleaseType;
  ethProvider: string;
  dir: string;
  composeFileName: string;
  manifest: Manifest;
  manifestFormat: ManifestFormat;
}): Promise<string> {
  // Check variables
  const nextVersion = await getNextVersionFromApm({
    type,
    ethProvider,
    ensName: manifest.name
  });

  // Increase the version
  manifest.version = nextVersion;

  // Modify and write the manifest and docker-compose
  writeManifest(manifest, manifestFormat, { dir });
  const { name, version } = manifest;
  const compose = readCompose([{ dir, composeFileName }]);
  const newCompose = updateComposeImageTags(compose, { name, version });
  writeCompose(newCompose, { dir, composeFileName });

  return nextVersion;
}
