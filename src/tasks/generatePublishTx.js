const Listr = require("listr");
const abi = require("ethjs-abi");
const { isHexString } = require("ethjs-util");
// Utils
const Apm = require("../utils/Apm");
const semverToArray = require("../utils/semverToArray");
const { readManifest } = require("../utils/manifest");
const getLinks = require("../utils/getLinks");
const { throwYargsErr } = require("../utils/yargsErr");
const { addReleaseTx } = require("../utils/releaseRecord");
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
  releaseIpfsPath,
  dir,
  developerAddress,
  ethProvider,
  verbose,
  silent
}) {
  // Init APM instance
  const apm = new Apm(ethProvider);

  // Load manifest ##### Verify manifest object
  const { name, version } = readManifest({ dir });

  // Compute tx data
  const contentURI =
    "0x" + Buffer.from(releaseIpfsPath, "utf8").toString("hex");
  const contractAddress = "0x0000000000000000000000000000000000000000";
  const currentVersion = version;
  const ensName = name;
  const shortName = name.split(".")[0];

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

          if (repository) {
            // If repository exists, push new version to it
            const newVersionCallAbi = repository.abi.find(
              ({ name }) => name === "newVersion"
            );
            if (!newVersionCallAbi)
              throw Error("Repository ABI doesn't have newVersion()");

            ctx.txData = {
              to: repository.address,
              value: 0,
              // newVersion(
              //     uint16[3] _newSemanticVersion,
              //     address _contractAddress,
              //     bytes _contentURI
              // )
              data: abi.encodeMethod(newVersionCallAbi, [
                semverToArray(currentVersion), // uint16[3] _newSemanticVersion
                contractAddress, // address _contractAddress
                contentURI // bytes _contentURI
              ]),
              gasLimit: 300000,
              ensName,
              currentVersion,
              releaseIpfsPath
            };
          } else {
            // If repo does not exist, create a new repo and push version
            // A developer address must be provided by the option -a or --developer_address.
            if (
              !developerAddress ||
              !isHexString(developerAddress) ||
              isZeroAddress(developerAddress)
            ) {
              throwYargsErr(
                `A new Aragon Package Manager Repo for ${ensName} must be created. 
You must specify the developer address that will control it

with ENV:

  DEVELOPER_ADDRESS=0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B dappnodesdk publish [type]

with command option:

  dappnodesdk publish [type] --developer_address 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B
`
              );
            }

            const newRepoWithVersionCallAbi = registry.abi.find(
              ({ name }) => name === "newRepoWithVersion"
            );
            if (!newRepoWithVersionCallAbi)
              throw Error("Registry ABI doesn't have newRepoWithVersion()");

            ctx.txData = {
              to: registry.address,
              value: 0,
              // newRepoWithVersion(
              //     string _name,
              //     address _dev,
              //     uint16[3] _initialSemanticVersion,
              //     address _contractAddress,
              //     bytes _contentURI
              // )
              data: abi.encodeMethod(newRepoWithVersionCallAbi, [
                shortName, // string _name
                developerAddress, // address _dev
                semverToArray(currentVersion), // uint16[3] _initialSemanticVersion
                contractAddress, // address _contractAddress
                contentURI // bytes _contentURI
              ]),
              gasLimit: 1100000,
              ensName,
              currentVersion,
              releaseIpfsPath,
              developerAddress
            };
          }

          /**
           * Write Tx data in a file for future reference
           */
          addReleaseTx({
            dir,
            version,
            link: getLinks.publishTx({ txData: ctx.txData })
          });
        }
      }
    ],
    { renderer: verbose ? "verbose" : silent ? "silent" : "default" }
  );
}

module.exports = generatePublishTx;
