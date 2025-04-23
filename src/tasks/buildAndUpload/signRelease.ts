import { ListrTask } from "listr/index.js";
import { PackageToBuildProps, ListrContextBuild } from "../../types.js";
import { IReleaseUploader } from "../../releaseUploader/index.js";
import { signRelease } from "../../utils/signRelease.js";
import { SigningKey } from "ethers";

export function signReleaseTasks({
  packagesToBuildProps,
  skipUpload,
  signReleaseFlag,
  releaseUploader,
}: {
  packagesToBuildProps: PackageToBuildProps[];
  skipUpload?: boolean;
  signReleaseFlag: boolean;
  releaseUploader: IReleaseUploader;
}): ListrTask<ListrContextBuild>[] {
  const tasks: ListrTask<ListrContextBuild>[] = [];
  for (const { manifest } of packagesToBuildProps) {
    const { name: dnpName } = manifest;

    tasks.push({
      title: `Sign release for ${dnpName}`,
      skip: () => skipUpload || !signReleaseFlag,
      task: async (ctx) => {
        if (releaseUploader.networkName != "IPFS") {
          throw Error("Can only sign releases uploaded to IPFS");
        }

        // Note: throws an error if not of type IPFS node
        const ipfsApiUrl = releaseUploader.ipfsApiUrl();

        const privateKeyHex = process.env.SIGNING_KEY;
        if (!privateKeyHex) {
          throw Error("Must set ENV SIGNING_KEY to sign packages");
        }
        const signingKey = new SigningKey(privateKeyHex);

        const releaseMultiHash = ctx[dnpName].releaseMultiHash;
        if (!releaseMultiHash) {
          throw Error("Internal error: releaseMultiHash not defined");
        }
        const signedReleaseHash = await signRelease(releaseMultiHash, [ipfsApiUrl], signingKey);

        ctx[dnpName].releaseMultiHash = signedReleaseHash;
      }
    });
  }

  return tasks;
}

