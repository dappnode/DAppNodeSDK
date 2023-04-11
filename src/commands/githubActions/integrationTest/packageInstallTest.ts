import { Compose } from "../../../types.js";
import { ensureDappnodeEnvironment } from "./ensureDappnodeEnvironment.js";
import { executeTests } from "./executeTests.js";

/**
 * Installs from scratch a package with a given hash.
 * If the package is already installed, it will be removed first.
 * After the installation, it will be check the package exists, is running
 * and that the health check (if any) is passing.
 */
export async function packageInstallTest({
  dnpName,
  releaseMultiHash,
  compose,
  errorLogsTimeout,
  healthCheckUrl
}: {
  dnpName: string;
  releaseMultiHash: string;
  compose: Compose;
  errorLogsTimeout?: number;
  healthCheckUrl?: string;
}): Promise<void> {
  // TODO
  await ensureDappnodeEnvironment();
  await executeTests({ compose, errorLogsTimeout, healthCheckUrl });
}
