import got from "got";
import { Compose } from "../../../files/compose/types.js";
import { getContainerName } from "../../../params.js";
import { Manifest } from "../../../types.js";
import { DappmanagerTestApi } from "./dappmanagerTestApi.js";
import Docker from "dockerode";
import chalk from "chalk";

/**
 * Execute the tests for the integration test workflow. These tests require
 * a previous setup of the environment.
 * Tests to execute:
 * - Container status (running, healthy)
 * - No error logs after a timeout
 * - Healthcheck endpoint returns 200
 */
export async function executePackageInstallAndUpdateTest({
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
  environmentByService?: Record<string, string>;
}): Promise<void> {
  console.log(chalk.blue("\nExecuting github action end to end tests...\n"));

  // Test Install package from scratch
  console.log(chalk.blue("\nTEST: Installing package from scratch...\n"));
  await dappmanagerTestApi.packageInstall({
    name: manifest.name,
    userSettings: { environment: environmentByService }
  });
  await executeTestCheckers({
    dnpName: manifest.name,
    compose,
    errorLogsTimeout,
    healthCheckUrl
  });

  // Update package to the given hash
  console.log(chalk.blue("\nTEST: Updating package ...\n"));
  await dappmanagerTestApi.packageInstall({
    name: manifest.name,
    version: releaseMultiHash,
    userSettings: { environment: environmentByService }
  });
  await executeTestCheckers({
    dnpName: manifest.name,
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
    await ensureContainerStatus(containerName, docker).then(() =>
      console.log(chalk.green(`- Container ${containerName} is running\n`))
    );
    await ensureNoErrorLogs(containerName, docker, errorLogsTimeout).then(() =>
      console.log(chalk.green(`- No error logs found in ${containerName}\n`))
    );
  }
  if (healthCheckUrl)
    await ensureHealthCheck(healthCheckUrl).then(() =>
      console.log(chalk.green(`- Healthcheck endpoint returned 200\n`))
    );
}

async function ensureContainerStatus(
  containerName: string,
  docker: Docker
): Promise<void> {
  const container = await docker.getContainer(containerName).inspect();
  if (!container.State.Running)
    throw Error(`Container ${containerName} is not running`);
}

async function ensureHealthCheck(healthCheckUrl: string): Promise<void> {
  const res = await got(healthCheckUrl);
  if (res.statusCode < 200 || res.statusCode > 299)
    throw Error(
      `HTTP code !== 2XX. Healthcheck endpoint returned ${res.statusCode}`
    );
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

  const logs = docker
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

  if (errorLogs.length > 0)
    throw Error(`Error logs found in ${containerName}: ${errorLogs}`);
}
