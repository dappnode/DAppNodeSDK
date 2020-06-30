import { CliError } from "../params";
import { Manifest } from "../types";
import { validateManifestSchema } from "./validateManifestSchema";

const fakeHash = "/ipfs/QmDAppNodeDAppNodeDAppNodeDAppNodeDAppNodeDApp";

export function validateManifest(
  manifest: Manifest,
  options?: { prerelease?: boolean }
) {
  if (options && options.prerelease) {
    manifest.avatar = manifest.avatar || fakeHash;
    manifest.image = {
      ...manifest.image,
      path: "dappnode.dnp.dappnode.eth_0.0.0.tar.xz",
      hash: fakeHash,
      size: 100
    };
  }

  const { valid, errors } = validateManifestSchema(manifest);
  if (valid) return;

  // If not valid, print errors and stop execution

  throw new CliError(
    `Invalid manifest: \n${errors.map(msg => `  - ${msg}`).join("\n")}`
  );
}
