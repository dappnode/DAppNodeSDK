import { CommandModule } from "yargs";
import { CliGlobalOptions } from "../../../types.js";
import { defaultDir } from "../../../params.js";
import { ensureDappnodeEnvironment } from "./ensureDappnodeEnvironment.js";
import { readCompose, readManifest } from "../../../files/index.js";
import { buildHandler } from "../../build.js";
import { localDappmanagerTestApiUrl, localIpfsApiUrl } from "./params.js";
import { executeTests } from "./executeTests.js";
import { DappmanagerTestApi } from "./dappmanagerTestApi.js";

interface CliCommandOptions extends CliGlobalOptions {
  healthCheckUrl?: string;
  errorLogsTimeout: number;
  environmentByService?: string;
}

export const endToEndTest: CommandModule<
  CliGlobalOptions,
  CliCommandOptions
> = {
  command: "test-integration",
  describe: "Run integration tests (Install from scratch and update)",
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
      default: 5
    },
    environmentByService: {
      describe:
        "Environments by service to install the package with. JSON format",
      nargs: 1,
      type: "string",
      default: "{}"
    }
  },
  handler: async (args): Promise<void> => await gaTestIntegrationHandler(args)
};

async function gaTestIntegrationHandler({
  dir = defaultDir,
  healthCheckUrl,
  errorLogsTimeout,
  environmentByService
}: CliCommandOptions): Promise<void> {
  const dappmanagerTestApi = new DappmanagerTestApi(localDappmanagerTestApiUrl);

  try {
    const compose = readCompose();
    const { manifest } = readManifest();
    const environmentByServiceParsed = environmentByService
      ? JSON.parse(environmentByService)
      : {};

    // Build and upload
    const { releaseMultiHash } = await buildHandler({
      provider: localIpfsApiUrl,
      upload_to: "ipfs",
      verbose: true
    });

    // Ensure test-integration environment is clean
    await ensureDappnodeEnvironment({ dappmanagerTestApi });

    await executeTests({
      dappmanagerTestApi,
      releaseMultiHash,
      manifest,
      compose,
      healthCheckUrl,
      errorLogsTimeout,
      environmentByService: environmentByServiceParsed
    });
  } catch (e) {
    throw Error(`Error on test-integration: ${e.stack}`);
  } finally {
    // Ensure test-integration environment is cleaned
    await ensureDappnodeEnvironment({ dappmanagerTestApi });
  }
}
