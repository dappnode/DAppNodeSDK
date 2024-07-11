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

export function getFetchNextVersionsFromApmTask({
  releaseType,
  ethProvider,
  variantsMap
}: {
  releaseType: ReleaseType;
  ethProvider: string;
  variantsMap: BuildVariantsMap;
}): ListrTask<ListrContextPublish> {
  return {
    title: "Fetch current versions from APM",
    task: async ctx => {

      for (const [, { manifest: { name, version } }] of Object.entries(variantsMap)) {
        ctx[name] = ctx[name] || {};

        try {
          ctx[name].nextVersion = await getNextVersionFromApm({
            type: releaseType,
            ethProvider,
            ensName: name
          });
        } catch (e) {
          if (e.message.includes("NOREPO")) ctx[name].nextVersion = version;
          else throw e;
        }

      }
    }
  };
}