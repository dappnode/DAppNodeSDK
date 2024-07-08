import { ListrTask } from "listr";
import { VerbosityOptions } from "../../../commands/build/types.js";
import { BuildVariantsMap, ListrContextPublish } from "../../../types.js";
import { generatePublishTxs } from "../../generatePublishTxs/index.js";

export function getGenerateTxTask({
  dir,
  composeFileName,
  developerAddress,
  ethProvider,
  verbosityOptions,
  variantsMap
}: {
  dir: string;
  composeFileName: string;
  developerAddress?: string;
  ethProvider: string;
  verbosityOptions: VerbosityOptions;
  variantsMap: BuildVariantsMap;
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
        variantsMap
      });
    }
  };
}
