import { DappmanagerTestApi } from "./dappmanagerTestApi";

/**
 * Ensure that the DAppNode environment is ready to run the integration tests
 */
export async function ensureDappnodeEnvironment({
  dappmanagerTestApi
}: {
  dappmanagerTestApi: DappmanagerTestApi;
}): Promise<void> {
  // TODO
  // Check dappmanager is running
  await dappmanagerTestApi.healthCheck();
}
