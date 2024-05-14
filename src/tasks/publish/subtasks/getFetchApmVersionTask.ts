import { ListrTask } from "listr";
import { ListrContextBuildAndPublish, ReleaseType } from "../../../types.js";
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

export function getFetchApmVersionTask({
  releaseType,
  ethProvider,
  dir,
  composeFileName
}: {
  releaseType: ReleaseType;
  ethProvider: string;
  dir: string;
  composeFileName: string;
}): ListrTask<ListrContextBuildAndPublish> {
  return {
    title: "Fetch current version from APM",
    task: async ctx => {
      const { manifest, format: manifestFormat } = readManifest([{ dir }]);
      const { name, version } = manifest;

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
  };
}

async function increaseFromApmVersion({
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
