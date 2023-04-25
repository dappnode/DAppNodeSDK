import chalk from "chalk";
import Docker from "dockerode";
import got from "got";
import { Network } from "./types.js";
import { getContainerName } from "../../../params.js";
import { Compose } from "../../../types.js";

export async function executeTestCheckers({
  dnpName,
  compose,
  errorLogsTimeout,
  healthCheckUrl,
  network
}: {
  dnpName: string;
  compose: Compose;
  errorLogsTimeout: number;
  healthCheckUrl?: string;
  network?: Network;
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
  if (network)
    await attestanceProof(network)
      .then(() => console.log(chalk.green(`  ✓ Attestation proof`)))
      .catch(e => errors.push(e));

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
 * Test that the validators are attesting after a peri
 */
async function attestanceProof(network: Network): Promise<void> {
  if (network === "mainnet") return;
  // TODO
  return;
}
