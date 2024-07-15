import { ListrTask } from "listr/index.js";
import { PackageToBuildProps, ListrContextBuild } from "../../types.js";
import { getGitHeadIfAvailable } from "../../utils/git.js";
import { getPinMetadata } from "../../pinStrategy/index.js";
import { PinKeyvaluesDefault } from "../../releaseUploader/pinata/index.js";
import { IReleaseUploader } from "../../releaseUploader/index.js";
import { composeDeleteBuildProperties } from "../../files/index.js";

export function getUploadTasks({
  packagesToBuildProps,
  skipUpload,
  releaseUploader,
  requireGitData,
  composeFileName
}: {
  packagesToBuildProps: PackageToBuildProps[];
  skipUpload?: boolean;
  releaseUploader: IReleaseUploader;
  requireGitData: boolean;
  composeFileName: string;
}): ListrTask<ListrContextBuild>[] {
  const uploadTasks: ListrTask<ListrContextBuild>[] = [];

  for (const { manifest, releaseDir } of packagesToBuildProps) {
    const { name: dnpName } = manifest;

    uploadTasks.push({
      title: `Upload release for ${dnpName} to ${releaseUploader.networkName}`,
      skip: () => skipUpload,
      task: async (ctx, task) => {
        const gitHead = await getGitHeadIfAvailable({ requireGitData });

        // Remove `build` property AFTER building. Otherwise it may break ISO installations
        // https://github.com/dappnode/DAppNode_Installer/issues/161
        composeDeleteBuildProperties({ dir: releaseDir, composeFileName });

        // TODO: Remove this line after cheking that the release is correctly uploaded
        // ctx[dnpName] = ctx[dnpName] || { variant, releaseDir };
        ctx[dnpName].releaseMultiHash = await releaseUploader.addFromFs({
          dirPath: releaseDir,
          metadata: getPinMetadata(manifest, gitHead) as PinKeyvaluesDefault,
          onProgress: percent => (task.output = percentToMessage(percent))
        });
      }
    });
  }

  return uploadTasks;
}

function percentToMessage(percent: number): string {
  return `Uploading... ${(percent * 100).toFixed(2)}%`;
}
