import { ListrTask } from "listr";
import { VerbosityOptions } from "../../../commands/build/types.js";
import { PackageToBuildProps, ListrContextPublish } from "../../../types.js";
import { generatePublishTxs } from "../../generatePublishTxs/index.js";

export function getGenerateTxTask({
  dir,
  composeFileName,
  developerAddress,
  ethProvider,
  verbosityOptions,
  packagesToBuildProps,
}: {
  dir: string;
  composeFileName: string;
  developerAddress?: string;
  ethProvider: string;
  verbosityOptions: VerbosityOptions;
  packagesToBuildProps: PackageToBuildProps[];
}): ListrTask<ListrContextPublish> {
  return {
    title: "Generate transaction",
    task: () => {
      return generatePublishTxs({
        dir,
        compose_file_name: composeFileName,
        developerAddress,
        ethProvider,
        verbosityOptions,
        packagesToBuildProps,
      });
    }
  };
}
