import { ListrTask } from "listr";
import { PackageToBuildProps, ListrContextPublish, ReleaseType } from "../../../types.js";
import { getNextVersionFromApm } from "../../../utils/versions/getNextVersionFromApm.js";
import { Manifest } from "@dappnode/types";

export function getFetchNextVersionsFromApmTask({
  releaseType,
  ethProvider,
  packagesToBuildProps
}: {
  releaseType: ReleaseType;
  ethProvider: string;
  packagesToBuildProps: PackageToBuildProps[];
}): ListrTask<ListrContextPublish> {
  return {
    title: "Fetch current versions from APM",
    task: async ctx => {

      for (const { manifest } of packagesToBuildProps) {
        const dnpName = manifest.name;

        ctx[dnpName] = ctx[dnpName] || {};
        ctx[dnpName].nextVersion = await getNextPackageVersion({
          manifest,
          releaseType,
          ethProvider
        });

      }
    }
  };
}

export async function getNextPackageVersion({
  manifest,
  releaseType,
  ethProvider,
}: {
  manifest: Manifest;
  releaseType: ReleaseType;
  ethProvider: string;
}) {
  const { name, version } = manifest;

  try {
    return await getNextVersionFromApm({
      type: releaseType,
      ethProvider,
      ensName: name
    });
  } catch (e) {
    if (e.message.includes("NOREPO")) return version;
    else throw e;
  }
}