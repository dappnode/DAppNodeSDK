import got from "got/dist/source/index.js";
import { Compose, ComposeService } from "../../../files/compose/types.js";
import { getContainerName } from "../../../params.js";
import { Manifest } from "../../../types.js";
import { DappmanagerTestApi } from "./dappmanagerTestApi.js";
import Docker from "dockerode";

/**
 * Execute the tests for the integration test workflow. These tests require
 * a previous setup of the environment.
 * Tests to execute:
 * - Container status (running, healthy)
 * - No error logs after a timeout
 * - Healthcheck endpoint returns 200
 */
export async function executeTests({
  dappmanagerTestApi,
  releaseMultiHash,
  manifest,
  compose,
  errorLogsTimeout,
  healthCheckUrl,
  environmentByService
}: {
  dappmanagerTestApi: DappmanagerTestApi;
  releaseMultiHash: string;
  manifest: Manifest;
  compose: Compose;
  errorLogsTimeout: number;
  healthCheckUrl?: string;
  environmentByService?: Pick<ComposeService, "environment">;
}): Promise<void> {
  // TEST: Install package
  await packageInstallTest({
    dappmanagerTestApi,
    dnpName: manifest.name,
    releaseMultiHash,
    compose,
    errorLogsTimeout,
    healthCheckUrl
  }).catch(e => {
    throw Error(`Error on packageInstallTest: ${e.stack}`);
  });

  // TEST: Update package
  await packageUpdateTest({
    dappmanagerTestApi,
    dnpName: manifest.name,
    releaseMultiHash,
    compose,
    errorLogsTimeout,
    healthCheckUrl
  }).catch(e => {
    throw Error(`Error on packageUpdateTest: ${e.stack}`);
  });
}

/**
 * Installs from scratch a package with a given hash.
 * If the package is already installed, it will be removed first.
 */
async function packageInstallTest({
  dappmanagerTestApi,
  dnpName,
  releaseMultiHash,
  compose,
  errorLogsTimeout,
  healthCheckUrl
}: {
  dappmanagerTestApi: DappmanagerTestApi;
  dnpName: string;
  releaseMultiHash: string;
  compose: Compose;
  errorLogsTimeout: number;
  healthCheckUrl?: string;
}): Promise<void> {
  // Check if the package is already installed and if so, remove it
  await dappmanagerTestApi
    .packageGet(dnpName)
    .then(
      async () =>
        await dappmanagerTestApi.packageRemove({ dnpName, deleteVolumes: true })
    )
    .catch(e => {
      console.log(`Package ${dnpName} is not installed`);
      console.log(e);
    });

  // Install package from scratch
  await dappmanagerTestApi.packageInstall({
    name: dnpName,
    version: releaseMultiHash
  });

  await executeTestCheckers({
    dnpName,
    compose,
    errorLogsTimeout,
    healthCheckUrl
  });
}

/**
 * Installs the latest published version of a package
 * then updates it with the given hash. If the package is already installed,
 * it will be removed first.
 */
async function packageUpdateTest({
  dappmanagerTestApi,
  dnpName,
  releaseMultiHash,
  compose,
  errorLogsTimeout,
  healthCheckUrl
}: {
  dappmanagerTestApi: DappmanagerTestApi;
  dnpName: string;
  releaseMultiHash: string;
  compose: Compose;
  errorLogsTimeout: number;
  healthCheckUrl?: string;
}): Promise<void> {
  // Check if the package is already installed and if so, remove it
  await dappmanagerTestApi
    .packageGet(dnpName)
    .then(
      async () =>
        await dappmanagerTestApi.packageRemove({ dnpName, deleteVolumes: true })
    )
    .catch(e => {
      console.log(`Package ${dnpName} is not installed`);
      console.log(e);
    });

  // Install package from scratch
  await dappmanagerTestApi.packageInstall({
    name: dnpName
  });

  // Update package to the given hash
  await dappmanagerTestApi.packageInstall({
    name: dnpName,
    version: releaseMultiHash
  });

  await executeTestCheckers({
    dnpName,
    compose,
    errorLogsTimeout,
    healthCheckUrl
  });
}

async function executeTestCheckers({
  dnpName,
  compose,
  errorLogsTimeout,
  healthCheckUrl
}: {
  dnpName: string;
  compose: Compose;
  errorLogsTimeout: number;
  healthCheckUrl?: string;
}): Promise<void> {
  const docker = new Docker();
  for (const service of Object.keys(compose.services)) {
    const containerName = getContainerName({
      dnpName,
      serviceName: service,
      isCore: false
    });
    await ensureContainerStatus(containerName, docker);
    await ensureNoErrorLogs(containerName, docker, errorLogsTimeout);
  }

  if (healthCheckUrl) await ensureHealthCheck(healthCheckUrl);
}

async function ensureContainerStatus(
  containerName: string,
  docker: Docker
): Promise<void> {
  const container = await docker.getContainer(containerName).inspect();
  if (!container.State.Running)
    throw Error(`Container ${containerName} is not running`);
  console.log(`Container ${containerName} is running`);
}

async function ensureHealthCheck(healthCheckUrl: string): Promise<void> {
  const res = await got(healthCheckUrl);
  if (res.statusCode !== 200)
    throw Error(`Healthcheck endpoint returned ${res.statusCode}`);
  console.log(`Healthcheck endpoint returned 200`);
}

async function ensureNoErrorLogs(
  containerName: string,
  docker: Docker,
  errorLogsTimeout: number
): Promise<void> {
  // maximum number of seconds to wait for the container to be running smoothly and check its logs are 120 seconds
  errorLogsTimeout > 120 && (errorLogsTimeout = 120);

  // Wait the timeout to ensure that no error logs are produced
  await new Promise(resolve => setTimeout(resolve, errorLogsTimeout));

  // create a time instance to then check the logs
  const time = new Date().toISOString();

  const logs = await docker
    .getContainer(containerName)
    .logs({
      follow: false,
      stdout: true,
      stderr: true,
      timestamps: true,
      since: time
    })
    .toString();

  // collect all the error logs print them and throw an error
  const errorLogs = logs
    .split("")
    .filter(log => log.includes("ERROR"))
    .join("");

  if (errorLogs.length > 0) {
    console.log(`Error logs found in ${containerName}: ${errorLogs}`);
    throw Error(`Error logs found in ${containerName}`);
  }
}
