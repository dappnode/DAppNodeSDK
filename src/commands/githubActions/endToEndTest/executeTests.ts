import got from "got";
import { Compose } from "../../../files/compose/types.js";
import { getContainerName } from "../../../params.js";
import { Manifest } from "../../../types.js";
import { DappmanagerTestApi } from "./dappmanagerTestApi.js";
import Docker from "dockerode";
import chalk from "chalk";
import {
  stakerPkgsToKeep,
  stakerGnosisConfig,
  stakerMainnetConfig,
  stakerPraterConfig
} from "./params.js";
import { getStakerPkgNetwork } from "./utils.js";

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
  // Test Install package from scratch
  console.log(chalk.dim("\nTEST: Installing pkg from scratch..."));
  await dappmanagerTestApi
    .packageInstall({
      dnpName: manifest.name,
      version: releaseMultiHash,
      userSettings: { environment: environmentByService || {} }
    })
    .then(() => {
      // If its a staker pkg then the stakerConfigSet must be called
      if (stakerPkgsToKeep.includes(manifest.name)) {
        const network = getStakerPkgNetwork(manifest.name);
        network === "mainnet"
          ? dappmanagerTestApi.stakerConfigSet(stakerMainnetConfig)
          : network === "gnosis"
          ? dappmanagerTestApi.stakerConfigSet(stakerGnosisConfig)
          : dappmanagerTestApi.stakerConfigSet(stakerPraterConfig);
      }
    });
  await executeTestCheckers({
    dnpName: manifest.name,
    compose,
    errorLogsTimeout,
    healthCheckUrl
  });

  // Skip update test if running in test environment, dappnodesdk package name is not published
  if (process.env.ENVIRONMENT === "TEST") return;

  // Remove package
  await dappmanagerTestApi.packageRemove({ dnpName: manifest.name });

  // Update package to the given hash
  console.log(chalk.dim("\nTEST: Install production pkg and update"));
  await dappmanagerTestApi.packageInstall({
    dnpName: manifest.name,
    version: "latest", // Install production version
    userSettings: { environment: environmentByService }
  });
  await dappmanagerTestApi.packageInstall({
    dnpName: manifest.name,
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
      console.log(chalk.green(`  ✓ Container ${containerName} is running`))
    );
    await ensureNoErrorLogs(containerName, docker, errorLogsTimeout).then(() =>
      console.log(chalk.green(`  ✓ No error logs found in ${containerName}`))
    );
  }
  if (healthCheckUrl)
    await ensureHealthCheck(healthCheckUrl).then(() =>
      console.log(chalk.green(`  ✓ Healthcheck endpoint returned 200`))
    );
}

async function ensureContainerStatus(
  containerName: string,
  docker: Docker
): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const container = await docker.getContainer(containerName).inspect();
    if (container.State.Status !== "running") {
      const errorMessage = `Container ${containerName} is not running. Status: ${container.State.Status}`;
      console.error(chalk.red(`  x ${errorMessage}`));
      throw Error(errorMessage);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function ensureHealthCheck(healthCheckUrl: string): Promise<void> {
  const res = await got(healthCheckUrl);
  if (res.statusCode < 200 || res.statusCode > 299) {
    const errorMessage = `HTTP code !== 2XX. Healthcheck endpoint returned ${res.statusCode}`;
    console.error(chalk.red(`x ${errorMessage}`));
    throw Error(errorMessage);
  }
}

async function ensureNoErrorLogs(
  containerName: string,
  docker: Docker,
  errorLogsTimeout: number
): Promise<void> {
  // maximum number of seconds to wait for the container to be running smoothly and check its logs are 120 seconds
  errorLogsTimeout > 120 && (errorLogsTimeout = 120);

  // Wait the timeout to ensure that no error logs are produced
  await new Promise(resolve => setTimeout(resolve, errorLogsTimeout * 1000));

  const logs = (
    await docker.getContainer(containerName).logs({
      follow: false,
      stdout: true,
      stderr: true,
      timestamps: true
    })
  ).toString();

  // collect all the error logs print them and throw an error if any
  const errorRegex = /.*\s+error.*/gi;
  const errorLogs = logs.match(errorRegex);

  if (errorLogs) {
    const errorMessage = `Error logs found in ${containerName}`;
    console.error(chalk.red(`  x ${errorMessage}`));
    errorLogs.forEach(errorLog => console.error(chalk.red(`    ${errorLog}`)));
    throw Error(errorMessage);
  }
}
