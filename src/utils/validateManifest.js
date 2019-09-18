const processExit = require("./processExit");
const manifestUtils = require("@dappnode/dnp-manifest");

const fakeHash = "/ipfs/QmDAppNodeDAppNodeDAppNodeDAppNodeDAppNodeDApp";

function validateManifest(manifest, options) {
  if (options && options.prerelease) {
    manifest.avatar = manifest.avatar || fakeHash;
    manifest.image = {
      ...manifest.image,
      path: "dappnode.dnp.dappnode.eth_0.0.0.tar.xz",
      hash: fakeHash,
      size: 100
    };
  }

  const { valid, errors } = manifestUtils.validateManifest(manifest);
  if (valid) return;

  // If not valid, print errors and stop execution

  processExit("Invalid manifest:", errors.map(msg => `  - ${msg}`).join("\n"));
}

module.exports = validateManifest;
