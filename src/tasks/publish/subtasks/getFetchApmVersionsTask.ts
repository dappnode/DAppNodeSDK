import { ListrTask } from "listr";
import { PackageToBuildProps, ListrContextPublish, ReleaseType } from "../../../types.js";
import { getNextVersionFromApm } from "../../../utils/versions/getNextVersionFromApm.js";
import { Manifest } from "@dappnode/types";
import { isPackageNotRegisteredError } from "../../../utils/isPackageNotRegisteredError.js";

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

      for (const { manifest, variant, releaseDir } of packagesToBuildProps) {
        const dnpName = manifest.name;

        const nextVersion = await getNextPackageVersion({
          manifest,
          releaseType,
          ethProvider
        });

        ctx[dnpName] = {
          variant,
          releaseDir,
          nextVersion
        }
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
    // Publishing this package for the first time: there is no repository to
    // read a current version from, so start from the manifest version.
    if (isPackageNotRegisteredError(e)) return version;
    else throw e;
  }
}