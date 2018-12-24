const semverToArray = require('../utils/semverToArray');
const {readManifest} = require('../utils/manifest');
const inquirer = require('inquirer');
const Apm = require('../utils/Apm');
const check = require('../utils/check');
const {isAddress} = require('web3-utils');
const isZeroAddress = (address) => parseInt(address) === 0;

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

async function generatePublishTx({manifestIpfsPath, dir, developerAddress, ethProvider}) {
  // Init APM instance
  const apm = new Apm(ethProvider);

  // Load manifest
  const manifest = readManifest({dir});
  check(manifest, 'manifest', 'object');
  check(manifest.version, 'manifest version');
  check(manifest.name, 'manifest name');
  check(manifestIpfsPath, 'manifestIpfsPath');

  // Compute tx data
  const contentURI = '0x' + (Buffer.from(manifestIpfsPath, 'utf8').toString('hex'));
  const contractAddress = '0x0000000000000000000000000000000000000000';
  const currentVersion = manifest.version;
  const ensName = manifest.name;
  const shortName = manifest.name.split('.')[0];

  // Ensure that a valid registry exists
  const registry = await apm.getRegistryContract(ensName);
  if (!registry) throw Error(`There must exist a registry for DNP name ${ensName}`);
  // Check if the current repo exists
  const repository = await apm.getRepoContract();

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
    return {
      'To': repository.options.address,
      'Value': 0,
      'Data': newVersionCall.encodeABI(),
      'Gas limit': 300000,
    };
  }
  // If repo does not exist, create a new repo and push version
  else {
    // A developer address can be provided by the option developerAddress.
    // If it is not provided a prompt will ask for it
    if (!developerAddress) {
      developerAddress = await inquirer.prompt([
        {
          type: 'input',
          name: 'developerAddress',
          default: '0x0000000000000000000000000000000000000000',
          message: `A new Aragon Package Manager Repo for ${ensName} will be created. \nYou must specify the developer address that will control it (Or use the -dev flag):`,
          validate: (address) => (!isAddress(address) || isZeroAddress(address))
          ? 'The developer address must be valid and non-zero. Please make sure it is correct'
          : true,
        },
      ]).then((answer) => answer.developerAddress);
    } else if (!isAddress(developerAddress) || isZeroAddress(developerAddress)) {
      throw Error('The developer address must be valid and non-zero. Please make sure it is correct');
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
    return {
      'To': registry.options.address,
      'Value': 0,
      'Data': newRepoWithVersionCall.encodeABI(),
      'Gas limit': 1100000,
    };
  }
}

module.exports = generatePublishTx;
