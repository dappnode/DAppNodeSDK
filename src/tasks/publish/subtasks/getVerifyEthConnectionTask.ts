import { ListrTask } from "listr";
import { ListrContextPublish } from "../../../types.js";
import { verifyEthConnection } from "../../../utils/verifyEthConnection.js";

export function getVerifyEthConnectionTask({
  ethProvider
}: {
  ethProvider: string;
}): ListrTask<ListrContextPublish> {
  return {
    title: "Verify ETH node connection",
    task: () => verifyEthConnection(ethProvider)
  };
}
