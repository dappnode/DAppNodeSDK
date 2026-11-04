import { ListrTask } from "listr/index.js";
import { PackageToBuildProps, ListrContextBuild } from "../../types.js";
import { getGitHeadIfAvailable } from "../../utils/git.js";
import { getPinMetadata } from "../../pinStrategy/index.js";
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

  for (const { manifest, releaseDir, manifestPaths } of packagesToBuildProps) {
    const { name: dnpName } = manifest;

    uploadTasks.push({
      title: `Upload release for ${dnpName} to ${releaseUploader.networkName}`,
      skip: () => skipUpload,
      task: async (ctx, task) => {
        const gitHead = await getGitHeadIfAvailable({
          requireGitData,
          dir: manifestPaths[0]?.dir
        });

        // Remove `build` property AFTER building. Otherwise it may break ISO installations
        // https://github.com/dappnode/DAppNode_Installer/issues/161
        composeDeleteBuildProperties({ dir: releaseDir, composeFileName });

        let waiting: ReturnType<typeof setInterval> | undefined;
        try {
          ctx[dnpName].releaseMultiHash = await releaseUploader.addFromFs({
            dirPath: releaseDir,
            metadata: getPinMetadata(manifest, gitHead),
            onProgress: percent => (task.output = percentToMessage(percent)),
            onUploadComplete: () => {
              const started = Date.now();
              task.output = "Upload sent · waiting for pinning confirmation...";
              if (waiting) clearInterval(waiting);
              waiting = setInterval(
                () => {
                  task.output = `Waiting for pinning confirmation · ${Math.floor((Date.now() - started) / 1000)}s`;
                },
                process.stdout.isTTY ? 1000 : 15000
              );
            }
          });
        } finally {
          if (waiting) clearInterval(waiting);
        }
      }
    });
  }

  return uploadTasks;
}

function percentToMessage(percent: number): string {
  return `Uploading... ${(percent * 100).toFixed(2)}%`;
}
