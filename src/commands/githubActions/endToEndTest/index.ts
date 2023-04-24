import { CommandModule } from "yargs";
import { CliGlobalOptions } from "../../../types.js";
import { ensureDappnodeEnvironment } from "./ensureDappnodeEnvironment.js";
import { readCompose, readManifest } from "../../../files/index.js";
import { buildHandler } from "../../build.js";
import { executeEndToEndTests } from "./executeTests.js";
import { DappmanagerTestApi } from "./dappmanagerTestApi.js";
import { localDappmanagerTestApiUrl, localIpfsApiUrl } from "./params.js";
import chalk from "chalk";
import { Network } from "./types.js";

interface CliCommandOptions extends CliGlobalOptions {
  healthCheckUrl?: string;
  errorLogsTimeout: number;
  environmentByService?: string;
  network?: string;
}

export const endToEndTest: CommandModule<
  CliGlobalOptions,
  CliCommandOptions
> = {
  command: "test-end-to-end",
  describe: "Run end to end tests (Install from scratch and update)",
  builder: {
    healthCheckUrl: {
      type: "string",
      describe:
        "Optional health check URL, if the HTTP code is not 200, the test will fail"
    },
    errorLogsTimeout: {
      describe:
        "Timeout in seconds to wait for error logs to appear. If error logs appear after the timeout, the test will fail",
      type: "number",
      default: 30
    },
    network: {
      describe:
        "Network to use for the test if any. Available values are mainnet, prater, gnosis",
      type: "string"
    },
    environmentByService: {
      describe:
        "Environments by service to install the package with. JSON format",
      nargs: 1,
      type: "string",
      default: "{}"
    }
  },
  handler: async (args): Promise<void> => await gaTestEndToEndHandler(args)
};

export async function gaTestEndToEndHandler({
  dir,
  healthCheckUrl,
  errorLogsTimeout,
  environmentByService,
  network
}: CliCommandOptions): Promise<void> {
  if (
    network &&
    network !== "mainnet" &&
    network !== "prater" &&
    network !== "gnosis"
  )
    throw Error(
      `Invalid network ${network}. Available values are mainnet, prater, gnosis`
    );
  const dappmanagerTestApi = new DappmanagerTestApi(localDappmanagerTestApiUrl);
  const compose = readCompose({ dir });
  const { manifest } = readManifest({ dir });
  const environmentByServiceParsed: Record<
    string,
    string
  > = environmentByService ? JSON.parse(environmentByService) : {};

  try {
    // Build and upload
    console.log(chalk.dim("\nBuilding and uploading package..."));
    const { releaseMultiHash } = await buildHandler({
      dir,
      provider: localIpfsApiUrl,
      upload_to: "ipfs",
      verbose: false
    });

    // Ensure test-integration environment is clean
    console.log(
      chalk.dim("\nCleaning test-integration environment before starting")
    );
    await ensureDappnodeEnvironment({
      dappmanagerTestApi,
      network: network as Network
    });

    await executeEndToEndTests({
      dappmanagerTestApi,
      releaseMultiHash,
      manifest,
      compose,
      healthCheckUrl,
      errorLogsTimeout,
      environmentByService: environmentByServiceParsed,
      network: network as Network
    });
  } catch (e) {
    throw Error(`Error on test-integration: ${e}`);
  } finally {
    // Ensure test-integration environment is cleaned
    console.log(
      chalk.dim("\nCleaning test-integration environment before exiting")
    );
    await ensureDappnodeEnvironment({
      dappmanagerTestApi,
      network: network as Network
    });
  }
}
