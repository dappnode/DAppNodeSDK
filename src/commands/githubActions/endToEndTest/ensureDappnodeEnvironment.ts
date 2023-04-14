import { shell } from "../../../utils/shell.js";
import { DappmanagerTestApi } from "./dappmanagerTestApi.js";

/**
 * Ensure that the DAppNode environment is ready to run the integration tests
 */
export async function ensureDappnodeEnvironment({
  dappmanagerTestApi,
  dnpName
}: {
  dappmanagerTestApi: DappmanagerTestApi;
  dnpName: string;
}): Promise<void> {
  await setBindContainerIp();
  //  Remove package if installed and bypass error if any
  // Check dappmanager is running
  await dappmanagerTestApi.healthCheck();
  // Make sure that the /etc/resolv.conf file has the Bind container IP address so container aliases can be resolved from the host
  await dappmanagerTestApi
    .packageRemove({ dnpName, deleteVolumes: true })
    .catch(() => {
      console.log("No package to remove");
    });
}

/**
 * Checks the /etc/resolv.conf file has the Bind container IP address so container aliases can be resolved from the host
 */
async function setBindContainerIp(): Promise<void> {
  const bindContainerIp = "172.33.1.2";
  const resolvConfPath = "/etc/resolv.conf";

  const isBindContainerIpSet = await shell(
    `grep -q ${bindContainerIp} ${resolvConfPath}`
  );
  if (!isBindContainerIpSet)
    await shell(
      `echo "nameserver ${bindContainerIp}" | sudo tee -a ${resolvConfPath}`
    );
}
