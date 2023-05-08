import { ajv } from "./ajv.js";
import { CliError } from "../params.js";
import { processError } from "./utils.js";
import manifestSchema from "./schemas/manifest.schema.json" assert { type: "json" };
import { Manifest } from "@dappnode/types";

/**
 * Validates manifest file with schema
 * @param manifest
 */
export function validateManifestSchema(manifest: Manifest): void {
  const validateManifest = ajv.compile(manifestSchema);
  const valid = validateManifest(manifest);
  if (!valid) {
    const errors = validateManifest.errors
      ? validateManifest.errors.map(e => processError(e, "manifest"))
      : [];
    throw new CliError(
      `Invalid manifest: \n${errors.map(msg => `  - ${msg}`).join("\n")}`
    );
  }
}
