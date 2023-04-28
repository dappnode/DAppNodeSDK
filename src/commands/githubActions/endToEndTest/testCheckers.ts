import chalk from "chalk";
import Docker from "dockerode";
import got from "got";
import { Network, ValidatorData } from "./types.js";
import { getContainerName } from "../../../params.js";
import { getStakerConfigByNetwork } from "./params.js";
import { Compose } from "../../../types.js";
import { getIsStakerPkg } from "./utils.js";

export async function executeTestCheckers({
  dnpName,
  compose,
  errorLogsTimeout,
  healthCheckUrl,
  network,
  isUpdateTest
}: {
  dnpName: string;
  compose: Compose;
  errorLogsTimeout: number;
  healthCheckUrl?: string;
  network?: Network;
  isUpdateTest: boolean;
}): Promise<void> {
  const errors: Error[] = [];
  const docker = new Docker();
  for (const service of Object.keys(compose.services)) {
    const containerName = getContainerName({
      dnpName,
      serviceName: service,
      isCore: false
    });
    await ensureContainerStatus(containerName, docker)
      .then(() =>
        console.log(chalk.green(`  ✓ Container ${containerName} is running`))
      )
      .catch(e => errors.push(e));
    await ensureNoErrorLogs(containerName, docker, errorLogsTimeout)
      .then(() =>
        console.log(chalk.green(`  ✓ No error logs found in ${containerName}`))
      )
      .catch(e => errors.push(e));
  }
  if (healthCheckUrl)
    await ensureHealthCheck(healthCheckUrl)
      .then(() =>
        console.log(chalk.green(`  ✓ Healthcheck endpoint returned 200`))
      )
      .catch(e => errors.push(e));

  /** 
    * The attestation check will only be performed when a few requeriments are met:
    * - The package to test is a staker package or the default execution package (execution client needs to be on sync in order to attest)
    * - The test is the "testPackageInstallAndUpdate" and not the "testPackageInstallFromScratch" (the check can take up to 20 min to be completed).
  **/
  if (network && isUpdateTest && getIsStakerPkg(dnpName) && dnpName !== getStakerConfigByNetwork(network).executionClient.dnpName) {
    await attestanceProof(network)
      .then(() => console.log(chalk.green(`  ✓ Attestation proof`)))
      .catch(e => errors.push(e));
  }

  // Throw aggregated error if any
  if (errors.length > 0) {
    const errorMessages = errors.map(e => e.message).join("\n");
    throw Error(errorMessages);
  }
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
  const res = await got(healthCheckUrl).catch(e => {
    const errorMessage = `Healthcheck endpoint returned ${e.message}`;
    console.error(chalk.red(`  x ${errorMessage}`));
    throw Error(errorMessage);
  });
  if (res.statusCode < 200 || res.statusCode > 299) {
    const errorMessage = `HTTP code !== 2XX. Healthcheck endpoint returned ${res.statusCode}`;
    console.error(chalk.red(`  x ${errorMessage}`));
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

/**
 * Test that the validators are attesting after 16 minutes
 * 
 */
export async function attestanceProof(network: Network): Promise<void> {
  // Wait for doppleganger protection to end, set to 15 min
  await new Promise(resolve => setTimeout(resolve, 15 * 60 * 1000));
  // Check if the network is mainnet or prater
  if (network === "mainnet") {
    // TODO
    return;
  } else if (network === "prater") {
    let i = 1;
    console.log(chalk.grey(`  - Checking if validator is active`));

    while (i <= 9) {
      await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000)); // Wait for 2 minutes before each iteration
      const response = await got(`https://prater.beaconcha.in/api/v1/validator/${process.env.VALIDATOR_INDEX}`, {
      headers: {
        Accept: 'application/json'
      },
      responseType: 'json',
      throwHttpErrors: false
      });

      if (response.statusCode !== 200) throw new Error(`Error while fetching validator data. Beaconcha.in returned ${response.statusCode}`);

      const data = response.body as ValidatorData
      if (data.data.status === "active_online") {
        console.log(chalk.green(`  ✓ Validator is active`));
        return; // Exit the loop if the validator is active
      } else {
        console.log(chalk.yellow(`  - Validator is not active yet. Retrying (minutes passed: ${i*2})`));
      }
      i++;
    }
    const errorMessage = `Validator is not active after 20 minutes`;
    console.error(chalk.red(`  x ${errorMessage}`));
    throw new Error(errorMessage);
  }
  return;
}
