import manifestUtils from "@dappnode/dnp-manifest";
import { CliError } from "../params";
import { Manifest } from "../types";

const fakeHash = "/ipfs/QmDAppNodeDAppNodeDAppNodeDAppNodeDAppNodeDApp";

export function validateManifest(manifest: Manifest, options) {
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

  throw new CliError(
    "Invalid manifest:",
    errors.map(msg => `  - ${msg}`).join("\n")
  );
}
