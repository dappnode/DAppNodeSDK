import { CliError } from "../params";
import { Manifest } from "../types";
import { validateManifestSchema } from "./validateManifestSchema";

export function validateManifest(manifest: Manifest): void {
  const { valid, errors } = validateManifestSchema(manifest);
  if (valid) return;

  // If not valid, print errors and stop execution

  throw new CliError(
    `Invalid manifest: \n${errors.map(msg => `  - ${msg}`).join("\n")}`
  );
}
