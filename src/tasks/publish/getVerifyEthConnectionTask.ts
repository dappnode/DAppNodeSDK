import { ListrTask } from "listr";
import { ListrContextBuildAndPublish } from "../../types.js";
import { verifyEthConnection } from "../../utils/verifyEthConnection.js";

export function getVerifyEthConnectionTask({
  ethProvider
}: {
  ethProvider: string;
}): ListrTask<ListrContextBuildAndPublish> {
  return {
    title: "Verify ETH node connection",
    task: () => verifyEthConnection(ethProvider)
  };
}
