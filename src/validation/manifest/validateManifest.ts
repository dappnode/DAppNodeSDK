import { CliError, releaseFilesDefaultNames } from "../../params";
import { Manifest } from "../../types";
import { validateManifestSchema } from "./validateManifestSchema";

export function validateManifest(manifest: Manifest): void {
  if (/[A-Z]/.test(manifest.name))
    throw new CliError("Package name in the manifest must be lowercase");

  // Make sure the release is of correct type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((manifest as any).image)
    throw new CliError(`
DAppNode packages expect all docker related data to be contained only
in the docker-compose.yml. Please translate the settings in 'manifest.image'
to your package's docker-compose.yml and then delete the 'manifest.image' prop.
`);
  if (manifest.avatar)
    throw new CliError(`
DAppNode packages expect the avatar to be located at the root folder as a file
and not declared in the manifest. Please add your package avatar to this directory
as ${releaseFilesDefaultNames.avatar} and then remove the 'manifest.avatar' property.
`);

  const { valid, errors } = validateManifestSchema(manifest);
  if (valid) return;

  // If not valid, print errors and stop execution

  throw new CliError(
    `Invalid manifest: \n${errors.map(msg => `  - ${msg}`).join("\n")}`
  );
}
