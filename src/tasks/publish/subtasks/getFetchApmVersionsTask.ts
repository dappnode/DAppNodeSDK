import { ListrTask } from "listr";
import { ListrContextPublish, ReleaseType } from "../../../types.js";
import {
  writeManifest,
  readCompose,
  updateComposeImageTags,
  writeCompose
} from "../../../files/index.js";
import { getNextVersionFromApm } from "../../../utils/versions/getNextVersionFromApm.js";
import { Manifest } from "@dappnode/types";
import { ManifestFormat } from "../../../files/manifest/types.js";
import { VariantsMap } from "../../buildAndUpload/types.js";

export function getFetchApmVersionsTask({
  releaseType,
  ethProvider,
  rootDir,
  composeFileName,
  variantsMap
}: {
  releaseType: ReleaseType;
  ethProvider: string;
  rootDir: string;
  composeFileName: string;
  variantsMap: VariantsMap;
}): ListrTask<ListrContextPublish> {
  return {
    title: "Fetch current versions from APM",
    task: async ctx => {
      for (const [, { manifest, manifestFormat }] of Object.entries(
        variantsMap
      )) {
        await setNextVersionToContext({
          ctx,
          manifest,
          manifestFormat,
          releaseType,
          ethProvider,
          dir: rootDir,
          composeFileName
        });
      }
    }
  };
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
