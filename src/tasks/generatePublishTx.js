const Listr = require("listr");
const semverToArray = require("../utils/semverToArray");
const { readManifest } = require("../utils/manifest");

const Apm = require("../utils/Apm");
const { isAddress } = require("web3-utils");
const isZeroAddress = address => parseInt(address) === 0;

/**
 * Generates the transaction data necessary to publish the package.
 * It will check if the repository exists first:
 * - If it exists:
 * - If it does not exists:
 *
 * Then it will construct the txData object = {to, value, data, gasLimit} and:
 * - Write it on deploy.txt
 * - Show it on screen
 */

function generatePublishTx({
  manifestIpfsPath,
  dir,
  developerAddress,
  ethProvider,
  verbose,
  silent
}) {
  // Init APM instance
  const apm = new Apm(ethProvider);

  // Load manifest ##### Verify manifest object
  const manifest = readManifest({ dir });

  // Compute tx data
  const contentURI =
    "0x" + Buffer.from(manifestIpfsPath, "utf8").toString("hex");
  const contractAddress = "0x0000000000000000000000000000000000000000";
  const currentVersion = manifest.version;
  const ensName = manifest.name;
  const shortName = manifest.name.split(".")[0];

  return new Listr(
    [
      /**
       * 1. Ensure that a valid registry exists
       */
      {
        title: "Get registry contract",
        task: async ctx => {
          const registry = await apm.getRegistryContract(ensName);
          if (!registry)
            throw Error(`There must exist a registry for DNP name ${ensName}`);
          ctx.registry = registry;
        }
      },
      /**
       * 2. Get current repo
       */
      {
        title: "Get repo contract",
        task: async ctx => {
          const repository = await apm.getRepoContract(ensName);
          ctx.repository = repository;
        }
      },
      /**
       * 3. Generate TX
       */
      {
        title: "Generate transaction",
        task: async ctx => {
          const { registry, repository } = ctx;
          // If repository exists, push new version to it
          if (repository) {
            // newVersion(
            //     uint16[3] _newSemanticVersion,
            //     address _contractAddress,
            //     bytes _contentURI
            // )
            const newVersionCall = repository.methods.newVersion(
              semverToArray(currentVersion), // uint16[3] _newSemanticVersion
              contractAddress, // address _contractAddress
              contentURI // bytes _contentURI
            );
            ctx.txData = {
              to: repository.options.address,
              value: 0,
              data: newVersionCall.encodeABI(),
              gasLimit: 300000,
              ensName,
              currentVersion,
              manifestIpfsPath
            };
          }
          // If repo does not exist, create a new repo and push version
          else {
            // A developer address must be provided by the option -a or --developer_address.
            if (
              !developerAddress ||
              !isAddress(developerAddress) ||
              isZeroAddress(developerAddress)
            ) {
              throw Error(
                `A new Aragon Package Manager Repo for ${ensName} must be created. 
You must specify the developer address that will control it

dappnodesdk publish [type] --developer_address 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B
`
              );
            }

            // newRepoWithVersion(
            //     string _name,
            //     address _dev,
            //     uint16[3] _initialSemanticVersion,
            //     address _contractAddress,
            //     bytes _contentURI
            // )
            const newRepoWithVersionCall = registry.methods.newRepoWithVersion(
              shortName, // string _name
              developerAddress, // address _dev
              semverToArray(currentVersion), // uint16[3] _initialSemanticVersion
              contractAddress, // address _contractAddress
              contentURI // bytes _contentURI
            );
            ctx.txData = {
              to: registry.options.address,
              value: 0,
              data: newRepoWithVersionCall.encodeABI(),
              gasLimit: 1100000,
              ensName,
              currentVersion,
              manifestIpfsPath,
              developerAddress
            };
          }
        }
      }
    ],
    { renderer: verbose ? "verbose" : silent ? "silent" : "default" }
  );
}

module.exports = generatePublishTx;
